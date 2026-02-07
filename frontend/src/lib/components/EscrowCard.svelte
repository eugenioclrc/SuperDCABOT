<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Escrow } from '../types';
  import { formatAmount, formatPrice, truncateAddress, getAddressUrl } from '../utils';

  export let escrow: Escrow;

  const dispatch = createEventDispatcher();

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  $: totalLiquidity = escrow.sellOrders.reduce((sum, order) => sum + order.amount, 0n);
  $: totalFilled = escrow.sellOrders.reduce((sum, order) => sum + order.filled, 0n);
  $: fillPercentage =
    totalLiquidity > 0n ? Number((totalFilled * 10000n) / totalLiquidity) / 100 : 0;
  $: ordersCompletelyFilled = escrow.sellOrders.filter((o) => o.filled === o.amount).length;
  $: nextOrder =
    escrow.lastExecuteOrder < escrow.sellOrders.length
      ? escrow.sellOrders[escrow.lastExecuteOrder]
      : null;
  $: isActive = escrow.availableLiquidity > 0n;
  $: isFullySold = totalFilled >= totalLiquidity && totalLiquidity > 0n;

  // Calculate profit if any sells happened
  $: profitPercent =
    escrow.totalSold > 0n && escrow.averageSellPrice > 0n && escrow.currentPrice > 0n
      ? Number(((escrow.averageSellPrice - escrow.currentPrice) * 10000n) / escrow.averageSellPrice) / 100
      : 0;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  function viewDetails() {
    // Could open a modal or navigate to detailed view
    console.log('View details for', escrow.address);
  }

  function openBuyModal() {
    // Will be handled by parent component
    dispatch('buy', { escrow });
  }

  function openSellModal() {
    // Will be handled by parent component
    dispatch('sell', { escrow });
  }
</script>

