import { NextResponse } from 'next/server';
import { getCategorizationStats } from '@/lib/categorize-transactions';

export async function GET() {
  try {
    const stats = getCategorizationStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting transaction stats:', error);
    return NextResponse.json(
      { error: `Failed to get transaction stats: ${error}` },
      { status: 500 }
    );
  }
}
