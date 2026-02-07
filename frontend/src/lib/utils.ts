/**
 * Utility functions for AutoDCA frontend
 */

import { formatUnits as viemFormatUnits, parseUnits as viemParseUnits } from 'viem';
import type { FormatOptions, LadderOrder } from './types';
import { CONSTANTS } from './contracts';

// ============================================================================
// DECIMAL CONVERSION
// ============================================================================

/**
 * Parse human-readable amount to bigint (smallest units)
 * @example parseUnits("1.5", 18) => 1500000000000000000n
 */
export function parseUnits(value: string, decimals: number): bigint {
  if (!value || value === '') return 0n;
  return viemParseUnits(value, decimals);
}

/**
 * Format bigint to human-readable string
 * @example formatUnits(1500000000000000000n, 18) => "1.5"
 */
export function formatUnits(value: bigint, decimals: number, maxDecimals = 6): string {
  const formatted = viemFormatUnits(value, decimals);

  // If no maxDecimals logic needed, return directly
  // But original code had trimming logic.
  // Viem returns string.

  const [integerPart, fractionalPart] = formatted.split('.');

  if (!fractionalPart) return integerPart;

  const trimmed = fractionalPart.slice(0, maxDecimals);
  return trimmed ? `${integerPart}.${trimmed}` : integerPart;
}

/**
 * Format bigint with token symbol
 * @example formatAmount(1500000000000000000n, 18, "WBTC") => "1.5 WBTC"
 */
export function formatAmount(
  value: bigint,
  decimals: number,
  symbol?: string,
  options?: FormatOptions
): string {
  const formatted = formatUnits(value, decimals, options?.decimals);
  const compact = options?.compact ? compactNumber(parseFloat(formatted)) : formatted;

  if (options?.showSymbol && symbol) {
    return `${compact} ${symbol}`;
  }

  return compact;
}

/**
 * Compact large numbers (1500 => "1.5K")
 */