<div class="escrow-card" class:inactive={!isActive} class:fully-sold={isFullySold}>
  <!-- Header -->
  <header>
    <div class="asset-pair">
      <span class="asset0">{escrow.asset0Symbol}</span>
      <span class="arrow">→</span>
      <span class="asset1">{escrow.asset1Symbol}</span>
    </div>
    <div class="status-badge" class:active={isActive} class:sold={isFullySold}>
      {#if isFullySold}
        FULLY SOLD
      {:else if isActive}
        ACTIVE
      {:else}
        INACTIVE
      {/if}
    </div>
  </header>

  <!-- Address -->
  <div class="escrow-address">
    <span class="label">ESCROW:</span>
    <a href={getAddressUrl(escrow.address)} target="_blank" rel="noopener noreferrer">
      {truncateAddress(escrow.address, 6)}
    </a>
  </div>

  <!-- Liquidity Section -->
  <section class="liquidity">
    <div class="liquidity-header">
      <span class="label">LIQUIDITY</span>
      <span class="percentage">{fillPercentage.toFixed(1)}% FILLED</span>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar">
      <div class="progress-fill" style="width: {fillPercentage}%"></div>
    </div>

    <div class="liquidity-stats">
      <div class="stat">
        <span class="stat-label">Available:</span>
        <span class="stat-value">
          {formatAmount(escrow.availableLiquidity, escrow.asset0Decimals)} {escrow.asset0Symbol}
        </span>
      </div>
      <div class="stat">
        <span class="stat-label">Sold:</span>
        <span class="stat-value">
          {formatAmount(totalFilled, escrow.asset0Decimals)} {escrow.asset0Symbol}
        </span>
      </div>
    </div>
  </section>

  <!-- Price Section -->
  <section class="prices">
    <div class="price-item">
      <span class="price-label">ORACLE PRICE:</span>
      <span class="price-value">{formatPrice(escrow.currentPrice)}</span>
    </div>

    {#if nextOrder}
      <div class="price-item">
        <span class="price-label">NEXT ORDER PRICE:</span>
        <span class="price-value highlight">{formatPrice(nextOrder.price)}</span>
      </div>
    {/if}

    {#if escrow.totalSold > 0n && escrow.averageSellPrice > 0n}
      <div class="price-item">
        <span class="price-label">AVG SELL PRICE:</span>
        <span class="price-value">{formatPrice(escrow.averageSellPrice)}</span>
      </div>
    {/if}
  </section>

  <!-- Ladder Status -->
  <section class="ladder-status">
    <div class="ladder-header">
      <span class="label">LADDER STATUS</span>
      <span class="orders-filled">
        {ordersCompletelyFilled} / {escrow.sellOrders.length} ORDERS FILLED
      </span>
    </div>

    <div class="ladder-grid">
      {#each escrow.sellOrders.slice(0, 10) as order, i}
        <div
          class="ladder-cell"
          class:filled={order.filled === order.amount}
          class:partial={order.filled > 0n && order.filled < order.amount}
          class:next={i === escrow.lastExecuteOrder}
          title="Order {i + 1}: {formatAmount(order.amount, escrow.asset0Decimals)} @ {formatPrice(order.price)}"
        >
          {i + 1}
        </div>
      {/each}
      {#if escrow.sellOrders.length > 10}
        <div class="ladder-cell more">+{escrow.sellOrders.length - 10}</div>
      {/if}
    </div>
  </section>

  <!-- Profit Display (if any) -->
  {#if profitPercent !== 0}
    <section class="profit" class:positive={profitPercent > 0} class:negative={profitPercent < 0}>
      <span class="profit-label">UNREALIZED P&L:</span>
      <span class="profit-value">
        {profitPercent > 0 ? '+' : ''}{profitPercent.toFixed(2)}%
      </span>
    </section>
  {/if}

  <!-- Actions -->
  <footer class="actions">
    <button class="btn-action" on:click={viewDetails}>VIEW DETAILS</button>
    {#if !isFullySold}
      <button class="btn-action primary" on:click={openBuyModal}>BUY</button>
    {/if}
    {#if escrow.totalSold > 0n}
      <button class="btn-action warning" on:click={openSellModal}>SELL & RESET</button>
    {/if}
  </footer>
</div>

<style>
  .escrow-card {
    background: #0a0e14;
    border: 2px solid #00ff41;
    padding: 1.5rem;
    font-family: 'Courier New', monospace;
    color: #00ff41;
    transition: all 0.3s;
  }

  .escrow-card:hover {
    border-color: #00ffff;
    box-shadow: 0 0 20px #00ffff33;
  }

  .escrow-card.inactive {
    opacity: 0.6;
    border-color: #666;
  }

  .escrow-card.fully-sold {
    border-color: #ffaa00;
  }

  /* Header */
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #00ff4133;
  }

  .asset-pair {
    font-size: 1.3rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .asset0 {
    color: #00ffff;
  }

  .arrow {
    opacity: 0.5;
  }

  .asset1 {
    color: #00ff41;
  }

  .status-badge {
    padding: 0.3rem 0.8rem;
    font-size: 0.75rem;
    font-weight: bold;
    border: 1px solid;
    background: #0a0e14;
  }

  .status-badge.active {
    border-color: #00ff41;
    color: #00ff41;
  }

  .status-badge.sold {
    border-color: #ffaa00;
    color: #ffaa00;
  }

  /* Address */
  .escrow-address {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .escrow-address a {
    color: #00ffff;
    text-decoration: none;
  }

  .escrow-address a:hover {
    text-decoration: underline;
  }

  /* Liquidity */
  .liquidity {
    margin-bottom: 1.5rem;
  }

  .liquidity-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.85rem;
  }

  .percentage {
    font-weight: bold;
    color: #00ffff;
  }

  .progress-bar {
    height: 20px;
    background: #0f1419;
    border: 1px solid #00ff4133;
    margin-bottom: 0.8rem;
    position: relative;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00ff41, #00ffff);
    transition: width 0.5s ease;
  }

  .liquidity-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .stat {
    display: flex;
    justify-content: space-between;
  }

  .stat-label {
    opacity: 0.7;
  }

  .stat-value {
    font-weight: bold;
  }

  /* Prices */
  .prices {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #0f1419;
    border: 1px solid #00ff4133;
  }

  .price-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .price-item:last-child {
    margin-bottom: 0;
  }

  .price-label {
    opacity: 0.7;
  }

  .price-value {
    font-weight: bold;
    color: #00ffff;
  }

  .price-value.highlight {
    color: #ffaa00;
    font-size: 1.1rem;
  }

  /* Ladder Status */
  .ladder-status {
    margin-bottom: 1.5rem;
  }

  .ladder-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.8rem;
    font-size: 0.85rem;
  }

  .orders-filled {
    font-weight: bold;
    color: #00ffff;
  }

  .ladder-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(35px, 1fr));
    gap: 4px;
  }

  .ladder-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f1419;
    border: 1px solid #00ff4133;
    font-size: 0.75rem;
    cursor: help;
    transition: all 0.2s;
  }

  .ladder-cell:hover {
    border-color: #00ff41;
    background: #00ff4122;
  }

  .ladder-cell.filled {
    background: #00ff41;
    color: #0a0e14;
    font-weight: bold;
    border-color: #00ff41;
  }

  .ladder-cell.partial {
    background: linear-gradient(135deg, #00ff41 50%, #0f1419 50%);
    border-color: #00ff41;
  }

  .ladder-cell.next {
    border: 2px solid #ffaa00;
    animation: pulse-border 2s infinite;
  }

  @keyframes pulse-border {
    0%,
    100% {
      border-color: #ffaa00;
    }
    50% {
      border-color: #ffdd00;
    }
  }

  .ladder-cell.more {
    background: transparent;
    border-style: dashed;
    opacity: 0.5;
  }

  /* Profit */
  .profit {
    display: flex;
    justify-content: space-between;
    padding: 0.8rem;
    margin-bottom: 1rem;
    border: 2px solid;
    font-weight: bold;
  }

  .profit.positive {
    border-color: #00ff00;
    background: #00ff0011;
    color: #00ff00;
  }

  .profit.negative {
    border-color: #ff0000;
    background: #ff000011;
    color: #ff0000;
  }

  .profit-value {
    font-size: 1.2rem;
  }

  /* Actions */
  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 0.5rem;
  }

  .btn-action {
    background: transparent;
    border: 1px solid #00ff41;
    color: #00ff41;
    padding: 0.7rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-action:hover {
    background: #00ff4133;
  }

  .btn-action.primary {
    background: #00ff41;
    color: #0a0e14;
  }

  .btn-action.primary:hover {
    background: #00ffff;
    border-color: #00ffff;
  }

  .btn-action.warning {
    border-color: #ffaa00;
    color: #ffaa00;
  }

  .btn-action.warning:hover {
    background: #ffaa0033;
  }

  .label {
    font-weight: bold;
    opacity: 0.7;
    font-size: 0.85rem;
  }
</style>
