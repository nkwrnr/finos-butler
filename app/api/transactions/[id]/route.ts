import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { logDataChange, getCurrentMonth } from '@/lib/data-pipeline/events';
import { invalidateDependentCaches } from '@/lib/data-pipeline/cache';
import { SPENDING_CATEGORIES, SpendingCategory } from '@/lib/categorization/types';

interface TransactionDetails {
  id: number;
  date: string;
  normalized_date: string;
  description: string;
  amount: number;
  category: string;
  spending_category: string | null;
  account_name: string;
  institution: string;
  account_type: string;
}

// Extract clean merchant name from description
function extractMerchantName(description: string): string {
  return description
    .replace(/\d{4,}/g, '')                    // Remove long numbers
    .replace(/\s+(CA|NY|TX|FL|WA|IL|AZ|CO|GA|MA|NC|NJ|OH|OR|PA|VA)\s*$/i, '') // Remove state codes
    .replace(/\s+\d+\s*$/g, '')                 // Remove trailing numbers
    .replace(/PURCHASE\s*(AUTHORIZED\s*ON\s*)?/i, '')
    .replace(/\d{1,2}\/\d{1,2}/g, '')          // Remove dates
    .replace(/CARD\s*\d+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .substring(0, 30);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    const transaction = db.prepare(`
      SELECT
        t.id,
        t.date,
        t.normalized_date,
        t.description,
        t.amount,
        t.category,
        t.spending_category,
        a.name as account_name,
        a.institution,
        a.type as account_type
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.id = ?
    `).get(transactionId) as TransactionDetails | undefined;

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transactionId = parseInt(id, 10);

    if (isNaN(transactionId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { spending_category, update_similar, remember_pattern } = body;

    // Validate category
    if (!spending_category || !SPENDING_CATEGORIES.includes(spending_category as SpendingCategory)) {
      return NextResponse.json(
        { error: 'Invalid spending category' },
        { status: 400 }
      );
    }

    // Get the transaction first
    const transaction = db.prepare(
      'SELECT id, description, normalized_date FROM transactions WHERE id = ?'
    ).get(transactionId) as { id: number; description: string; normalized_date: string } | undefined;

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    let updatedCount = 0;
    let patternSaved = false;

    // Update the main transaction
    db.prepare(
      'UPDATE transactions SET spending_category = ? WHERE id = ?'
    ).run(spending_category, transactionId);
    updatedCount = 1;

    // Get pattern for matching similar transactions
    const pattern = transaction.description.substring(0, 15).toLowerCase();

    // Update similar transactions if requested
    if (update_similar) {
      const result = db.prepare(`
        UPDATE transactions
        SET spending_category = ?
        WHERE LOWER(description) LIKE ?
        AND category = 'expense'
        AND id != ?
      `).run(spending_category, pattern + '%', transactionId);

      updatedCount += result.changes;
    }

    // Save pattern for future categorization if requested
    if (remember_pattern) {
      const cleanName = extractMerchantName(transaction.description);

      db.prepare(`
        INSERT OR REPLACE INTO merchant_patterns
          (pattern, category, merchant_name, source, confidence, updated_at)
        VALUES (?, ?, ?, 'user', 'high', datetime('now'))
      `).run(pattern, spending_category, cleanName);

      patternSaved = true;
    }

    // Log data change and invalidate caches
    const affectedMonth = transaction.normalized_date?.slice(0, 7) || getCurrentMonth();
    logDataChange({
      event: 'transaction_updated',
      timestamp: new Date().toISOString(),
      affectedMonths: [affectedMonth],
      metadata: {
        transactionId,
        newCategory: spending_category,
        updatedCount,
        patternSaved,
      },
    });
    invalidateDependentCaches([affectedMonth]);

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      patternSaved,
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
