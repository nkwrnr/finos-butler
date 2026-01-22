import { NextResponse } from 'next/server';
import db, { initDatabase } from '@/lib/db';

// Initialize database
initDatabase();

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    // Check cache first
    const cached = db.prepare(
      'SELECT * FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1'
    ).get() as { price_usd: number; change_24h: number | null; fetched_at: string } | undefined;

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (age < CACHE_DURATION_MS) {
        return NextResponse.json({
          price: cached.price_usd,
          change_24h: cached.change_24h,
          cached: true,
          timestamp: cached.fetched_at,
        });
      }
    }

    // Fetch from CoinGecko (no-store prevents stale cached responses)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd&include_24hr_change=true',
      { cache: 'no-store' }
    );

    if (!response.ok) {
      // Return cached data if API fails
      if (cached) {
        return NextResponse.json({
          price: cached.price_usd,
          change_24h: cached.change_24h,
          cached: true,
          timestamp: cached.fetched_at,
          error: 'API failed, using cached data',
        });
      }
      throw new Error('Failed to fetch price and no cache available');
    }

    const data = await response.json();
    const price = data.zcash.usd;
    const change24h = data.zcash.usd_24h_change || null;

    // Update cache
    db.prepare(
      'INSERT INTO zcash_price_cache (price_usd, change_24h) VALUES (?, ?)'
    ).run(price, change24h);

    // Store in price history for 7-day average calculation (upsert for today)
    const today = new Date().toISOString().split('T')[0];
    db.prepare(
      'INSERT OR REPLACE INTO zcash_price_history (date, price_usd) VALUES (?, ?)'
    ).run(today, price);

    // Create daily snapshot if one doesn't exist for today
    const existingSnapshot = db.prepare(
      'SELECT id FROM zcash_snapshots WHERE snapshot_date = ?'
    ).get(today);

    if (!existingSnapshot) {
      const totalResult = db.prepare('SELECT SUM(zec_amount) as total_zec FROM zcash_sources')
        .get() as { total_zec: number | null };
      const totalZec = totalResult.total_zec || 0;
      const totalValue = totalZec * price;

      db.prepare(
        'INSERT INTO zcash_snapshots (snapshot_date, price_usd, total_zec, total_value_usd) VALUES (?, ?, ?, ?)'
      ).run(today, price, totalZec, totalValue);
    }

    return NextResponse.json({
      price,
      change_24h: change24h,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Zcash price:', error);

    // Try to return cached data as fallback
    const cached = db.prepare(
      'SELECT * FROM zcash_price_cache ORDER BY fetched_at DESC LIMIT 1'
    ).get() as { price_usd: number; change_24h: number | null; fetched_at: string } | undefined;

    if (cached) {
      return NextResponse.json({
        price: cached.price_usd,
        change_24h: cached.change_24h,
        cached: true,
        timestamp: cached.fetched_at,
        error: 'API failed, using cached data',
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch Zcash price and no cache available' },
      { status: 500 }
    );
  }
}
