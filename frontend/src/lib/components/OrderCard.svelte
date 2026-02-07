<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { getContract, formatUnits, type Address } from "viem";
  import { wallet } from "../stores/wallet";
  import { CONTRACT_ADDRESSES, ORDER_BOOK_ABI } from "../contracts";
  import {
    Side,
    TriggerType,
    ProfitMode,
    type Order,
    type RoundState,
  } from "../types";

  export let order: Order;

  const dispatch = createEventDispatcher();

  let roundState: RoundState | null = null;
  let cancelling = false;
  let withdrawing = false;

  async function loadRoundState() {
    if (!$wallet.publicClient) return;

    try {
      const orderBook = getContract({
        address: CONTRACT_ADDRESSES.orderBook as Address,
        abi: ORDER_BOOK_ABI,
        client: $wallet.publicClient,
      });

      const [active, nextTrigger, triggerType, estimatedProfit] =
        (await orderBook.read.getRoundState([order.orderId])) as any[];

      roundState = {
        active,
        nextTrigger,
        triggerType,
        estimatedProfit,
      };
    } catch (err) {
      console.error("Failed to load round state:", err);
    }
  }

  async function cancelOrder() {
    if (
      !$wallet.walletClient ||
      !confirm("Are you sure you want to cancel this order?")
    )
      return;

    cancelling = true;

    try {
      const hash = await $wallet.walletClient.writeContract({
        address: CONTRACT_ADDRESSES.orderBook as Address,
        abi: ORDER_BOOK_ABI,
        functionName: "cancelOrder",
        args: [order.orderId],
        account: $wallet.address as Address,
      });

      await $wallet.publicClient?.waitForTransactionReceipt({ hash });

      alert("Order cancelled successfully!");
      dispatch("updated");
    } catch (err: any) {
      alert(`Failed to cancel order: ${err.message}`);
    } finally {
      cancelling = false;
    }
  }

  async function withdrawProfits() {
    if (!$wallet.walletClient) return;

    withdrawing = true;

    try {
      const hash = await $wallet.walletClient.writeContract({
        address: CONTRACT_ADDRESSES.orderBook as Address,
        abi: ORDER_BOOK_ABI,
        functionName: "withdrawProfits",
        args: [order.orderId],
        account: $wallet.address as Address,
      });

      await $wallet.publicClient?.waitForTransactionReceipt({ hash });

      alert("Profits withdrawn successfully!");
      dispatch("updated");
    } catch (err: any) {
      alert(`Failed to withdraw profits: ${err.message}`);
    } finally {
      withdrawing = false;
    }
  }

  function getSideName(side: Side): string {
    return side === Side.BUY ? "BUY" : "SELL";
  }

  function getTriggerTypeName(type: TriggerType): string {
    switch (type) {
      case TriggerType.BASE:
        return "BASE ORDER";
      case TriggerType.DCA:
        return "DCA";
      case TriggerType.TAKE_PROFIT:
        return "TAKE PROFIT";
      default:
        return "UNKNOWN";
    }
  }

  function formatPrice(price: bigint): string {
    return formatUnits(price, 18);
  }

  function formatUSDC(amount: bigint): string {
    return formatUnits(amount, 6);
  }

  $: loadRoundState();
</script>

<div
  class="terminal-panel order-card hover-lift"
  class:round-active={order.roundActive}
