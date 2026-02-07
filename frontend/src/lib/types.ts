/**
 * TypeScript types for AutoDCA P2P Grid Trading Frontend
 * Matches Escrow.sol contract architecture
 */

// ============================================================================
// ESCROW TYPES
// ============================================================================

import type { Address, PublicClient, WalletClient } from 'viem';

export interface EscrowParams {
  dcaOrdersSize: number;                // Ladder depth (e.g., 10)
  priceDeviationBPS: number;            // Step size in basis points (e.g., 200 = 2%)
  takeProfitBPS: number;                // Unused, can be 0
  priceMultiplierBPS: number;           // Exponential spacing multiplier (e.g., 11000 = 1.1x)
  dcaOrderSizeMultiplierBPS: number;    // Size scaling multiplier (e.g., 10500 = 1.05x)
  baseOrderAmount: bigint;              // First ladder rung amount
  dcaOrderAmount: bigint;               // Subsequent orders base amount
}

export interface SellOrder {
  amount: bigint;       // Total asset0 in order (smallest units)
  filled: bigint;       // Amount already filled (smallest units)
  price: bigint;        // Price: asset1 per asset0, scaled 1e8
}

export interface Escrow {
  address: Address;
  owner: Address;
  asset0: Address;                   // Token being sold (e.g., WBTC)
  asset1: Address;                   // Token being received (e.g., USDC)
  asset0Symbol: string;
  asset1Symbol: string;
  asset0Decimals: number;
  asset1Decimals: number;
  params: EscrowParams;
  sellOrders: SellOrder[];
  currentPrice: bigint;              // Oracle spot price (1e8 scale)
  availableLiquidity: bigint;        // asset0 balance
  lastExecuteOrder: number;          // Current order cursor
  totalSold: bigint;                 // Total asset0 filled
  averageSellPrice: bigint;          // Weighted avg sell price (1e8 scale)
}

export interface BuyEstimate {
  amount0Out: bigint;                // Estimated asset0 received
  amount1Required: bigint;           // Actual asset1 needed (with rounding)
  orderIndicesFilled: number[];      // Which orders will be filled
  averagePrice: bigint;              // Effective execution price (1e8 scale)
  slippageBps: number;               // Slippage vs current oracle price
}

// ============================================================================
// TRADE TYPES
// ============================================================================

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface Trade {
  type: TradeType;
  escrowAddress: Address;
  trader: Address;                   // buyer or seller address
  asset0Amount: bigint;
  asset1Amount: bigint;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

// ============================================================================
// TOKEN TYPES
// ============================================================================

export interface Token {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export interface TokenBalance {
  token: Token;
  balance: bigint;
  balanceFormatted: string;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

export interface CreateEscrowFormData {
  asset0: string;                    // Asset address or symbol
  asset1: string;
  baseOrderAmount: string;           // Human-readable (e.g., "1.5")
  dcaOrderAmount: string;
  ladderDepth: number;               // dcaOrdersSize
  priceDeviation: number;            // Percentage (e.g., 2 for 2%)
  priceMultiplier: number;           // Multiplier (e.g., 1.1 for 10% increase)
  sizeMultiplier: number;            // Multiplier (e.g., 1.05 for 5% increase)
}

export interface LadderOrder {
  index: number;
  amount: bigint;
  price: bigint;
  priceFormatted: string;
}

export interface BuyModalState {
  isOpen: boolean;
  escrow: Escrow | null;
  amount1In: string;                 // User input (human-readable)
  estimate: BuyEstimate | null;
  slippageBps: number;               // e.g., 50 = 0.5%
  deadlineMinutes: number;           // e.g., 10
}

export interface SellModalState {
  isOpen: boolean;
  escrow: Escrow | null;
  amount0In: string;                 // User input (human-readable)
  estimatedAmount1Out: bigint | null;
  estimatedRebuyPrice: bigint | null;
  slippageBps: number;
  deadlineMinutes: number;
}

// ============================================================================
// WALLET TYPES
// ============================================================================

export interface WalletState {
  address: Address | null;
  chainId: number | null;
  isConnected: boolean;
  publicClient: PublicClient | null;
  walletClient: WalletClient | null;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export enum NotificationType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  INFO = 'INFO',
  WARNING = 'WARNING',
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;                 // Auto-dismiss after ms (0 = manual)
  txHash?: string;                   // Optional transaction link
}

// ============================================================================
// CHAINLINK ORACLE TYPES
// ============================================================================

export interface OraclePrice {
  price: bigint;                     // Price in oracle decimals
  decimals: number;                  // Usually 8 for Chainlink
  updatedAt: number;                 // Unix timestamp
  isStale: boolean;                  // updatedAt > 1 hour ago
}

// ============================================================================
// HISTORICAL DATA TYPES
// ============================================================================

export interface EscrowHistoryEntry {
  timestamp: number;
  blockNumber: number;
  type: 'BUY' | 'SELL' | 'RESET';
  asset0Amount: bigint;
  asset1Amount: bigint;
  price: bigint;
  txHash: string;
}

// ============================================================================
// FORMATTING HELPERS (types for utility functions)
// ============================================================================

export interface FormatOptions {
  decimals?: number;
  showSymbol?: boolean;
  compact?: boolean;                 // 1.5K instead of 1,500
}
