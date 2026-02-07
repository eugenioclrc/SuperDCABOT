import type { Candle } from './types';

/**
 * Fetch historical price data from CoinGecko API
 * For MVP, we use CoinGecko's free API (no key required)
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const SYMBOL_MAP: Record<string, string> = {
  'BTC/USDC': 'bitcoin',
  'ETH/USDC': 'ethereum',
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
};

export async function fetchHistoricalData(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<Candle[]> {
  const coinId = SYMBOL_MAP[symbol];
  if (!coinId) {
    throw new Error(`Unsupported symbol: ${symbol}`);
  }

  const from = Math.floor(startDate.getTime() / 1000);
  const to = Math.floor(endDate.getTime() / 1000);

  try {
    const response = await fetch(
      `${COINGECKO_BASE}/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // CoinGecko returns: { prices: [[timestamp, price], ...] }
    // We need to convert to OHLC candles
    // For simplicity, we'll create hourly candles from the price data
    const candles = convertToCandles(data.prices);

    return candles;
  } catch (error) {
    console.error('Failed to fetch historical data:', error);
    throw error;
  }
}

/**
 * Convert CoinGecko price data to OHLC candles
 * Groups prices into hourly buckets
 */
function convertToCandles(prices: [number, number][]): Candle[] {
  if (prices.length === 0) return [];

  const HOUR_MS = 60 * 60 * 1000;
  const candles: Candle[] = [];

  let currentHour = Math.floor(prices[0][0] / HOUR_MS) * HOUR_MS;
  let hourPrices: number[] = [];

  for (const [timestamp, price] of prices) {
    const hour = Math.floor(timestamp / HOUR_MS) * HOUR_MS;

    if (hour !== currentHour) {
      // Complete the current candle
      if (hourPrices.length > 0) {
        candles.push({
          timestamp: currentHour,
          open: hourPrices[0],
          high: Math.max(...hourPrices),
          low: Math.min(...hourPrices),
          close: hourPrices[hourPrices.length - 1],
          volume: 0, // CoinGecko free API doesn't provide volume in range query
        });
      }

      // Start new candle
      currentHour = hour;
      hourPrices = [price];
    } else {
      hourPrices.push(price);
    }
  }

  // Add final candle
  if (hourPrices.length > 0) {
    candles.push({
      timestamp: currentHour,
      open: hourPrices[0],
      high: Math.max(...hourPrices),
      low: Math.min(...hourPrices),
      close: hourPrices[hourPrices.length - 1],
      volume: 0,
    });
  }

  return candles;
}

/**
 * Mock historical data for testing (fallback if API fails)
 */
export function generateMockData(
  startDate: Date,
  endDate: Date,
  basePrice: number = 100000
): Candle[] {
  const candles: Candle[] = [];
  const HOUR_MS = 60 * 60 * 1000;

  let currentTime = startDate.getTime();
  let price = basePrice;

  while (currentTime <= endDate.getTime()) {
    // Random walk with volatility
    const volatility = 0.02; // 2% per hour max
    const change = (Math.random() - 0.5) * 2 * volatility;
    price = price * (1 + change);

    const open = price;
    const close = price * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);

    candles.push({
      timestamp: currentTime,
      open,
      high,
      low,
      close,
      volume: Math.random() * 1000000,
    });

    currentTime += HOUR_MS;
    price = close;
  }

  return candles;
}

/**
 * Get preset time ranges
 */
export const TIME_RANGES = {
  '7d': { label: 'Last 7 Days', days: 7 },
  '30d': { label: 'Last 30 Days', days: 30 },
  '90d': { label: 'Last 90 Days', days: 90 },
  '1y': { label: 'Last Year', days: 365 },
} as const;

export type TimeRange = keyof typeof TIME_RANGES;

export function getDateRangeFromPreset(preset: TimeRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - TIME_RANGES[preset].days);

  return { start, end };
}
