export interface DcaConfig {
  side: 'BUY' | 'SELL';
  baseOrderSize: number;
  dcaOrderSize: number;
  priceDeviationBps: number;
  takeProfitBps: number;
  maxDcaOrders: number;
  deviationMultiplier: number;
  orderSizeMultiplier: number;
  keeperFeeBps: number;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RoundResult {
  roundNumber: number;
  startTimestamp: number;
  endTimestamp: number;
  entryPrice: number;
  exitPrice: number;
  averageEntryPrice: number;
  tradesExecuted: number;
  dcaLevelsUsed: number;
  realizedPnL: number;
  realizedPnLPercent: number;
  entries: TradeEntry[];
}

export interface TradeEntry {
  timestamp: number;
  price: number;
  type: 'BASE' | 'DCA' | 'TAKE_PROFIT';
  dcaLevel?: number;
  quantity: number;
  cost: number;
}

export interface BacktestResults {
  config: DcaConfig;
  startTimestamp: number;
  endTimestamp: number;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  roundsCompleted: number;
  totalTrades: number;
  winningRounds: number;
  losingRounds: number;
  winRate: number;
  maxDrawdown: number;
  averageRoundPnL: number;
  rounds: RoundResult[];
  equity: { timestamp: number; value: number }[];
}

export interface HistoricalDataSource {
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
}
