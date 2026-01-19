import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';
import { parseCSV, parsePDF } from '@/lib/parsers';

// Initialize database
initDatabase();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const institution = formData.get('institution') as string;
    const accountType = formData.get('accountType') as string;
    const goalIdStr = formData.get('goalId') as string | null;
    const goalId = goalIdStr ? parseInt(goalIdStr) : null;

    if (!file || !institution || !accountType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse file based on type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    let parseResult;

    if (fileExt === 'csv') {
      parseResult = await parseCSV(buffer);
    } else if (fileExt === 'pdf') {
      parseResult = await parsePDF(buffer);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a CSV or PDF file.' },
        { status: 400 }
      );
    }

    const { transactions, balance, warnings } = parseResult;

    // Determine account name based on institution, type, and goal
    let accountName: string;
    if (goalId) {
      // Get goal name for account naming
      const goal = db.prepare('SELECT name FROM savings_goals WHERE id = ?').get(goalId) as { name: string } | undefined;
      const goalName = goal ? goal.name : 'Unknown';
      accountName = `${institution} - ${goalName} ${accountType}`;
    } else {
      accountName = `${institution} ${accountType}`;
    }

    // Find account by name AND goal_id (ensures separate accounts per goal)
    let account = db
      .prepare('SELECT * FROM accounts WHERE name = ? AND institution = ? AND type = ? AND (goal_id = ? OR (goal_id IS NULL AND ? IS NULL))')
      .get(accountName, institution, accountType, goalId, goalId) as { id: number; balance: number } | undefined;

    let accountCreated = false;

    if (!account) {
      const insertAccount = db.prepare(
        'INSERT INTO accounts (name, institution, type, balance, goal_id, last_updated) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      );
      const result = insertAccount.run(accountName, institution, accountType, balance || 0, goalId);
      account = { id: result.lastInsertRowid as number, balance: balance || 0 };
      accountCreated = true;
    }

    // Create import record
    const importRecord = db.prepare(
      'INSERT INTO imports (filename, institution, account_type, account_id, goal_id, transaction_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(file.name, institution, accountType, account.id, goalId, transactions.length, 'success');

    const importId = importRecord.lastInsertRowid as number;

    // Insert transactions with import_id
    const insertTransaction = db.prepare(
      'INSERT INTO transactions (account_id, import_id, date, description, amount, category) VALUES (?, ?, ?, ?, ?, ?)'
    );

    let transactionCount = 0;
    for (const transaction of transactions) {
      try {
        insertTransaction.run(
          account.id,
          importId,
          transaction.date,
          transaction.description,
          transaction.amount,
          transaction.category || null
        );
        transactionCount++;
      } catch (err) {
        console.error('Error inserting transaction:', err);
        warnings.push(`Failed to insert transaction: ${transaction.description}`);
      }
    }

    // Calculate actual balance from transactions
    const balanceResult = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE account_id = ?')
      .get(account.id) as { total: number | null };

    const calculatedBalance = balanceResult.total || 0;

    // Update account with calculated balance (prefer PDF-detected balance if available)
    const finalBalance = balance !== undefined ? balance : calculatedBalance;
    db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
      .run(finalBalance, account.id);

    return NextResponse.json({
      success: true,
      transactionCount,
      balance: finalBalance,
      warnings,
      accountCreated: accountCreated
        ? {
            name: accountName,
            institution,
            type: accountType,
          }
        : undefined,
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: `Failed to import statement: ${error}` },
      { status: 500 }
    );
  }
}
