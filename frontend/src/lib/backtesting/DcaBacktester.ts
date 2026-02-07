import type { DcaConfig, Candle, BacktestResults, RoundResult, TradeEntry } from './types';

/**
 * DCA Backtesting Engine
 * Ported from dcabot simulation with browser-compatible implementation
 */

export class DcaBacktester {
  private config: DcaConfig;
  private candles: Candle[];
  private capital: number;
  private rounds: RoundResult[] = [];
  private currentRound: Partial<RoundResult> | null = null;
  private equity: { timestamp: number; value: number }[] = [];

  // Round state
  private roundActive = false;
  private baseEntryPrice = 0;
  private nextDcaIndex = 0;
  private baseQuantity = 0;
  private quoteQuantity = 0;
  private totalCostBasis = 0;
  private averageEntryPrice = 0;
  private entries: TradeEntry[] = [];

  constructor(config: DcaConfig, candles: Candle[], initialCapital: number) {
    this.config = config;
    this.candles = candles;
    this.capital = initialCapital;
  }

  /**
   * Run the backtest simulation
   */
  public run(): BacktestResults {
    this.reset();

    for (const candle of this.candles) {
      this.processCandle(candle);
    }

    // Close any open round at the end
    if (this.roundActive) {
      this.forceCloseRound(this.candles[this.candles.length - 1]);
    }

    return this.generateResults();
  }

  private reset(): void {
    this.rounds = [];
    this.currentRound = null;
    this.roundActive = false;
    this.baseEntryPrice = 0;
    this.nextDcaIndex = 0;
    this.baseQuantity = 0;
    this.quoteQuantity = 0;
    this.totalCostBasis = 0;
    this.averageEntryPrice = 0;
    this.entries = [];
    this.equity = [];
  }

  private processCandle(candle: Candle): void {
    const price = candle.close;

    if (!this.roundActive) {
      // Start new round if we have capital
      if (this.capital >= this.config.baseOrderSize) {
        this.startRound(candle);
      }
    } else {
      // Check for DCA trigger
      const dcaTrigger = this.calculateNextDcaTrigger();
      const shouldTriggerDca =
        this.config.side === 'BUY' ? price <= dcaTrigger : price >= dcaTrigger;

      if (shouldTriggerDca && this.nextDcaIndex < this.config.maxDcaOrders) {
        this.executeDca(candle);
      }

      // Check for take-profit trigger
      const tpTrigger = this.calculateTakeProfitTrigger();
      const shouldTriggerTp =
        this.config.side === 'BUY' ? price >= tpTrigger : price <= tpTrigger;

      if (shouldTriggerTp) {
        this.executeTakeProfit(candle);
      }
    }

    // Track equity
    const currentValue = this.calculateCurrentValue(price);
    this.equity.push({ timestamp: candle.timestamp, value: currentValue });
  }

  private startRound(candle: Candle): void {
    const price = candle.close;
    const orderSize = this.config.baseOrderSize;

    // Deduct keeper fee
    const keeperFee = (orderSize * this.config.keeperFeeBps) / 10000;
    const netOrderSize = orderSize - keeperFee;

    if (this.capital < orderSize) return;

    this.capital -= orderSize;
    this.roundActive = true;
    this.baseEntryPrice = price;
    this.nextDcaIndex = 0;

    // Execute base order
    if (this.config.side === 'BUY') {
      const quantity = netOrderSize / price;
      this.baseQuantity = quantity;
      this.totalCostBasis = netOrderSize;
    } else {
      // SELL side: borrow base, sell for quote
      const quantity = netOrderSize / price;
      this.baseQuantity = -quantity; // Negative = short position
      this.quoteQuantity = netOrderSize;
      this.totalCostBasis = netOrderSize;
    }

    this.averageEntryPrice = price;

    this.entries = [
      {
        timestamp: candle.timestamp,
        price,
        type: 'BASE',
        quantity: Math.abs(this.baseQuantity),
        cost: netOrderSize,
      },
    ];

    this.currentRound = {
      roundNumber: this.rounds.length + 1,
      startTimestamp: candle.timestamp,
      entryPrice: price,
      tradesExecuted: 1,
      dcaLevelsUsed: 0,
      entries: [...this.entries],
    };
  }

  private executeDca(candle: Candle): void {
    const price = candle.close;

    // Calculate DCA order size with multiplier
    const baseSize = this.config.dcaOrderSize;
    const multiplier = Math.pow(
      this.config.orderSizeMultiplier / 1000,
      this.nextDcaIndex
    );
    const orderSize = baseSize * multiplier;

    const keeperFee = (orderSize * this.config.keeperFeeBps) / 10000;
    const netOrderSize = orderSize - keeperFee;

    if (this.capital < orderSize) {
      // Insufficient capital, skip this DCA
      this.nextDcaIndex++;
      return;
    }

    this.capital -= orderSize;

    if (this.config.side === 'BUY') {
      const quantity = netOrderSize / price;
      this.baseQuantity += quantity;
      this.totalCostBasis += netOrderSize;
    } else {
      const quantity = netOrderSize / price;
      this.baseQuantity -= quantity; // More short
      this.quoteQuantity += netOrderSize;
      this.totalCostBasis += netOrderSize;
    }

    // Update average entry price (weighted)
    if (this.config.side === 'BUY') {
      this.averageEntryPrice = this.totalCostBasis / this.baseQuantity;
    } else {
      this.averageEntryPrice = this.quoteQuantity / Math.abs(this.baseQuantity);
    }

    this.entries.push({
      timestamp: candle.timestamp,
      price,
      type: 'DCA',
      dcaLevel: this.nextDcaIndex + 1,
      quantity: netOrderSize / price,
      cost: netOrderSize,
    });

    this.nextDcaIndex++;

    if (this.currentRound) {
      this.currentRound.tradesExecuted = (this.currentRound.tradesExecuted || 0) + 1;
      this.currentRound.dcaLevelsUsed = this.nextDcaIndex;
      this.currentRound.averageEntryPrice = this.averageEntryPrice;
    }
  }

