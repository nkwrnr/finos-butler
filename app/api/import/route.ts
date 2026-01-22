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

    // STEP 1: Try to find existing account by institution and type
    // This prevents creating duplicate accounts when importing to the same logical account
    let account = db
      .prepare('SELECT id, balance, name FROM accounts WHERE institution = ? AND type = ?')
      .get(institution, accountType) as { id: number; balance: number; name: string } | undefined;

    let accountCreated = false;
    let accountName: string;

    if (account) {
      // Use existing account
      accountName = account.name;

      // If a goal was specified and account doesn't have one, optionally update it
      if (goalId && !db.prepare('SELECT goal_id FROM accounts WHERE id = ?').get(account.id)) {
        db.prepare('UPDATE accounts SET goal_id = ? WHERE id = ?').run(goalId, account.id);
      }
    } else {
      // No existing account - create new one
      if (goalId) {
        const goal = db.prepare('SELECT name FROM savings_goals WHERE id = ?').get(goalId) as { name: string } | undefined;
        const goalName = goal ? goal.name : 'Unknown';
        accountName = `${institution} - ${goalName} ${accountType}`;
      } else {
        accountName = `${institution} ${accountType}`;
      }

      const insertAccount = db.prepare(
        'INSERT INTO accounts (name, institution, type, balance, goal_id, last_updated) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
      );
      const result = insertAccount.run(accountName, institution, accountType, balance || 0, goalId);
      account = { id: result.lastInsertRowid as number, balance: balance || 0, name: accountName };
      accountCreated = true;
    }

    // Create import record
    const importRecord = db.prepare(
      'INSERT INTO imports (filename, institution, account_type, account_id, goal_id, transaction_count, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(file.name, institution, accountType, account.id, goalId, transactions.length, 'success');

    const importId = importRecord.lastInsertRowid as number;

    // Insert transactions with import_id, with deduplication check
    const insertTransaction = db.prepare(
      'INSERT INTO transactions (account_id, import_id, date, description, amount, category) VALUES (?, ?, ?, ?, ?, ?)'
    );

    // Check for existing transaction to prevent duplicates
    const checkDuplicate = db.prepare(
      'SELECT id FROM transactions WHERE account_id = ? AND date = ? AND description = ? AND amount = ? LIMIT 1'
    );

    let transactionCount = 0;
    let skippedDuplicates = 0;

    for (const transaction of transactions) {
      try {
        // Normalize date to YYYY-MM-DD format for consistent comparison
        const normalizedDate = transaction.date.split('T')[0];

        // Check if this transaction already exists
        const existing = checkDuplicate.get(
          account.id,
          normalizedDate,
          transaction.description,
          transaction.amount
        );

        if (existing) {
          skippedDuplicates++;
          continue; // Skip duplicate
        }

        insertTransaction.run(
          account.id,
          importId,
          normalizedDate,
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

    if (skippedDuplicates > 0) {
      warnings.push(`Skipped ${skippedDuplicates} duplicate transaction(s) that already exist in the database.`);
    }

    // Only update account balance if the parser detected an ending balance from the statement
    // For CSVs without ending balance, we cannot derive balance from transactions alone
    // (would need a starting balance which we don't have)
    let finalBalance = account.balance; // Keep existing balance by default

    if (balance !== undefined) {
      // Parser detected a balance (e.g., from PDF statement) - use it
      finalBalance = balance;
      db.prepare('UPDATE accounts SET balance = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?')
        .run(finalBalance, account.id);
    } else {
      // No balance detected (e.g., CSV) - just update last_updated timestamp
      db.prepare('UPDATE accounts SET last_updated = CURRENT_TIMESTAMP WHERE id = ?')
        .run(account.id);
    }

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
