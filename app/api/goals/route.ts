import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';
import { logDataChange, getCurrentMonth } from '@/lib/data-pipeline/events';
import { invalidateDependentCaches } from '@/lib/data-pipeline/cache';

// Initialize database
initDatabase();

export async function GET() {
  try {
    // Get goals with calculated current_amount from linked accounts using subquery
    const goals = db.prepare(`
      SELECT
        sg.id,
        sg.name,
        sg.target_amount,
        sg.deadline,
        COALESCE((SELECT SUM(a.balance) FROM accounts a WHERE a.goal_id = sg.id), 0) as current_amount
      FROM savings_goals sg
      ORDER BY sg.name
    `).all();
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, target_amount } = body;

    if (!name || !target_amount) {
      return NextResponse.json(
        { error: 'Name and target amount are required' },
        { status: 400 }
      );
    }

    const insertGoal = db.prepare(
      'INSERT INTO savings_goals (name, target_amount, current_amount) VALUES (?, ?, 0)'
    );

    const result = insertGoal.run(name, target_amount);

    // Return goal with calculated current_amount from linked accounts using subquery
    const newGoal = db
      .prepare(`
        SELECT
          sg.id,
          sg.name,
          sg.target_amount,
          sg.deadline,
          COALESCE((SELECT SUM(a.balance) FROM accounts a WHERE a.goal_id = sg.id), 0) as current_amount
        FROM savings_goals sg
        WHERE sg.id = ?
      `)
      .get(result.lastInsertRowid);

    // Log data change and invalidate caches
    const currentMonth = getCurrentMonth();
    logDataChange({
      event: 'goal_created',
      timestamp: new Date().toISOString(),
      affectedMonths: [currentMonth],
      metadata: { goalId: result.lastInsertRowid, name, target_amount },
    });
    invalidateDependentCaches([currentMonth]);

    return NextResponse.json(newGoal);
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, target_amount } = body;

    if (!id || !name || !target_amount) {
      return NextResponse.json(
        { error: 'ID, name, and target amount are required' },
        { status: 400 }
      );
    }

    db.prepare('UPDATE savings_goals SET name = ?, target_amount = ? WHERE id = ?').run(
      name,
      target_amount,
      id
    );

    // Return goal with calculated current_amount from linked accounts using subquery
    const updatedGoal = db.prepare(`
      SELECT
        sg.id,
        sg.name,
        sg.target_amount,
        sg.deadline,
        COALESCE((SELECT SUM(a.balance) FROM accounts a WHERE a.goal_id = sg.id), 0) as current_amount
      FROM savings_goals sg
      WHERE sg.id = ?
    `).get(id);

    // Log data change and invalidate caches
    const currentMonth = getCurrentMonth();
    logDataChange({
      event: 'goal_updated',
      timestamp: new Date().toISOString(),
      affectedMonths: [currentMonth],
      metadata: { goalId: id, name, target_amount },
    });
    invalidateDependentCaches([currentMonth]);

    return NextResponse.json(updatedGoal);
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Unlink any accounts from this goal
    db.prepare('UPDATE accounts SET goal_id = NULL WHERE goal_id = ?').run(id);

    // Delete the goal
    db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);

    // Log data change and invalidate caches
    const currentMonth = getCurrentMonth();
    logDataChange({
      event: 'goal_deleted',
      timestamp: new Date().toISOString(),
      affectedMonths: [currentMonth],
      metadata: { goalId: id },
    });
    invalidateDependentCaches([currentMonth]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
