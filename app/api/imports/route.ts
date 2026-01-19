import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

export async function GET() {
  try {
    const imports = db.prepare(`
      SELECT
        i.*,
        g.name as goal_name,
        a.name as account_name
      FROM imports i
      LEFT JOIN savings_goals g ON i.goal_id = g.id
      LEFT JOIN accounts a ON i.account_id = a.id
      ORDER BY i.imported_at DESC
    `).all();

    return NextResponse.json(imports);
  } catch (error) {
    console.error('Error fetching imports:', error);
    return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, goal_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Import ID is required' }, { status: 400 });
    }

    // Get the import record with current details
    const importRecord = db.prepare('SELECT * FROM imports WHERE id = ?')
      .get(id) as { id: number; account_id: number; institution: string; account_type: string; goal_id: number | null } | undefined;

    if (!importRecord) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    const oldAccountId = importRecord.account_id;
    const newGoalId = goal_id === null || goal_id === undefined ? null : goal_id;

    // Determine new account name
    let newAccountName: string;
    if (newGoalId) {
      const goal = db.prepare('SELECT name FROM savings_goals WHERE id = ?').get(newGoalId) as { name: string } | undefined;
      const goalName = goal ? goal.name : 'Unknown';
      newAccountName = `${importRecord.institution} - ${goalName} ${importRecord.account_type}`;
    } else {
      newAccountName = `${importRecord.institution} ${importRecord.account_type}`;
    }

    // Find or create the new account
    let newAccount = db.prepare('SELECT * FROM accounts WHERE name = ? AND institution = ? AND type = ? AND (goal_id = ? OR (goal_id IS NULL AND ? IS NULL))')
      .get(newAccountName, importRecord.institution, importRecord.account_type, newGoalId, newGoalId) as { id: number } | undefined;

    if (!newAccount) {
      // Create new account
      const result = db.prepare(
        'INSERT INTO accounts (name, institution, type, balance, goal_id, last_updated) VALUES (?, ?, ?, 0, ?, CURRENT_TIMESTAMP)'
      ).run(newAccountName, importRecord.institution, importRecord.account_type, newGoalId);
      newAccount = { id: result.lastInsertRowid as number };
    }

    const newAccountId = newAccount.id;

    // Move transactions from old account to new account
    db.prepare('UPDATE transactions SET account_id = ? WHERE import_id = ?')
      .run(newAccountId, id);

    // Update import record
    db.prepare('UPDATE imports SET goal_id = ?, account_id = ? WHERE id = ?')
      .run(newGoalId, newAccountId, id);

    // Recalculate old account balance
    const oldBalance = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE account_id = ?')
      .get(oldAccountId) as { total: number | null };
    const oldBalanceValue = oldBalance.total || 0;

    if (oldBalanceValue === 0) {
      const oldTxCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?')
        .get(oldAccountId) as { count: number };
      if (oldTxCount.count === 0) {
        db.prepare('DELETE FROM accounts WHERE id = ?').run(oldAccountId);
      } else {
        db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
          .run(oldBalanceValue, oldAccountId);
      }
    } else {
      db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
        .run(oldBalanceValue, oldAccountId);
    }

    // Recalculate new account balance
    const newBalance = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE account_id = ?')
      .get(newAccountId) as { total: number | null };
    const newBalanceValue = newBalance.total || 0;

    db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newBalanceValue, newAccountId);

    const updatedImport = db.prepare(`
      SELECT
        i.*,
        g.name as goal_name,
        a.name as account_name
      FROM imports i
      LEFT JOIN savings_goals g ON i.goal_id = g.id
      LEFT JOIN accounts a ON i.account_id = a.id
      WHERE i.id = ?
    `).get(id);

    return NextResponse.json(updatedImport);
  } catch (error) {
    console.error('Error updating import:', error);
    return NextResponse.json({ error: 'Failed to update import' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Import ID is required' }, { status: 400 });
    }

    // Get the import to find its account
    const importRecord = db.prepare('SELECT account_id, transaction_count FROM imports WHERE id = ?')
      .get(id) as { account_id: number; transaction_count: number } | undefined;

    if (!importRecord) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    // Delete the import (transactions will be deleted via CASCADE)
    db.prepare('DELETE FROM imports WHERE id = ?').run(id);

    // Recalculate account balance
    if (importRecord.account_id) {
      const balanceResult = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE account_id = ?')
        .get(importRecord.account_id) as { total: number | null };

      const newBalance = balanceResult.total || 0;

      if (newBalance === 0) {
        // Check if there are any transactions left
        const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?')
          .get(importRecord.account_id) as { count: number };

        if (txCount.count === 0) {
          // Delete the account if no transactions remain
          db.prepare('DELETE FROM accounts WHERE id = ?').run(importRecord.account_id);
        } else {
          // Update balance
          db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newBalance, importRecord.account_id);
        }
      } else {
        // Update balance
        db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newBalance, importRecord.account_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting import:', error);
    return NextResponse.json({ error: 'Failed to delete import' }, { status: 500 });
  }
}
