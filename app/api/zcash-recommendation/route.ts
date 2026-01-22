import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateZcashRecommendation } from '@/lib/zcash-recommendation';

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
      // Fetch fresh price from CoinGecko (no-store prevents stale cached responses)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd',
        { cache: 'no-store' }
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

      // Store in price history for 7-day average calculation
      const today = now.toISOString().split('T')[0];
      db.prepare(
        'INSERT OR REPLACE INTO zcash_price_history (date, price_usd) VALUES (?, ?)'
      ).run(today, currentPrice);
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