  private executeTakeProfit(candle: Candle): void {
    const price = candle.close;

    let proceeds = 0;
    if (this.config.side === 'BUY') {
      // Sell all accumulated base
      proceeds = this.baseQuantity * price;
    } else {
      // Buy back the short position
      const buybackCost = Math.abs(this.baseQuantity) * price;
      proceeds = this.quoteQuantity - buybackCost;
    }

    // Deduct keeper fee
    const keeperFee = (proceeds * this.config.keeperFeeBps) / 10000;
    const netProceeds = proceeds - keeperFee;

    const realizedPnL = netProceeds - this.totalCostBasis;
    const realizedPnLPercent = (realizedPnL / this.totalCostBasis) * 100;

    this.capital += netProceeds;

    this.entries.push({
      timestamp: candle.timestamp,
      price,
      type: 'TAKE_PROFIT',
      quantity: Math.abs(this.baseQuantity),
      cost: netProceeds,
    });

    if (this.currentRound) {
      this.currentRound.endTimestamp = candle.timestamp;
      this.currentRound.exitPrice = price;
      this.currentRound.averageEntryPrice = this.averageEntryPrice;
      this.currentRound.tradesExecuted = (this.currentRound.tradesExecuted || 0) + 1;
      this.currentRound.realizedPnL = realizedPnL;
      this.currentRound.realizedPnLPercent = realizedPnLPercent;
      this.currentRound.entries = [...this.entries];

      this.rounds.push(this.currentRound as RoundResult);
    }

    // Reset round state
    this.roundActive = false;
    this.baseEntryPrice = 0;
    this.nextDcaIndex = 0;
    this.baseQuantity = 0;
    this.quoteQuantity = 0;
    this.totalCostBasis = 0;
    this.averageEntryPrice = 0;
    this.entries = [];
    this.currentRound = null;
  }

  private forceCloseRound(candle: Candle): void {
    // Emergency close at current price
    this.executeTakeProfit(candle);
  }

  private calculateNextDcaTrigger(): number {
    const cumulativeDev = this.calculateCumulativeDeviation(this.nextDcaIndex);

    if (this.config.side === 'BUY') {
      return this.baseEntryPrice * (1 - cumulativeDev / 10000);
    } else {
      return this.baseEntryPrice * (1 + cumulativeDev / 10000);
    }
  }

  private calculateTakeProfitTrigger(): number {
    const tpBps = this.config.takeProfitBps;

    if (this.config.side === 'BUY') {
      return this.averageEntryPrice * (1 + tpBps / 10000);
    } else {
      return this.averageEntryPrice * (1 - tpBps / 10000);
    }
  }

  private calculateCumulativeDeviation(dcaIndex: number): number {
    // sum(dev * mult^i) for i=0 to dcaIndex
    let cumulative = 0;
    const dev = this.config.priceDeviationBps;
    const mult = this.config.deviationMultiplier / 1000;

    for (let i = 0; i <= dcaIndex; i++) {
      cumulative += dev * Math.pow(mult, i);
    }

    return cumulative;
  }

  private calculateCurrentValue(currentPrice: number): number {
    let value = this.capital;

    if (this.roundActive) {
      if (this.config.side === 'BUY') {
        value += this.baseQuantity * currentPrice;
      } else {
        // Value = quote held - cost to buy back short
        value += this.quoteQuantity - Math.abs(this.baseQuantity) * currentPrice;
      }
    }

    return value;
  }

  private generateResults(): BacktestResults {
    const initialCapital = this.candles.length > 0 ? this.equity[0].value : 0;
    const finalValue = this.equity[this.equity.length - 1]?.value || initialCapital;
    const totalReturn = finalValue - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;

    const winningRounds = this.rounds.filter((r) => r.realizedPnL > 0).length;
    const losingRounds = this.rounds.filter((r) => r.realizedPnL <= 0).length;
    const winRate = this.rounds.length > 0 ? (winningRounds / this.rounds.length) * 100 : 0;

    const totalTrades = this.rounds.reduce((sum, r) => sum + r.tradesExecuted, 0);
    const averageRoundPnL =
      this.rounds.length > 0
        ? this.rounds.reduce((sum, r) => sum + r.realizedPnL, 0) / this.rounds.length
        : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = initialCapital;
    for (const point of this.equity) {
      if (point.value > peak) peak = point.value;
      const drawdown = ((peak - point.value) / peak) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      config: this.config,
      startTimestamp: this.candles[0]?.timestamp || 0,
      endTimestamp: this.candles[this.candles.length - 1]?.timestamp || 0,
      initialCapital,
      finalValue,
      totalReturn,
      totalReturnPercent,
      roundsCompleted: this.rounds.length,
      totalTrades,
      winningRounds,
      losingRounds,
      winRate,
      maxDrawdown,
      averageRoundPnL,
      rounds: this.rounds,
      equity: this.equity,
    };
  }
}
