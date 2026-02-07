<script lang="ts">
  import { onMount } from 'svelte';
  import { DcaBacktester } from '../../lib/backtesting/DcaBacktester';
  import {
    fetchHistoricalData,
    generateMockData,
    getDateRangeFromPreset,
    TIME_RANGES,
    type TimeRange,
  } from '../../lib/backtesting/historicalData';
  import type { DcaConfig, BacktestResults } from '../../lib/backtesting/types';
  import { goto } from '$app/navigation';

  // Form state
  let symbol = 'BTC/USDC';
  let side: 'BUY' | 'SELL' = 'BUY';
  let baseOrderSize = 1000;
  let dcaOrderSize = 500;
  let priceDeviationBps = 200; // 2%
  let takeProfitBps = 400; // 4%
  let maxDcaOrders = 5;
  let deviationMultiplier = 1100; // 1.1x
  let orderSizeMultiplier = 1000; // 1.0x (no scaling)
  let keeperFeeBps = 50; // 0.5%
  let timeRange: TimeRange = '90d';
  let initialCapital = 10000;

  // Simulation state
  let running = false;
  let results: BacktestResults | null = null;
  let error = '';

  // Preset configs
  const PRESETS = {
    conservative: {
      label: 'Conservative',
      priceDeviationBps: 300,
      takeProfitBps: 200,
      maxDcaOrders: 3,
      deviationMultiplier: 1000,
      orderSizeMultiplier: 1000,
    },
    balanced: {
      label: 'Balanced',
      priceDeviationBps: 200,
      takeProfitBps: 400,
      maxDcaOrders: 5,
      deviationMultiplier: 1100,
      orderSizeMultiplier: 1000,
    },
    aggressive: {
      label: 'Aggressive',
      priceDeviationBps: 150,
      takeProfitBps: 600,
      maxDcaOrders: 10,
      deviationMultiplier: 1200,
      orderSizeMultiplier: 1500,
    },
  };

  function loadPreset(presetKey: keyof typeof PRESETS) {
    const preset = PRESETS[presetKey];
    priceDeviationBps = preset.priceDeviationBps;
    takeProfitBps = preset.takeProfitBps;
    maxDcaOrders = preset.maxDcaOrders;
    deviationMultiplier = preset.deviationMultiplier;
    orderSizeMultiplier = preset.orderSizeMultiplier;
  }

  async function runBacktest() {
    running = true;
    error = '';
    results = null;

    try {
      // Fetch historical data
      const { start, end } = getDateRangeFromPreset(timeRange);
      let candles;

      try {
        candles = await fetchHistoricalData(symbol, start, end);
      } catch (err) {
        console.warn('Failed to fetch real data, using mock:', err);
        candles = generateMockData(start, end, symbol.includes('BTC') ? 100000 : 4000);
      }

      if (candles.length === 0) {
        throw new Error('No historical data available');
      }

      // Build config
      const config: DcaConfig = {
        side,
        baseOrderSize,
        dcaOrderSize,
        priceDeviationBps,
        takeProfitBps,
        maxDcaOrders,
        deviationMultiplier,
        orderSizeMultiplier,
        keeperFeeBps,
      };

      // Run simulation
      const backtester = new DcaBacktester(config, candles, initialCapital);
      results = backtester.run();
    } catch (err: any) {
      error = err.message || 'Backtest failed';
      console.error('Backtest error:', err);
    } finally {
      running = false;
    }
  }

  function useConfigForLiveOrder() {
    // Pre-fill the create order form and navigate
    const params = new URLSearchParams({
      side,
      baseOrderSize: baseOrderSize.toString(),
      dcaOrderSize: dcaOrderSize.toString(),
      priceDeviationBps: priceDeviationBps.toString(),
      takeProfitBps: takeProfitBps.toString(),
      maxDcaOrders: maxDcaOrders.toString(),
      deviationMultiplier: deviationMultiplier.toString(),
      orderSizeMultiplier: orderSizeMultiplier.toString(),
    });

    goto(`/create?${params.toString()}`);
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatPercent(value: number): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="terminal-container">
  <!-- Scan line effect -->
  <div class="scanline"></div>

  <!-- Header -->
  <header class="terminal-header fade-in">
    <div class="header-content">
      <h1 class="glitch boot-sequence" data-text="BACKTEST_ENGINE_v2.1">BACKTEST_ENGINE_v2.1</h1>
      <div class="status-bar slide-in-right">
        <span class="status-item">SYS_STATUS: <span class="online glow-pulse">ONLINE</span></span>
        <span class="status-item">NODE: <span class="node-id">0x7A9F</span></span>
      </div>
    </div>
  </header>

  <div class="terminal-grid fade-in-stagger">
    <!-- Configuration Panel -->
    <section class="config-panel scale-in">
      <div class="panel-header">
        <span class="panel-title">[CONFIG]</span>
        <div class="panel-indicators">
          <span class="indicator"></span>
          <span class="indicator"></span>
          <span class="indicator active glow-pulse"></span>
        </div>
      </div>

      <div class="config-content">
        <!-- Presets -->
        <div class="preset-selector fade-in-stagger">
          <button on:click={() => loadPreset('conservative')} class="preset-btn hover-glow">
            CONSERVATIVE
          </button>
          <button on:click={() => loadPreset('balanced')} class="preset-btn active hover-glow shimmer">
            BALANCED
          </button>
          <button on:click={() => loadPreset('aggressive')} class="preset-btn hover-glow">
            AGGRESSIVE
          </button>
        </div>

        <!-- Market Config -->
        <div class="config-section">
          <label class="config-label">
            <span class="label-text">SYMBOL</span>
            <select bind:value={symbol} class="terminal-select">
              <option value="BTC/USDC">BTC/USDC</option>
              <option value="ETH/USDC">ETH/USDC</option>
            </select>
          </label>

          <label class="config-label">
            <span class="label-text">SIDE</span>
            <select bind:value={side} class="terminal-select">
              <option value="BUY">BUY [LONG]</option>
              <option value="SELL">SELL [SHORT]</option>
            </select>
          </label>

          <label class="config-label">
            <span class="label-text">TIMEFRAME</span>
            <select bind:value={timeRange} class="terminal-select">
              {#each Object.entries(TIME_RANGES) as [key, { label }]}
                <option value={key}>{label}</option>
              {/each}
            </select>
          </label>
        </div>

        <!-- Order Sizes -->
        <div class="config-section">
          <label class="config-label">
            <span class="label-text">BASE_ORDER_SIZE</span>
            <div class="input-group">
              <input type="number" bind:value={baseOrderSize} class="terminal-input" min="100" step="100" />
              <span class="input-unit">USDC</span>
            </div>
          </label>

          <label class="config-label">
            <span class="label-text">DCA_ORDER_SIZE</span>
            <div class="input-group">
              <input type="number" bind:value={dcaOrderSize} class="terminal-input" min="100" step="100" />
              <span class="input-unit">USDC</span>
            </div>
          </label>

          <label class="config-label">
            <span class="label-text">INITIAL_CAPITAL</span>
            <div class="input-group">
              <input type="number" bind:value={initialCapital} class="terminal-input" min="1000" step="1000" />
              <span class="input-unit">USDC</span>
            </div>
          </label>
        </div>

        <!-- Strategy Parameters -->
        <div class="config-section">
          <label class="config-label">
            <span class="label-text">PRICE_DEVIATION [{(priceDeviationBps / 100).toFixed(2)}%]</span>
            <input
              type="range"
              bind:value={priceDeviationBps}
              min="100"
              max="500"
              step="10"
              class="terminal-slider"
            />
          </label>

          <label class="config-label">
            <span class="label-text">TAKE_PROFIT [{(takeProfitBps / 100).toFixed(2)}%]</span>
            <input
              type="range"
              bind:value={takeProfitBps}
              min="100"
              max="1000"
              step="50"
              class="terminal-slider"
            />
          </label>

          <label class="config-label">
            <span class="label-text">MAX_DCA_ORDERS [{maxDcaOrders}]</span>
            <input
              type="range"
              bind:value={maxDcaOrders}
              min="1"
              max="10"
              step="1"
              class="terminal-slider"
            />
          </label>

          <label class="config-label">
            <span class="label-text">DEVIATION_MULT [{(deviationMultiplier / 1000).toFixed(2)}x]</span>
            <input
              type="range"
              bind:value={deviationMultiplier}
              min="1000"
              max="1600"
              step="50"
              class="terminal-slider"
            />
          </label>

          <label class="config-label">
            <span class="label-text">ORDER_SIZE_MULT [{(orderSizeMultiplier / 1000).toFixed(2)}x]</span>
            <input
              type="range"
              bind:value={orderSizeMultiplier}
              min="1000"
              max="2000"
              step="100"
              class="terminal-slider"
            />
          </label>
        </div>

        <!-- Execute Button -->
        <button on:click={runBacktest} disabled={running} class="execute-btn">
          {#if running}
            <span class="spinner"></span>
            EXECUTING_SIMULATION...
          {:else}
            [RUN_BACKTEST]
          {/if}
        </button>

        {#if error}
          <div class="error-message">
            ERROR: {error}
          </div>
        {/if}
      </div>
    </section>

    <!-- Results Panel -->
    <section class="results-panel scale-in">
      <div class="panel-header">
        <span class="panel-title">[RESULTS]</span>
        {#if results}
          <button on:click={useConfigForLiveOrder} class="deploy-btn hover-glow">
            DEPLOY_CONFIG →
          </button>
        {/if}
      </div>

      {#if results}
        <div class="results-content fade-in">
          <!-- Key Metrics Grid -->
          <div class="metrics-grid fade-in-stagger">
            <div class="metric-card primary stat-bounce hover-lift">
              <div class="metric-label">FINAL_VALUE</div>
              <div class="metric-value glow-pulse">{formatCurrency(results.finalValue)}</div>
              <div class="metric-change glow-pulse" class:positive={results.totalReturn >= 0} class:negative={results.totalReturn < 0}>
                {formatPercent(results.totalReturnPercent)}
              </div>
            </div>

            <div class="metric-card stat-bounce hover-lift">
              <div class="metric-label">ROUNDS</div>
              <div class="metric-value">{results.roundsCompleted}</div>
            </div>

            <div class="metric-card stat-bounce hover-lift">
              <div class="metric-label">WIN_RATE</div>
              <div class="metric-value glow-pulse">{results.winRate.toFixed(1)}%</div>
              <div class="metric-sub">{results.winningRounds}W / {results.losingRounds}L</div>
            </div>

            <div class="metric-card stat-bounce hover-lift">
              <div class="metric-label">MAX_DD</div>
              <div class="metric-value negative">{results.maxDrawdown.toFixed(2)}%</div>
            </div>

            <div class="metric-card stat-bounce hover-lift">
              <div class="metric-label">AVG_PNL</div>
              <div class="metric-value glow-pulse" class:positive={results.averageRoundPnL >= 0} class:negative={results.averageRoundPnL < 0}>
                {formatCurrency(results.averageRoundPnL)}
              </div>
            </div>

            <div class="metric-card stat-bounce hover-lift">
              <div class="metric-label">TRADES</div>
              <div class="metric-value">{results.totalTrades}</div>
            </div>
          </div>

          <!-- Rounds Table -->
          <div class="rounds-section fade-in">
            <h3 class="section-title scale-in">ROUND_HISTORY</h3>
            <div class="table-container">
              <table class="terminal-table">
                <thead>
                  <tr class="fade-in">
                    <th>RND</th>
                    <th>ENTRY</th>
                    <th>EXIT</th>
                    <th>AVG</th>
                    <th>DCAs</th>
                    <th>TRX</th>
                    <th>PNL</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody class="fade-in-stagger">
                  {#each results.rounds as round (round.roundNumber)}
                    <tr class="round-row">
                      <td>#{round.roundNumber}</td>
                      <td>{formatTimestamp(round.startTimestamp)}</td>
                      <td>{formatTimestamp(round.endTimestamp)}</td>
                      <td>${round.averageEntryPrice.toFixed(2)}</td>
                      <td>{round.dcaLevelsUsed}</td>
                      <td>{round.tradesExecuted}</td>
                      <td class:positive={round.realizedPnL >= 0} class:negative={round.realizedPnL < 0}>
                        {formatCurrency(round.realizedPnL)}
                      </td>
                      <td class:positive={round.realizedPnLPercent >= 0} class:negative={round.realizedPnLPercent < 0}>
                        {formatPercent(round.realizedPnLPercent)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon">▸</div>
          <p>NO_DATA_AVAILABLE</p>
          <p class="empty-sub">Execute backtest to display results</p>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Orbitron:wght@700;900&display=swap');

  :global(body) {
    background: #000;
    margin: 0;
    overflow-x: hidden;
  }

  .terminal-container {
    min-height: 100vh;
    background: radial-gradient(ellipse at center, #0a0e1a 0%, #000000 100%);
    color: #00ff41;
    font-family: 'IBM Plex Mono', monospace;
    position: relative;
    padding: 2rem;
  }

  /* Scan line effect */
  .scanline {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(0, 255, 65, 0.02) 50%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 999;
    animation: scan 8s linear infinite;
  }

  @keyframes scan {
    0% {
      transform: translateY(-100%);
    }
    100% {
      transform: translateY(100%);
    }
  }

  /* Header */
  .terminal-header {
    border: 2px solid #00ff41;
    border-bottom: none;
    background: rgba(0, 255, 65, 0.03);
    padding: 1.5rem;
    box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
  }

  .header-content h1 {
    font-family: 'Orbitron', monospace;
    font-size: 2.5rem;
    font-weight: 900;
    margin: 0 0 1rem 0;
    letter-spacing: 0.15em;
    text-shadow: 0 0 10px #00ff41, 0 0 20px #00ff41, 0 0 30px #00ff41;
  }

  .glitch {
    position: relative;
    animation: glitch 3s infinite;
  }

  @keyframes glitch {
    0%, 100% {
      transform: translate(0);
    }
    20%, 60% {
      transform: translate(-2px, 2px);
    }
    40%, 80% {
      transform: translate(2px, -2px);
    }
  }

  .status-bar {
    display: flex;
    gap: 2rem;
    font-size: 0.85rem;
    opacity: 0.8;
  }

  .status-item {
    letter-spacing: 0.1em;
  }

  .online {
    color: #00ff41;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .node-id {
    color: #00d9ff;
    font-weight: 600;
  }

  /* Grid Layout */
  .terminal-grid {
    display: grid;
    grid-template-columns: 450px 1fr;
    gap: 0;
    border: 2px solid #00ff41;
    border-top: none;
    box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
  }

  /* Panel Styling */
  .config-panel,
  .results-panel {
    background: rgba(0, 0, 0, 0.8);
    border-right: 2px solid #00ff41;
  }

  .results-panel {
    border-right: none;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(0, 255, 65, 0.3);
    background: rgba(0, 255, 65, 0.05);
  }

  .panel-title {
    font-family: 'Orbitron', monospace;
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: 0.2em;
    color: #00ff41;
    text-shadow: 0 0 5px #00ff41;
  }

  .panel-indicators {
    display: flex;
    gap: 0.5rem;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(0, 255, 65, 0.2);
    border: 1px solid #00ff41;
  }

  .indicator.active {
    background: #00ff41;
    box-shadow: 0 0 10px #00ff41;
    animation: blink 1.5s infinite;
  }

  @keyframes blink {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* Config Content */
  .config-content {
    padding: 2rem 1.5rem;
  }

  .preset-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .preset-btn {
    background: transparent;
    border: 1px solid rgba(0, 255, 65, 0.3);
    color: #00ff41;
    padding: 0.75rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s;
  }

  .preset-btn:hover {
    background: rgba(0, 255, 65, 0.1);
    border-color: #00ff41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
  }

  .preset-btn.active {
    background: rgba(0, 255, 65, 0.15);
    border-color: #00ff41;
    box-shadow: 0 0 15px rgba(0, 255, 65, 0.5);
  }

  .config-section {
    margin-bottom: 2rem;
  }

  .config-label {
    display: block;
    margin-bottom: 1.5rem;
  }

  .label-text {
    display: block;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
    opacity: 0.7;
    font-weight: 600;
  }

  .terminal-select,
  .terminal-input {
    width: 100%;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    color: #00ff41;
    padding: 0.75rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.9rem;
    outline: none;
  }

  .terminal-select:focus,
  .terminal-input:focus {
    border-color: #00ff41;
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
  }

  .input-group {
    display: flex;
    align-items: center;
  }

  .input-group input {
    flex: 1;
    border-right: none;
  }

  .input-unit {
    background: rgba(0, 255, 65, 0.1);
    border: 1px solid rgba(0, 255, 65, 0.3);
    padding: 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .terminal-slider {
    width: 100%;
    height: 2px;
    background: rgba(0, 255, 65, 0.2);
    outline: none;
    -webkit-appearance: none;
  }

  .terminal-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #00ff41;
    border: 2px solid #000;
    box-shadow: 0 0 10px #00ff41;
    cursor: pointer;
  }

  .terminal-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #00ff41;
    border: 2px solid #000;
    box-shadow: 0 0 10px #00ff41;
    cursor: pointer;
  }

  .execute-btn {
    width: 100%;
    padding: 1.25rem;
    background: rgba(0, 255, 65, 0.1);
    border: 2px solid #00ff41;
    color: #00ff41;
    font-family: 'Orbitron', monospace;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 0 20px rgba(0, 255, 65, 0.2);
  }

  .execute-btn:hover:not(:disabled) {
    background: rgba(0, 255, 65, 0.2);
    box-shadow: 0 0 30px rgba(0, 255, 65, 0.5);
    transform: translateY(-2px);
  }

  .execute-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid rgba(0, 255, 65, 0.3);
    border-top-color: #00ff41;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 0.5rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.5);
    color: #ff0040;
    font-size: 0.85rem;
  }

  /* Results */
  .results-content {
    padding: 2rem 1.5rem;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    padding: 1.25rem;
    position: relative;
  }

  .metric-card.primary {
    grid-column: span 3;
    border-width: 2px;
    border-color: #00ff41;
    box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
  }

  .metric-label {
    font-size: 0.75rem;
    opacity: 0.6;
    letter-spacing: 0.15em;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    font-family: 'Orbitron', monospace;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .primary .metric-value {
    font-size: 3rem;
    text-shadow: 0 0 10px #00ff41;
  }

  .metric-change,
  .metric-sub {
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .positive {
    color: #00ff41;
  }

  .negative {
    color: #ff0040;
  }

  .deploy-btn {
    background: rgba(0, 217, 255, 0.1);
    border: 1px solid #00d9ff;
    color: #00d9ff;
    padding: 0.5rem 1rem;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    cursor: pointer;
    transition: all 0.2s;
  }

  .deploy-btn:hover {
    background: rgba(0, 217, 255, 0.2);
    box-shadow: 0 0 15px rgba(0, 217, 255, 0.5);
  }

  /* Rounds Table */
  .rounds-section {
    margin-top: 3rem;
  }

  .section-title {
    font-family: 'Orbitron', monospace;
    font-size: 1rem;
    letter-spacing: 0.2em;
    margin-bottom: 1rem;
    color: #00ff41;
    text-shadow: 0 0 5px #00ff41;
  }

  .table-container {
    overflow-x: auto;
    border: 1px solid rgba(0, 255, 65, 0.3);
  }

  .terminal-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .terminal-table thead {
    background: rgba(0, 255, 65, 0.1);
  }

  .terminal-table th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.1em;
    border-bottom: 2px solid rgba(0, 255, 65, 0.5);
  }

  .terminal-table td {
    padding: 0.75rem;
    border-bottom: 1px solid rgba(0, 255, 65, 0.1);
  }

  .round-row:hover {
    background: rgba(0, 255, 65, 0.05);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    opacity: 0.5;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: blink 2s infinite;
  }

  .empty-sub {
    font-size: 0.85rem;
    opacity: 0.6;
  }

  @media (max-width: 1200px) {
    .terminal-grid {
      grid-template-columns: 1fr;
    }

    .config-panel {
      border-right: none;
      border-bottom: 2px solid #00ff41;
    }
  }
</style>
