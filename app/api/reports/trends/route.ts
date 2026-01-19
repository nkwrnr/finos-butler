import { NextResponse } from 'next/server';
import { analyzeFinancials } from '@/lib/accounting/monthly-close';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = searchParams.get('months');

    // Default to 3 months if not specified
    const months = monthsParam ? parseInt(monthsParam, 10) : 3;

    // Validate months parameter
    if (isNaN(months) || months < 1 || months > 24) {
      return NextResponse.json(
        { error: 'Invalid months parameter. Must be between 1 and 24' },
        { status: 400 }
      );
    }

    const trends = await analyzeFinancials(months);

    return NextResponse.json(trends);
  } catch (error) {
    console.error('Error analyzing financial trends:', error);
    return NextResponse.json(
      { error: `Failed to analyze financial trends: ${error}` },
      { status: 500 }
    );
  }
}
