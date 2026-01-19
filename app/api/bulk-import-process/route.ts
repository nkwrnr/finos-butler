import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import db, { initDatabase } from '@/lib/db';
import { parseCSV, parsePDF } from '@/lib/parsers';
import { categorizeTransaction } from '@/lib/categorize-transactions';
import { logDataChange, getUniqueMonths } from '@/lib/data-pipeline/events';
import { invalidateDependentCaches } from '@/lib/data-pipeline/cache';

// Initialize database
initDatabase();

/**
 * Normalize date strings to YYYY-MM-DD format
 */
function normalizeImportDate(dateStr: string): string {
  // Already in YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateStr;
  }

  // Handle MM/DD/YYYY format
  if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }

  // Handle MM/DD format (no year)
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const now = new Date();
    const currentYear = now.getFullYear();
    let date = new Date(currentYear, month - 1, day);
    if (date > now) {
      date = new Date(currentYear - 1, month - 1, day);
    }
    return date.toISOString().split('T')[0];
  }

  // Fallback
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

type ImportResult = {
  filename: string;
  success: boolean;
  transactionCount?: number;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mappings } = body;

    if (!mappings || !Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Mappings are required' }, { status: 400 });
    }

    const results: ImportResult[] = [];
    let totalTransactions = 0;

    for (const mapping of mappings) {
      if (!mapping.enabled) continue;

      const { institution, accountType, goalId, files } = mapping;

      for (const filePath of files) {
        try {
          const filename = path.basename(filePath);

          // Check if already imported
          const existing = db
            .prepare('SELECT id FROM imports WHERE filename = ?')
            .get(filename);

          if (existing) {
            results.push({
              filename,
              success: false,
              error: 'Already imported',
            });
            continue;
          }

          // Read file
          const fileBuffer = await fs.readFile(filePath);
          const fileExt = path.extname(filePath).toLowerCase();

          // Parse file
          let parseResult;
          if (fileExt === '.csv') {
            parseResult = await parseCSV(fileBuffer);
          } else if (fileExt === '.pdf') {
            parseResult = await parsePDF(fileBuffer);
          } else {
            results.push({
              filename,
              success: false,
              error: 'Unsupported file type',
            });
            continue;
          }

          const { transactions, balance, warnings } = parseResult;

          if (transactions.length === 0) {
            results.push({
              filename,
              success: false,
              error: 'No transactions found',
            });
            continue;
          }

          // Determine account name
          let accountName: string;
          if (goalId) {
            const goal = db
              .prepare('SELECT name FROM savings_goals WHERE id = ?')
              .get(goalId) as { name: string } | undefined;
            const goalName = goal ? goal.name : 'Unknown';
            accountName = `${institution} - ${goalName} ${accountType}`;
          } else {
            accountName = `${institution} ${accountType}`;
          }

          // Find or create account
          let account = db
            .prepare(
              'SELECT * FROM accounts WHERE name = ? AND institution = ? AND type = ? AND (goal_id = ? OR (goal_id IS NULL AND ? IS NULL))'
            )
            .get(accountName, institution, accountType, goalId, goalId) as
            | { id: number; balance: number }
            | undefined;

          if (!account) {
            const insertAccount = db.prepare(
              'INSERT INTO accounts (name, institution, type, balance, goal_id, last_updated) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
            );
            const result = insertAccount.run(
              accountName,
              institution,
              accountType,
              balance || 0,
              goalId
            );
            account = { id: result.lastInsertRowid as number, balance: balance || 0 };
          }

          // Extract statement date from filename (try to parse date)
          let statementDate: string | null = null;

          // Pattern 1: YYYYMMDD format (e.g., 20251228)
          let dateMatch = filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
          if (dateMatch) {
            statementDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
          } else {
            // Pattern 2: MMDDYY format (e.g., 123125 = Dec 31, 2025)
            const shortDateMatch = filename.match(/(\d{2})(\d{2})(\d{2})/);
            if (shortDateMatch) {
              const mm = shortDateMatch[1];
              const dd = shortDateMatch[2];
              const yy = shortDateMatch[3];
              // Assume 20XX for years 00-99
              const yyyy = `20${yy}`;
              statementDate = `${yyyy}-${mm}-${dd}`;
            }
          }

          // Create import record with ending balance and statement date
          const importRecord = db
            .prepare(
              'INSERT INTO imports (filename, institution, account_type, account_id, goal_id, transaction_count, status, statement_ending_balance, statement_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .run(
              filename,
              institution,
              accountType,
              account.id,
              goalId,
              transactions.length,
              'success',
              balance || null,
              statementDate
            );

          const importId = importRecord.lastInsertRowid as number;

          // Insert transactions with auto-categorization
          const insertTransaction = db.prepare(
            'INSERT INTO transactions (account_id, import_id, date, normalized_date, description, amount, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
          );

          let transactionCount = 0;
          const transactionDates: string[] = [];

          for (const transaction of transactions) {
            try {
              // Auto-categorize if no category provided
              const category = transaction.category || categorizeTransaction(transaction.description, transaction.amount);

              // Normalize date for consistent querying
              const normalizedDate = normalizeImportDate(transaction.date);

              insertTransaction.run(
                account.id,
                importId,
                transaction.date,
                normalizedDate,
                transaction.description,
                transaction.amount,
                category
              );
              transactionCount++;
              transactionDates.push(normalizedDate);
            } catch (err) {
              console.error('Error inserting transaction:', err);
            }
          }

          // Log the data change for pipeline tracking
          const affectedMonths = getUniqueMonths(transactionDates);
          logDataChange({
            event: 'transactions_imported',
            timestamp: new Date().toISOString(),
            affectedAccounts: [account.id],
            affectedMonths,
            metadata: {
              filename,
              transactionCount,
              institution,
              accountType,
            },
          });

          // Invalidate dependent caches
          invalidateDependentCaches(affectedMonths);

          // Update account balance to the most recent statement's ending balance
          // Find the most recent import with a valid ending balance for this account
          const mostRecentImport = db
            .prepare(`
              SELECT statement_ending_balance, statement_date, filename
              FROM imports
              WHERE account_id = ? AND statement_ending_balance IS NOT NULL
              ORDER BY statement_date DESC, imported_at DESC
              LIMIT 1
            `)
            .get(account.id) as { statement_ending_balance: number; statement_date: string; filename: string } | undefined;

          let finalBalance: number;
          if (mostRecentImport && mostRecentImport.statement_ending_balance !== null) {
            // Use the ending balance from the most recent statement
            finalBalance = mostRecentImport.statement_ending_balance;
          } else {
            // Fallback: use the balance from current import or sum of transactions
            finalBalance = balance !== undefined ? balance : 0;
          }

          db.prepare(
            'UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?'
          ).run(finalBalance, account.id);

          results.push({
            filename,
            success: true,
            transactionCount,
          });

          totalTransactions += transactionCount;
        } catch (error) {
          results.push({
            filename: path.basename(filePath),
            success: false,
            error: `${error}`,
          });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalFiles: results.length,
        successCount,
        failCount,
        totalTransactions,
      },
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      { error: `Failed to process bulk import: ${error}` },
      { status: 500 }
    );
  }
}
