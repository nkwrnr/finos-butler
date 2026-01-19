import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { logDataChange } from '@/lib/data-pipeline/events';
import { invalidateDependentCaches } from '@/lib/data-pipeline/cache';

interface LogPurchaseRequest {
  amountUsd: number;
  amountZec?: number;
  date?: string; // ISO date string, defaults to today
  source?: string; // Coinbase, Gemini, etc.
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LogPurchaseRequest = await request.json();

    if (!body.amountUsd || body.amountUsd <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount USD is required and must be positive' },
        { status: 400 }
      );
    }

    const date = body.date || new Date().toISOString().split('T')[0];
    const source = body.source || 'Coinbase';
    const amountZec = body.amountZec || 0;

    // Get checking account (WellsFargo)
    const checkingAccount = db.prepare(`
      SELECT id FROM accounts WHERE type = 'checking' LIMIT 1
    `).get() as { id: number } | undefined;

    if (!checkingAccount) {
      return NextResponse.json(
        { success: false, error: 'No checking account found' },
        { status: 400 }
      );
    }

    // Get current Zcash price for reference
    const priceCache = db.prepare(
      'SELECT price_usd FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1'
    ).get() as { price_usd: number } | undefined;
    const currentPrice = priceCache?.price_usd || 0;

    // Calculate ZEC if not provided but price is available
    const calculatedZec = amountZec > 0 ? amountZec : (currentPrice > 0 ? body.amountUsd / currentPrice : 0);

    // 1. Create transaction in checking account (negative amount = outflow)
    const description = `${source} - Zcash Purchase (Manual Entry)`;

    db.prepare(`
      INSERT INTO transactions (account_id, date, normalized_date, description, amount, category)
      VALUES (?, ?, ?, ?, ?, 'zcash_purchase')
    `).run(
      checkingAccount.id,
      date,
      date,
      description,
      -body.amountUsd // Negative because it's money leaving checking
    );

    // 2. Log in zcash_purchases table
    db.prepare(`
      INSERT INTO zcash_purchases (date, amount_usd, amount_zec, price_at_purchase, source, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      date,
      body.amountUsd,
      calculatedZec,
      currentPrice,
      source,
      body.notes || 'Manual entry from dashboard'
    );

    // 3. Update Zcash source holdings if ZEC amount provided
    if (calculatedZec > 0) {
      // Get or create the source
      const existingSource = db.prepare(
        'SELECT id, zec_amount, cost_basis_usd FROM zcash_sources WHERE source_name = ?'
      ).get(source) as { id: number; zec_amount: number; cost_basis_usd: number | null } | undefined;

      if (existingSource) {
        // Update existing source
        const newZecAmount = existingSource.zec_amount + calculatedZec;
        const newCostBasis = (existingSource.cost_basis_usd || 0) + body.amountUsd;

        db.prepare(`
          UPDATE zcash_sources
          SET zec_amount = ?, cost_basis_usd = ?, last_updated = datetime('now')
          WHERE id = ?
        `).run(newZecAmount, newCostBasis, existingSource.id);
      } else {
        // Create new source
        db.prepare(`
          INSERT INTO zcash_sources (source_name, zec_amount, cost_basis_usd)
          VALUES (?, ?, ?)
        `).run(source, calculatedZec, body.amountUsd);
      }
    }

    // 4. Update checking account balance
    db.prepare(`
      UPDATE accounts SET balance = balance - ?, last_updated = datetime('now')
      WHERE id = ?
    `).run(body.amountUsd, checkingAccount.id);

    // 5. Log data change and invalidate caches
    const affectedMonth = date.slice(0, 7);
    logDataChange({
      event: 'zcash_logged',
      timestamp: new Date().toISOString(),
      affectedAccounts: [checkingAccount.id],
      affectedMonths: [affectedMonth],
      metadata: {
        amountUsd: body.amountUsd,
        amountZec: calculatedZec,
        source,
      },
    });
    invalidateDependentCaches([affectedMonth]);

    return NextResponse.json({
      success: true,
      purchase: {
        date,
        amountUsd: body.amountUsd,
        amountZec: calculatedZec,
        source,
        priceAtPurchase: currentPrice,
      },
      message: `Logged $${body.amountUsd} Zcash purchase${calculatedZec > 0 ? ` (${calculatedZec.toFixed(4)} ZEC)` : ''}`,
    });
  } catch (error) {
    console.error('Error logging Zcash purchase:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log purchase' },
      { status: 500 }
    );
  }
}
