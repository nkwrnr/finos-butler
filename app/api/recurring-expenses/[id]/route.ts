import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    const body = await request.json();
    const { tracked, category, override_amount, notes } = body;

    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];

    if (tracked !== undefined) {
      updates.push('tracked = ?');
      values.push(tracked ? 1 : 0);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (override_amount !== undefined) {
      updates.push('next_predicted_amount = ?');
      values.push(override_amount);
    }

    if (notes !== undefined) {
      // Note: would need to add notes column to schema
      updates.push('sample_transaction_ids = ?'); // Temporary storage
      values.push(notes);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const query = `UPDATE recurring_expenses SET ${updates.join(', ')} WHERE id = ?`;
    values.push(id);

    db.prepare(query).run(...values);

    return NextResponse.json({ success: true, message: 'Expense updated successfully' });
  } catch (error) {
    console.error('Error updating recurring expense:', error);
    return NextResponse.json({ error: `Failed to update expense: ${error}` }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    const expense = db.prepare('SELECT * FROM recurring_expenses WHERE id = ?').get(id);

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error fetching recurring expense:', error);
    return NextResponse.json({ error: `Failed to fetch expense: ${error}` }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);

    // Mark as user_excluded instead of deleting
    db.prepare('UPDATE recurring_expenses SET user_excluded = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Expense marked as excluded' });
  } catch (error) {
    console.error('Error deleting recurring expense:', error);
    return NextResponse.json({ error: `Failed to delete expense: ${error}` }, { status: 500 });
  }
}