>
  <!-- Card Header -->
  <div class="terminal-panel-header">
    <div>
      <h3 class="terminal-panel-title">
        ORDER_#{order.orderId.toString().padStart(4, "0")}
      </h3>
      <span
        class="badge"
        class:badge-success={order.side === Side.BUY}
        class:badge-danger={order.side === Side.SELL}
      >
        {getSideName(order.side)} [{order.side === Side.BUY ? "LONG" : "SHORT"}]
      </span>
    </div>
  </div>

  <!-- Card Body -->
  <div class="order-body">
    <!-- Status Indicator -->
    <div class="status-row mb-4">
      <span class="label">SYSTEM_STATUS:</span>
      {#if order.roundActive}
        <span class="badge badge-success">● ROUND_ACTIVE</span>
      {:else}
        <span class="badge badge-info">○ IDLE_AWAIT</span>
      {/if}
    </div>

    {#if order.roundActive}
      <!-- Active Round Info -->
      <div class="round-active-panel mb-4">
        <p class="label mb-2 text-glow-green">◆ ROUND_EXECUTION_STATE</p>

        <div class="data-row">
          <span class="data-label">DCA_LEVEL:</span>
          <span class="data-value numeric text-glow-cyan glow-pulse">
            {order.nextDcaIndex.toString()} / {order.maxDcaOrders.toString()}
          </span>
        </div>

        <div class="data-row">
          <span class="data-label">ENTRY_PRICE:</span>
          <span class="data-value numeric"
            >${parseFloat(formatPrice(order.baseEntryPrice)).toFixed(2)}</span
          >
        </div>

        {#if order.averageEntryPrice > 0n}
          <div class="data-row">
            <span class="data-label">AVG_ENTRY:</span>
            <span class="data-value numeric text-glow-amber"
              >${parseFloat(formatPrice(order.averageEntryPrice)).toFixed(
                2,
              )}</span
            >
          </div>
        {/if}

        <div class="data-row">
          <span class="data-label">BASE_QTY:</span>
          <span class="data-value numeric"
            >{parseFloat(formatUSDC(order.baseQuantity)).toFixed(6)}</span
          >
        </div>

        {#if roundState}
          <div class="data-row">
            <span class="data-label">NEXT_TRIGGER:</span>
            <span class="data-value numeric text-glow-green">
              {getTriggerTypeName(roundState.triggerType)} @ ${parseFloat(
                formatPrice(roundState.nextTrigger),
              ).toFixed(2)}
            </span>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Idle Configuration -->
      <div class="data-row">
        <span class="data-label">BASE_ORDER:</span>
        <span class="data-value numeric"
          >${formatUSDC(order.baseOrderSize)} USDC</span
        >
      </div>

      <div class="data-row">
        <span class="data-label">DCA_ORDER:</span>
        <span class="data-value numeric"
          >${formatUSDC(order.dcaOrderSize)} USDC</span
        >
      </div>
    {/if}

    <!-- Strategy Parameters -->
    <div class="data-row">
      <span class="data-label">PRICE_DEV:</span>
      <span class="data-value numeric"
        >{(Number(order.priceDeviationBps) / 100).toFixed(2)}%</span
      >
    </div>

    <div class="data-row">
      <span class="data-label">TAKE_PROFIT:</span>
      <span class="data-value numeric"
        >{(Number(order.takeProfitBps) / 100).toFixed(2)}%</span
      >
    </div>

    <!-- Stats Grid -->
    <div class="stats-row fade-in-stagger">
      <div class="stat-item scale-in">
        <div class="stat-label">ROUNDS</div>
        <div class="stat-value">{order.roundsCompleted.toString()}</div>
      </div>

      <div class="stat-item scale-in">
        <div class="stat-label">TRADES</div>
        <div class="stat-value">{order.totalTrades.toString()}</div>
      </div>

      <div class="stat-item scale-in">
        <div class="stat-label">P&L</div>
        <div
          class="stat-value numeric glow-pulse"
          class:text-green={order.totalRealizedPnL > 0n}
          class:text-red={order.totalRealizedPnL < 0n}
        >
          {order.totalRealizedPnL >= 0n ? "+" : "-"}${formatUSDC(
            order.totalRealizedPnL > 0n
              ? order.totalRealizedPnL
              : -order.totalRealizedPnL,
          )}
        </div>
      </div>
    </div>

    <!-- Profits Available -->
    {#if order.profitMode === ProfitMode.ACCUMULATE && order.accumulatedProfits > 0n}
      <div class="profits-panel">
        <span class="text-glow-green"
          >◆ PROFITS_AVAILABLE: ${formatUSDC(order.accumulatedProfits)} USDC</span
        >
        <button
          class="btn btn-success btn-sm"
          on:click={withdrawProfits}
          disabled={withdrawing}
        >
          {withdrawing ? "⟳ WITHDRAWING..." : "▸ WITHDRAW"}
        </button>
      </div>
    {/if}
  </div>

  <!-- Card Footer -->
  <div class="order-footer">
    <button
      class="btn btn-danger w-full"
      on:click={cancelOrder}
      disabled={cancelling}
    >
      {cancelling ? "⟳ CANCELLING..." : "✕ TERMINATE_ORDER"}
    </button>
  </div>
</div>

<style>
  .order-card {
    position: relative;
    transition: all 0.3s ease;
  }

  .order-card.round-active {
    border-color: var(--phosphor-green);
    box-shadow:
      inset 0 0 20px rgba(57, 255, 20, 0.05),
      0 0 30px rgba(57, 255, 20, 0.1);
  }

  .order-body {
    padding: var(--space-6);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .round-active-panel {
    background: rgba(57, 255, 20, 0.05);
    border: 1px solid var(--phosphor-green);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .data-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--noir-steel);
  }

  .data-row:last-child {
    border-bottom: none;
  }

  .data-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }

  .data-value {
    font-size: var(--text-base);
    color: var(--text-primary);
    font-weight: 600;
  }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
    margin-top: var(--space-6);
    padding-top: var(--space-6);
    border-top: 2px solid var(--noir-steel);
  }

  .stat-item {
    text-align: center;
  }

  .stat-label {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: var(--space-2);
    font-weight: 600;
  }

  .stat-value {
    font-family: var(--font-terminal);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--phosphor-cyan);
  }

  .profits-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(57, 255, 20, 0.1);
    border: 1px solid var(--phosphor-green);
    padding: var(--space-4);
    margin-top: var(--space-4);
    border-radius: var(--radius-md);
  }

  .order-footer {
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--noir-steel);
    background: rgba(0, 0, 0, 0.3);
  }
</style>
