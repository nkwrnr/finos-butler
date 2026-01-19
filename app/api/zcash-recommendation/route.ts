import { NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';
import { generateZcashRecommendation } from '@/lib/zcash-recommendation';

// Initialize database
initDatabase();

export async function GET() {
  try {
    // Get current Zcash price from cache or fetch fresh
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    let priceData = db
      .prepare('SELECT price_usd, fetched_at FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1')
      .get() as { price_usd: number; fetched_at: string } | undefined;

    let currentPrice: number;

    // Check if cache is fresh (less than 5 minutes old)
    const isCacheFresh = priceData &&
      new Date(priceData.fetched_at) > fiveMinutesAgo;

    if (!isCacheFresh) {
      // Fetch fresh price from CoinGecko
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd',
        { next: { revalidate: 300 } }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch Zcash price from CoinGecko');
      }

      const data = await response.json();
      currentPrice = data.zcash.usd;

      // Insert new cache entry
      db.prepare(
        'INSERT INTO zcash_price_cache (price_usd, change_24h, fetched_at) VALUES (?, NULL, ?)'
      ).run(currentPrice, now.toISOString());
    } else {
      currentPrice = priceData.price_usd;
    }

    // Generate recommendation
    const recommendation = await generateZcashRecommendation(currentPrice);

    return NextResponse.json({
      success: true,
      currentPrice,
      recommendation,
    });
  } catch (error) {
    console.error('Error generating Zcash recommendation:', error);
    return NextResponse.json(
      { error: `Failed to generate recommendation: ${error}` },
      { status: 500 }
    );
  }
}