export function compactNumber(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

// ============================================================================
// PRICE FORMATTING
// ============================================================================

/**
 * Format price from 1e8 scale to human-readable USD
 * @example formatPrice(200000000000n) => "$2,000.00"
 */
export function formatPrice(price: bigint, showSymbol = true): string {
  const priceNum = Number(price) / CONSTANTS.PRICE_SCALE;
  const formatted = priceNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return showSymbol ? `$${formatted}` : formatted;
}

/**
 * Parse human-readable price to 1e8 scale
 * @example parsePrice("2000") => 200000000000n
 */
export function parsePrice(price: string): bigint {
  const num = parseFloat(price);
  return BigInt(Math.round(num * CONSTANTS.PRICE_SCALE));
}

// ============================================================================
// PERCENTAGE / BASIS POINTS
// ============================================================================

/**
 * Convert basis points to percentage
 * @example bpsToPercent(200) => "2.00%"
 */
export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

/**
 * Convert percentage to basis points
 * @example percentToBps(2.5) => 250
 */
export function percentToBps(percent: number): number {
  return Math.round(percent * 100);
}

/**
 * Calculate percentage change
 * @example percentChange(100n, 110n) => 10 (%)
 */
export function percentChange(from: bigint, to: bigint): number {
  if (from === 0n) return 0;
  const change = Number((to - from) * 10000n / from) / 100;
  return change;
}

// ============================================================================
// SLIPPAGE CALCULATIONS
// ============================================================================

/**
 * Calculate slippage in basis points
 * @param expectedPrice Current oracle price (1e8)
 * @param executionPrice Actual execution price (1e8)
 * @returns Slippage in basis points (can be negative)
 */
export function calculateSlippageBps(expectedPrice: bigint, executionPrice: bigint): number {
  if (expectedPrice === 0n) return 0;
  const slippage = Number((executionPrice - expectedPrice) * BigInt(CONSTANTS.BPS) / expectedPrice);
  return slippage;
}

/**
 * Apply slippage tolerance to amount
 * @param amount Amount to adjust
 * @param slippageBps Slippage in basis points
 * @param isMinOut If true, reduces amount (for minAmountOut). If false, increases (for maxAmountIn)
 */
export function applySlippage(amount: bigint, slippageBps: number, isMinOut = true): bigint {
  const adjustment = amount * BigInt(slippageBps) / BigInt(CONSTANTS.BPS);
  return isMinOut ? amount - adjustment : amount + adjustment;
}

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format Unix timestamp to human-readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time ago (e.g., "5 minutes ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp * 1000;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Get deadline timestamp (current time + minutes)
 */
export function getDeadline(minutes: number): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}

// ============================================================================
// ADDRESS FORMATTING
// ============================================================================

/**
 * Truncate Ethereum address for display
 * @example truncateAddress("0x1234...5678", 4) => "0x1234...5678"
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Check if two addresses are equal (case-insensitive)
 */
export function addressEquals(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Extract readable error message from contract error
 */
export function parseContractError(error: any): string {
  // viem errors
  if (error?.message) {
    if (error.message.includes('User rejected the request')) return 'Transaction rejected by user';
    if (error.message.includes('insufficient funds')) return 'Insufficient funds';

    // Try to match specific revert reasons often found in viem error messages
    const revertMatch = error.message.match(/reverted with the following reason:\n(.*?)\n/);
    if (revertMatch && revertMatch[1]) return revertMatch[1].trim();

    const shortMessageMatch = error.message.match(/Short Message: (.*?)\n/);
    if (shortMessageMatch && shortMessageMatch[1]) return shortMessageMatch[1].trim();
  }

  // Fallback for logic consistency with previous implementation if any legacy/other checks needed
  if (error?.details) return error.details;
  if (error?.shortMessage) return error.shortMessage;

  return error?.message || 'Unknown error occurred';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate numeric input (positive number)
 */
export function validatePositiveNumber(value: string): boolean {
  if (!value || value === '') return false;
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate BPS value (0-10000)
 */
export function validateBps(value: number): boolean {
  return value >= 0 && value <= CONSTANTS.BPS;
}

/**
 * Validate multiplier (1.0-10.0)
 */
export function validateMultiplier(value: number): boolean {
  return value >= 1.0 && value <= 10.0;
}

// ============================================================================
// LADDER CALCULATIONS (preview)
// ============================================================================

/**
 * Calculate ladder prices for preview (client-side)
 * Matches Escrow.sol _previewOrdersIncreasing logic
 */
export function calculateLadderPreview(
  startPrice: bigint,
  baseAmount: bigint,
  dcaAmount: bigint,
  ladderDepth: number,
  priceDeviationBps: number,
  priceMultiplierBps: number,
  dcaOrderSizeMultiplierBps: number,
): LadderOrder[] {
  const orders: LadderOrder[] = [];

  let delta = (startPrice * BigInt(priceDeviationBps)) / BigInt(CONSTANTS.BPS);
  let price = startPrice;
  let currentOrderSize = dcaAmount;

  // First order (base)
  orders.push({
    index: 0,
    amount: baseAmount,
    price: price,
    priceFormatted: formatPrice(price),
  });

  // Subsequent orders
  for (let i = 1; i < ladderDepth; i++) {
    // Increase delta exponentially
    delta = (delta * BigInt(priceMultiplierBps)) / BigInt(CONSTANTS.BPS);
    price = price + delta;

    orders.push({
      index: i,
      amount: currentOrderSize,
      price: price,
      priceFormatted: formatPrice(price),
    });

    // Increase order size
    currentOrderSize = (currentOrderSize * BigInt(CONSTANTS.BPS + dcaOrderSizeMultiplierBps)) / BigInt(CONSTANTS.BPS);
  }

  return orders;
}

/**
 * Calculate total liquidity required for ladder
 */
export function calculateTotalLiquidity(orders: LadderOrder[]): bigint {
  return orders.reduce((sum, order) => sum + order.amount, 0n);
}

// ============================================================================
// PROFIT CALCULATIONS
// ============================================================================

/**
 * Calculate estimated profit for sell (rebuy)
 */
export function calculateRebuyProfit(
  filledAmount: bigint,
  avgSellPrice: bigint,
  rebuyPrice: bigint,
  decimals: number,
): { profitAmount: bigint; profitPercent: number } {
  // Profit per unit = avgSellPrice - rebuyPrice
  const profitPerUnit = avgSellPrice - rebuyPrice;

  // Total profit = filledAmount * profitPerUnit / PRICE_SCALE
  const profitAmount = (filledAmount * profitPerUnit) / BigInt(CONSTANTS.PRICE_SCALE);

  // Profit percentage
  const profitPercent = Number(profitPerUnit * 10000n / avgSellPrice) / 100;

  return { profitAmount, profitPercent };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const utils = {
  // Decimals
  parseUnits,
  formatUnits,
  formatAmount,
  compactNumber,

  // Price
  formatPrice,
  parsePrice,

  // Percentage
  bpsToPercent,
  percentToBps,
  percentChange,

  // Slippage
  calculateSlippageBps,
  applySlippage,

  // Time
  formatDate,
  formatTimeAgo,
  getDeadline,

  // Address
  truncateAddress,
  addressEquals,

  // Error
  parseContractError,

  // Validation
  validatePositiveNumber,
  validateBps,
  validateMultiplier,

  // Ladder
  calculateLadderPreview,
  calculateTotalLiquidity,

  // Profit
  calculateRebuyProfit,
};
