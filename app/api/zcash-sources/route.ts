import { NextRequest, NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

export async function GET() {
  try {
    const sources = db.prepare('SELECT * FROM zcash_sources ORDER BY source_name').all();

    // Calculate total
    const total = db.prepare('SELECT SUM(zec_amount) as total_zec, SUM(cost_basis_usd) as total_cost_basis FROM zcash_sources')
      .get() as { total_zec: number | null; total_cost_basis: number | null };

    return NextResponse.json({
      sources,
      total: {
        zec: total.total_zec || 0,
        cost_basis: total.total_cost_basis || null,
      },
    });
  } catch (error) {
    console.error('Error fetching Zcash sources:', error);
    return NextResponse.json({ error: 'Failed to fetch Zcash sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_name } = body;

    if (!source_name) {
      return NextResponse.json({ error: 'Source name is required' }, { status: 400 });
    }

    const result = db.prepare(
      'INSERT INTO zcash_sources (source_name, zec_amount, cost_basis_usd) VALUES (?, 0, NULL)'
    ).run(source_name);

    const newSource = db.prepare('SELECT * FROM zcash_sources WHERE id = ?')
      .get(result.lastInsertRowid);

    return NextResponse.json(newSource);
  } catch (error) {
    console.error('Error creating Zcash source:', error);
    return NextResponse.json({ error: 'Failed to create Zcash source' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, zec_amount, cost_basis_usd } = body;

    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    db.prepare(
      'UPDATE zcash_sources SET zec_amount = ?, cost_basis_usd = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(zec_amount || 0, cost_basis_usd === null || cost_basis_usd === undefined ? null : cost_basis_usd, id);

    const updatedSource = db.prepare('SELECT * FROM zcash_sources WHERE id = ?').get(id);

    return NextResponse.json(updatedSource);
  } catch (error) {
    console.error('Error updating Zcash source:', error);
    return NextResponse.json({ error: 'Failed to update Zcash source' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    db.prepare('DELETE FROM zcash_sources WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Zcash source:', error);
    return NextResponse.json({ error: 'Failed to delete Zcash source' }, { status: 500 });
  }
}
