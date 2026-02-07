<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { getContract, type Address } from "viem";
  import { wallet } from "../stores/wallet";
  import { ESCROW_ABI, ERC20_ABI, CONSTANTS } from "../contracts";
  import type { Escrow } from "../types";
  import {
    parseUnits,
    formatAmount,
    formatPrice,
    applySlippage,
    getDeadline,
    parseContractError,
    calculateRebuyProfit,
  } from "../utils";

  export let isOpen = false;
  export let escrow: Escrow | null = null;

  const dispatch = createEventDispatcher();

  // ============================================================================
  // STATE
  // ============================================================================

  let amount0In = ""; // User input (human-readable)
  let estimatedAmount1Out: bigint | null = null;
  let estimatedRebuyPrice: bigint | null = null;
  let slippageBps = CONSTANTS.DEFAULT_SLIPPAGE_BPS; // 0.5%
  let deadlineMinutes = CONSTANTS.DEFAULT_DEADLINE_MINUTES; // 10 minutes
  let estimating = false;
  let executing = false;
  let approving = false;
  let error = "";
  let success = "";

  // ============================================================================
  // ESTIMATE SELL OUTPUT
  // ============================================================================

  async function estimateOutput() {
    if (!escrow || !amount0In) {
      estimatedAmount1Out = null;
      estimatedRebuyPrice = null;
      return;
    }

    if (parseFloat(amount0In) <= 0) {
      estimatedAmount1Out = null;
      estimatedRebuyPrice = null;
      return;
    }

    estimating = true;
    error = "";

    try {
      const amount0InBigInt = parseUnits(amount0In, escrow.asset0Decimals);

      // Calculate estimated rebuy price
      // avgSell = escrow.averageSellPrice
      // start = avgSell * (10000 - priceDeviationBPS) / 10000
      const avgSell = escrow.averageSellPrice;
      const start =
        (avgSell * BigInt(CONSTANTS.BPS - escrow.params.priceDeviationBPS)) /
        BigInt(CONSTANTS.BPS);

      estimatedRebuyPrice = start;

      // Estimate amount1 received
      // This is simplified - actual calculation is more complex (iterates through filled orders)
      // For MVP, use start price as estimate
      estimatedAmount1Out =
        (amount0InBigInt * start) / BigInt(CONSTANTS.PRICE_SCALE);
    } catch (e: any) {
      console.error("Failed to estimate:", e);
      error = `Estimation failed: ${parseContractError(e)}`;
      estimatedAmount1Out = null;
      estimatedRebuyPrice = null;
    } finally {
      estimating = false;
    }
  }

  // Debounced estimation
  let estimateTimeout: any;
  $: {
    amount0In;
    clearTimeout(estimateTimeout);
    estimateTimeout = setTimeout(() => {
      estimateOutput();
    }, 500);
  }

  // ============================================================================
  // PROFIT CALCULATION
  // ============================================================================

  $: profitData =
    escrow && estimatedRebuyPrice
      ? calculateRebuyProfit(
          escrow.totalSold,
          escrow.averageSellPrice,
          estimatedRebuyPrice,
          escrow.asset0Decimals,
        )
      : null;

  // ============================================================================
  // EXECUTE SELL
  // ============================================================================

  async function executeSell() {
    if (
      !escrow ||
      !estimatedAmount1Out ||
      !$wallet.walletClient ||
      !$wallet.publicClient ||
      !$wallet.address
    ) {
      error = "Invalid state: connect wallet";
      return;
    }

    executing = true;
    error = "";
    success = "";

    try {
      const asset0Token = getContract({
        address: escrow.asset0,
        abi: ERC20_ABI,
        client: $wallet.publicClient,
      });

      // Step 1: Check and approve asset0
      approving = true;
      const amount0InBigInt = parseUnits(amount0In, escrow.asset0Decimals);
      const allowance = (await asset0Token.read.allowance([
        $wallet.address,
        escrow.address,
      ])) as bigint;

      approving = false;

      // Step 2: Calculate minAmount1Out with slippage
      const minAmount1Out = applySlippage(
        estimatedAmount1Out,
        slippageBps,
        true,
      );

      // Step 3: Execute sell (triggers reset!)
      // sell(uint256 amount0In, uint256 minAmount1Out, uint256 deadline)
      const deadline = BigInt(getDeadline(deadlineMinutes));

      const hash = await $wallet.walletClient.writeContract({
        address: escrow.address,
        abi: ESCROW_ABI,
        functionName: "sell",
        args: [amount0InBigInt, minAmount1Out, deadline],
        account: $wallet.address,
      });

      const receipt = await $wallet.publicClient.waitForTransactionReceipt({
        hash,
      });

      success = `Successfully sold ${amount0In} ${escrow.asset0Symbol} and reset ladder!`;

      // Close modal after 2 seconds
      setTimeout(() => {
        close();
        dispatch("success");
      }, 2000);
    } catch (e: any) {
      console.error("Sell failed:", e);
      error = parseContractError(e);
    } finally {
      executing = false;
      approving = false;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  function close() {
    isOpen = false;
    amount0In = "";
    estimatedAmount1Out = null;
    estimatedRebuyPrice = null;
    error = "";
    success = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }

  onMount(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

{#if isOpen && escrow}
  <div class="modal-overlay" on:click={close}>
    <div class="modal" on:click|stopPropagation>
      <header>
        <h2>SELL {escrow.asset0Symbol} & RESET LADDER</h2>
        <button class="btn-close" on:click={close}>&times;</button>
      </header>

      <div class="modal-body">
        <!-- Warning -->
        <div class="warning-box">
          <div class="warning-icon">⚠️</div>
          <div class="warning-content">
            <strong>WARNING: THIS TRIGGERS A FULL LADDER RESET!</strong>
            <p>
              Selling {escrow.asset0Symbol} back to the escrow will regenerate the
              entire sell ladder at the current oracle price. This is the "rebuy"
              step in the grid trading cycle.
            </p>
          </div>
        </div>

        <!-- Asset Info -->
        <section class="asset-info">
          <div class="info-row">
            <span class="label">ESCROW:</span>
            <span class="value"
              >{escrow.asset0Symbol} → {escrow.asset1Symbol}</span
            >
          </div>
          <div class="info-row">
            <span class="label">CURRENT ORACLE PRICE:</span>
            <span class="value">{formatPrice(escrow.currentPrice)}</span>
          </div>
          <div class="info-row">
            <span class="label">AVG SELL PRICE:</span>
            <span class="value">{formatPrice(escrow.averageSellPrice)}</span>
          </div>
        </section>

        <!-- Amount Input -->
        <section class="input-section">
          <label>
            AMOUNT TO SELL ({escrow.asset0Symbol}):
            <input
              type="number"
              bind:value={amount0In}
              placeholder="0.00"
              step="0.001"
              min="0"
              max={formatAmount(escrow.totalSold, escrow.asset0Decimals)}
              disabled={executing}
            />
            <span class="hint">
              Max: {formatAmount(escrow.totalSold, escrow.asset0Decimals)} (total
              sold)
            </span>
          </label>
        </section>

        <!-- Estimate Display -->
        {#if estimating}
          <div class="estimate-loading">Estimating...</div>
        {:else if estimatedAmount1Out && estimatedRebuyPrice}
          <section class="estimate-box">
            <h3>REBUY PREVIEW</h3>

            <div class="estimate-row main">
              <span class="label">YOU SELL:</span>
              <span class="value">
                {amount0In}
                {escrow.asset0Symbol}
              </span>
            </div>

            <div class="estimate-row main">
              <span class="label">YOU RECEIVE:</span>
              <span class="value highlight">
                ~{formatAmount(estimatedAmount1Out, escrow.asset1Decimals)}
                {escrow.asset1Symbol}
              </span>
            </div>

            <div class="estimate-row">
              <span class="label">REBUY PRICE:</span>
              <span class="value">{formatPrice(estimatedRebuyPrice)}</span>
            </div>

            <!-- Profit Calculation -->
            {#if profitData}
              <div class="profit-section">
                <h4>PROFIT CALCULATION</h4>
                <div class="estimate-row">
                  <span class="label">AVG SELL:</span>
                  <span class="value"
                    >{formatPrice(escrow.averageSellPrice)}</span
                  >
                </div>
                <div class="estimate-row">
                  <span class="label">REBUY AT:</span>
                  <span class="value">{formatPrice(estimatedRebuyPrice)}</span>
                </div>
                <div class="estimate-row profit">
                  <span class="label">PROFIT:</span>
                  <span
                    class="value"
                    class:positive={profitData.profitPercent > 0}
                    class:negative={profitData.profitPercent < 0}
                  >
                    {profitData.profitPercent > 0
                      ? "+"
                      : ""}{profitData.profitPercent.toFixed(2)}% ({profitData.profitPercent >
                    0
                      ? "+"
                      : ""}{formatAmount(
                      profitData.profitAmount,
                      escrow.asset1Decimals,
                    )}
                    {escrow.asset1Symbol})
                  </span>
                </div>
              </div>
            {/if}

            <!-- After Reset -->
            <div class="reset-info">
              <h4>AFTER RESET:</h4>
              <p>
                New sell ladder will be generated starting at the current oracle
                price of
                <strong>{formatPrice(escrow.currentPrice)}</strong>.
              </p>
              <p>
                Available liquidity will be:{" "}
                {formatAmount(
                  escrow.availableLiquidity +
                    parseUnits(amount0In || "0", escrow.asset0Decimals),
                  escrow.asset0Decimals,
                )}
                {escrow.asset0Symbol}
              </p>
            </div>
          </section>
        {/if}

        <!-- Settings -->
        <section class="settings">
          <div class="setting-row">
            <label>
              SLIPPAGE TOLERANCE (%):
              <input
                type="number"
                bind:value={slippageBps}
                min="0"
                max={CONSTANTS.MAX_SLIPPAGE_BPS / 100}
                step="0.1"
                disabled={executing}
                on:input={(e) => {
                  slippageBps = parseFloat(e.currentTarget.value) * 100;
                }}
              />
            </label>
          </div>

          <div class="setting-row">
            <label>
              DEADLINE (minutes):
              <input
                type="number"
                bind:value={deadlineMinutes}
                min="1"
                max="60"
                disabled={executing}
              />
            </label>
          </div>
        </section>

        <!-- Messages -->
        {#if error}
          <div class="message error">ERROR: {error}</div>
        {/if}
        {#if success}
          <div class="message success">SUCCESS: {success}</div>
        {/if}
      </div>

      <footer>
        <button class="btn-secondary" on:click={close} disabled={executing}
          >CANCEL</button
        >
        {#if executing}
          <button class="btn-primary" disabled>
            {approving ? "APPROVING..." : "EXECUTING..."}
          </button>
        {:else}
          <button
            class="btn-primary warning"
            on:click={executeSell}
            disabled={!estimatedAmount1Out || estimating}
          >
            EXECUTE SELL & RESET
          </button>
        {/if}
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }

  .modal {
    background: #0a0e14;
    border: 2px solid #00ff41;
    max-width: 700px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    font-family: "Courier New", monospace;
    color: #00ff41;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 2px solid #00ff41;
  }

  h2 {
    font-size: 1.3rem;
    margin: 0;
    color: #ffaa00;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: #00ff41;
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
  }

  .btn-close:hover {
    color: #ff0000;
  }

  .modal-body {
    padding: 1.5rem;
  }

  section {
    margin-bottom: 1.5rem;
  }

  /* Warning */
  .warning-box {
    display: flex;
    gap: 1rem;
    background: #ffaa0011;
    border: 2px solid #ffaa00;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .warning-icon {
    font-size: 2rem;
  }

  .warning-content strong {
    display: block;
    color: #ffaa00;
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
  }

  .warning-content p {
    margin: 0.5rem 0 0 0;
    opacity: 0.9;
    font-size: 0.95rem;
  }

  /* Asset Info */
  .asset-info {
    background: #0f1419;
    border: 1px solid #00ff4133;
    padding: 1rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .info-row:last-child {
    margin-bottom: 0;
  }

  /* Input */
  .input-section label {
    display: block;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  input[type="number"] {
    width: 100%;
    background: #0a0e14;
    border: 2px solid #00ff41;
    color: #00ff41;
    padding: 0.8rem;
    font-family: "Courier New", monospace;
    font-size: 1.1rem;
  }

  input[type="number"]:focus {
    outline: none;
    border-color: #00ffff;
    box-shadow: 0 0 10px #00ffff66;
  }

  input[type="number"]:disabled {
    opacity: 0.5;
  }

  .hint {
    display: block;
    font-size: 0.8rem;
    opacity: 0.6;
    margin-top: 0.3rem;
  }

  /* Estimate */
  .estimate-loading {
    text-align: center;
    padding: 2rem;
    opacity: 0.7;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }

  .estimate-box {
    background: #0f1419;
    border: 2px solid #00ffff;
    padding: 1.5rem;
  }

  .estimate-box h3,
  .estimate-box h4 {
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    color: #00ffff;
  }

  .estimate-box h4 {
    font-size: 1rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #00ff4133;
  }

  .estimate-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.8rem;
    font-size: 0.95rem;
  }

  .estimate-row.main {
    font-size: 1.1rem;
    font-weight: bold;
  }

  .estimate-row.profit {
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0.5rem 0;
    border-top: 1px solid #00ff4133;
    border-bottom: 1px solid #00ff4133;
  }

  .value.highlight {
    color: #00ffff;
    font-size: 1.3rem;
  }

  .value.positive {
    color: #00ff00;
  }

  .value.negative {
    color: #ff0000;
  }

  .profit-section {
    margin-top: 1rem;
  }

  .reset-info {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #00ff4111;
    border: 1px solid #00ff4133;
  }

  .reset-info h4 {
    margin: 0 0 0.8rem 0;
    color: #00ffff;
  }

  .reset-info p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .reset-info strong {
    color: #00ffff;
  }

  /* Settings */
  .settings {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .setting-row label {
    display: block;
    font-size: 0.85rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .setting-row input {
    width: 100%;
    padding: 0.5rem;
    font-size: 0.9rem;
  }

  /* Messages */
  .message {
    padding: 1rem;
    border: 2px solid;
    font-weight: bold;
    margin-bottom: 1rem;
  }

  .message.error {
    border-color: #ff0000;
    color: #ff0000;
    background: #ff000011;
  }

  .message.success {
    border-color: #00ff00;
    color: #00ff00;
    background: #00ff0011;
  }

  /* Footer */
  footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 2px solid #00ff41;
  }

  button {
    padding: 1rem;
    font-family: "Courier New", monospace;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: transparent;
    border: 2px solid #00ff41;
    color: #00ff41;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #00ff4133;
  }

  .btn-primary {
    background: #00ff41;
    color: #0a0e14;
  }

  .btn-primary.warning {
    background: #ffaa00;
    color: #0a0e14;
  }

  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 0 20px #00ffff66;
  }

  .btn-primary.warning:hover:not(:disabled) {
    background: #ffdd00;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .label {
    opacity: 0.7;
  }

  .value {
    font-weight: bold;
  }
</style>
