<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { getContract, type Address } from "viem";
  import { wallet } from "../stores/wallet";
  import { ESCROW_ABI, ERC20_ABI, CONSTANTS } from "../contracts";
  import type { Escrow, BuyEstimate } from "../types";
  import {
    parseUnits,
    formatAmount,
    formatPrice,
    applySlippage,
    getDeadline,
    parseContractError,
    calculateSlippageBps,
  } from "../utils";

  export let isOpen = false;
  export let escrow: Escrow | null = null;

  const dispatch = createEventDispatcher();

  // ============================================================================
  // STATE
  // ============================================================================

  let amount1In = ""; // User input (human-readable)
  let estimate: BuyEstimate | null = null;
  let slippageBps = CONSTANTS.DEFAULT_SLIPPAGE_BPS; // 0.5%
  let deadlineMinutes = CONSTANTS.DEFAULT_DEADLINE_MINUTES; // 10 minutes
  let estimating = false;
  let executing = false;
  let approving = false;
  let error = "";
  let success = "";

  // ============================================================================
  // ESTIMATE BUY OUTPUT
  // ============================================================================

  async function estimateOutput() {
    if (!escrow || !amount1In || !$wallet.publicClient) {
      estimate = null;
      return;
    }

    if (parseFloat(amount1In) <= 0) {
      estimate = null;
      return;
    }

    estimating = true;
    error = "";

    try {
      const escrowContract = getContract({
        address: escrow.address,
        abi: ESCROW_ABI,
        client: $wallet.publicClient,
      });

      const amount1InBigInt = parseUnits(amount1In, escrow.asset1Decimals);

      // estimateBuyOutput returns (uint256 amount0Out, uint256[] memory orderIndices)
      const [amount0Out, orderIndices] =
        (await escrowContract.read.estimateBuyOutput([
          amount1InBigInt,
        ])) as any[];

      // Calculate average execution price
      const averagePrice =
        BigInt(amount0Out) > 0n
          ? (amount1InBigInt * BigInt(CONSTANTS.PRICE_SCALE)) /
            BigInt(amount0Out)
          : 0n;

      // Calculate slippage vs current oracle price
      const slippageBpsCalc = calculateSlippageBps(
        escrow.currentPrice,
        averagePrice,
      );

      estimate = {
        amount0Out: BigInt(amount0Out),
        amount1Required: amount1InBigInt,
        orderIndicesFilled: orderIndices.map((idx: any) => Number(idx)),
        averagePrice,
        slippageBps: slippageBpsCalc,
      };
    } catch (e: any) {
      console.error("Failed to estimate:", e);
      error = `Estimation failed: ${parseContractError(e)}`;
      estimate = null;
    } finally {
      estimating = false;
    }
  }

  // Debounced estimation (wait 500ms after user stops typing)
  let estimateTimeout: any;
  $: {
    amount1In;
    clearTimeout(estimateTimeout);
    estimateTimeout = setTimeout(() => {
      estimateOutput();
    }, 500);
  }

  // ============================================================================
  // EXECUTE BUY
  // ============================================================================

  async function executeBuy() {
    if (
      !escrow ||
      !estimate ||
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
      const asset1Token = getContract({
        address: escrow.asset1,
        abi: ERC20_ABI,
        client: $wallet.publicClient,
      });

      // Step 1: Check and approve asset1
      approving = true;
      const allowance = (await asset1Token.read.allowance([
        $wallet.address,
        escrow.address,
      ])) as bigint;

      approving = false;

      // Step 2: Calculate minAmount0Out with slippage
      const minAmount0Out = applySlippage(
        estimate.amount0Out,
        slippageBps,
        true,
      );

      // Step 3: Execute buy
      const deadline = BigInt(getDeadline(deadlineMinutes));

      const hash = await $wallet.walletClient.writeContract({
        address: escrow.address,
        abi: ESCROW_ABI,
        functionName: "buy",
        args: [estimate.amount1Required, minAmount0Out, deadline],
        account: $wallet.address,
      });

      const receipt = await $wallet.publicClient.waitForTransactionReceipt({
        hash,
      });

      success = `Successfully bought ${formatAmount(estimate.amount0Out, escrow.asset0Decimals)} ${escrow.asset0Symbol}!`;

      // Close modal after 2 seconds
      setTimeout(() => {
        close();
        dispatch("success");
      }, 2000);
    } catch (e: any) {
      console.error("Buy failed:", e);
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
    amount1In = "";
    estimate = null;
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
        <h2>BUY {escrow.asset0Symbol}</h2>
        <button class="btn-close" on:click={close}>&times;</button>
      </header>

      <div class="modal-body">
        <!-- Asset Info -->
        <section class="asset-info">
          <div class="info-row">
            <span class="label">BUYING FROM:</span>
            <span class="value"
              >{escrow.asset0Symbol} → {escrow.asset1Symbol} Escrow</span
            >
          </div>
          <div class="info-row">
            <span class="label">ORACLE PRICE:</span>
            <span class="value">{formatPrice(escrow.currentPrice)}</span>
          </div>
        </section>

        <!-- Amount Input -->
        <section class="input-section">
          <label>
            AMOUNT TO SPEND ({escrow.asset1Symbol}):
            <input
              type="number"
              bind:value={amount1In}
              placeholder="0.00"
              step="0.01"
              min="0"
              disabled={executing}
            />
          </label>
        </section>

        <!-- Estimate Display -->
        {#if estimating}
          <div class="estimate-loading">Estimating...</div>
        {:else if estimate}
          <section class="estimate-box">
            <h3>TRADE PREVIEW</h3>

            <div class="estimate-row main">
              <span class="label">YOU PAY:</span>
              <span class="value">
                {formatAmount(estimate.amount1Required, escrow.asset1Decimals)}
                {escrow.asset1Symbol}
              </span>
            </div>

            <div class="estimate-row main">
              <span class="label">YOU RECEIVE:</span>
              <span class="value highlight">
                ~{formatAmount(estimate.amount0Out, escrow.asset0Decimals)}
                {escrow.asset0Symbol}
              </span>
            </div>

            <div class="estimate-row">
              <span class="label">AVG PRICE:</span>
              <span class="value">{formatPrice(estimate.averagePrice)}</span>
            </div>

            <div class="estimate-row">
              <span class="label">SLIPPAGE:</span>
              <span
                class="value"
                class:warning={Math.abs(estimate.slippageBps) > 100}
                class:error={Math.abs(estimate.slippageBps) > 500}
              >
                {estimate.slippageBps > 0 ? "+" : ""}{(
                  estimate.slippageBps / 100
                ).toFixed(2)}%
              </span>
            </div>

            <!-- Orders Filled -->
            {#if estimate.orderIndicesFilled.length > 0}
              <div class="orders-filled">
                <span class="label">ORDERS FILLED:</span>
                <div class="order-tags">
                  {#each estimate.orderIndicesFilled as orderIdx}
                    <span class="order-tag">#{orderIdx + 1}</span>
                  {/each}
                </div>
              </div>
            {/if}
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
                  // Convert % to BPS
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
            class="btn-primary"
            on:click={executeBuy}
            disabled={!estimate || estimating}
          >
            EXECUTE BUY
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
    max-width: 600px;
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
    font-size: 1.5rem;
    margin: 0;
    color: #00ff41;
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

  .estimate-box h3 {
    font-size: 1.1rem;
    margin: 0 0 1rem 0;
    color: #00ffff;
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

  .estimate-row:last-child {
    margin-bottom: 0;
  }

  .value.highlight {
    color: #00ffff;
    font-size: 1.3rem;
  }

  .value.warning {
    color: #ffaa00;
  }

  .value.error {
    color: #ff0000;
  }

  .orders-filled {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #00ff4133;
  }

  .order-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .order-tag {
    background: #00ff41;
    color: #0a0e14;
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
    font-weight: bold;
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

  .btn-primary:hover:not(:disabled) {
    background: #00ffff;
    box-shadow: 0 0 20px #00ffff66;
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
