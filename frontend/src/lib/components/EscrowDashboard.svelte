<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getContract, type Address, parseAbiItem } from "viem";
  import { wallet } from "../stores/wallet";
  import {
    CONTRACT_ADDRESSES,
    ESCROW_FACTORY_ABI,
    ESCROW_ABI,
    ERC20_ABI,
  } from "../contracts";
  import type { Escrow } from "../types";
  import { parseContractError, formatAmount } from "../utils";
  import EscrowCard from "./EscrowCard.svelte";

  // ============================================================================
  // STATE
  // ============================================================================

  let escrows: Escrow[] = [];
  let loading = true;
  let error = "";
  let unwatchers: (() => void)[] = [];

  // ============================================================================
  // LOAD USER ESCROWS
  // ============================================================================

  async function loadUserEscrows() {
    if (!$wallet.isConnected || !$wallet.publicClient || !$wallet.address) {
      loading = false;
      return;
    }

    loading = true;
    error = "";

    try {
      const publicClient = $wallet.publicClient;

      // Get all EscrowCreated events for this user
      // Event: EscrowCreated(address indexed escrow, address indexed owner, address asset0, address asset1)
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESSES.escrowFactory as Address,
        event: parseAbiItem(
          "event EscrowCreated(address indexed escrow, address indexed owner, address asset0, address asset1)",
        ),
        args: {
          owner: $wallet.address,
        },
        fromBlock: "earliest",
      });

      // Extract escrow addresses
      const escrowAddresses = logs.map((log: any) => log.args.escrow);

      // Load data for each escrow
      const escrowsData = await Promise.all(
        escrowAddresses.map((addr: any) =>
          addr ? loadEscrowData(addr) : null,
        ),
      );

      escrows = escrowsData.filter((e) => e !== null) as Escrow[];
    } catch (e: any) {
      console.error("Failed to load escrows:", e);
      error = parseContractError(e);
    } finally {
      loading = false;
    }
  }

  /**
   * Load complete state for a single escrow
   */
  async function loadEscrowData(address: Address): Promise<Escrow | null> {
    if (!$wallet.publicClient) return null;

    try {
      const escrow = getContract({
        address,
        abi: ESCROW_ABI,
        client: $wallet.publicClient,
      });

      // Fetch all data in parallel
      const [
        asset0Address,
        asset1Address,
        owner,
        params,
        sellOrders,
        availableLiquidity,
        currentPrice,
        lastExecuteOrder,
        totalSold,
        averageSellPrice,
      ] = (await Promise.all([
        escrow.read.asset0(),
        escrow.read.asset1(),
        escrow.read.owner(),
        escrow.read.params(),
        escrow.read.getSellOrders(),
        escrow.read.getAvailableLiquidity(),
        escrow.read.getCurrentSpotPrice(),
        escrow.read.lastExecuteOrder(),
        escrow.read.getTotalSoldAsset0(),
        escrow.read.getAverageSellPrice(),
      ])) as any[];

      // Get token metadata
      const token0 = getContract({
        address: asset0Address,
        abi: ERC20_ABI,
        client: $wallet.publicClient,
      });
      const token1 = getContract({
        address: asset1Address,
        abi: ERC20_ABI,
        client: $wallet.publicClient,
      });

      const [symbol0, symbol1, decimals0, decimals1] = (await Promise.all([
        token0.read.symbol(),
        token1.read.symbol(),
        token0.read.decimals(),
        token1.read.decimals(),
      ])) as any[];

      // Convert sellOrders from contract format to our type
      const ordersConverted = sellOrders.map((order: any) => ({
        amount: BigInt(order.amount),
        filled: BigInt(order.filled),
        price: BigInt(order.price),
      }));

      return {
        address,
        owner,
        asset0: asset0Address,
        asset1: asset1Address,
        asset0Symbol: symbol0,
        asset1Symbol: symbol1,
        asset0Decimals: Number(decimals0),
        asset1Decimals: Number(decimals1),
        params: {
          dcaOrdersSize: Number(params.dcaOrdersSize),
          priceDeviationBPS: Number(params.priceDeviationBPS),
          takeProfitBPS: Number(params.takeProfitBPS),
          priceMultiplierBPS: Number(params.priceMultiplierBPS),
          dcaOrderSizeMultiplierBPS: Number(params.dcaOrderSizeMultiplierBPS),
          baseOrderAmount: BigInt(params.baseOrderAmount),
          dcaOrderAmount: BigInt(params.dcaOrderAmount),
        },
        sellOrders: ordersConverted,
        currentPrice: BigInt(currentPrice),
        availableLiquidity: BigInt(availableLiquidity),
        lastExecuteOrder: Number(lastExecuteOrder),
        totalSold: BigInt(totalSold),
        averageSellPrice: BigInt(averageSellPrice),
      };
    } catch (e: any) {
      console.error(`Failed to load escrow ${address}:`, e);
      return null;
    }
  }

  /**
   * Refresh single escrow after trade
   */
  async function refreshEscrow(address: Address) {
    const updated = await loadEscrowData(address);
    if (updated) {
      escrows = escrows.map((e) => (e.address === address ? updated : e));
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  function setupEventListeners() {
    if (!$wallet.publicClient || !$wallet.address) return;

    const publicClient = $wallet.publicClient;

    // Listen for new escrows created by this user
    const unwatchCreated = publicClient.watchContractEvent({
      address: CONTRACT_ADDRESSES.escrowFactory as Address,
      abi: ESCROW_FACTORY_ABI,
      eventName: "EscrowCreated",
      args: { owner: $wallet.address },
      onLogs: async (logs) => {
        for (const log of logs as any[]) {
          if (log.args?.escrow) {
            const newEscrow = await loadEscrowData(log.args.escrow);
            if (newEscrow) {
              escrows = [...escrows, newEscrow];
            }
          }
        }
      },
    });
    unwatchers.push(unwatchCreated);

    // Listen for Buy/Sell events on each escrow
    escrows.forEach((escrow) => {
      const unwatchBuy = publicClient.watchContractEvent({
        address: escrow.address,
        abi: ESCROW_ABI,
        eventName: "Buy",
        onLogs: () => refreshEscrow(escrow.address),
      });
      const unwatchSell = publicClient.watchContractEvent({
        address: escrow.address,
        abi: ESCROW_ABI,
        eventName: "Sell",
        onLogs: () => refreshEscrow(escrow.address),
      });
      unwatchers.push(unwatchBuy, unwatchSell);
    });
  }

  function cleanupEventListeners() {
    unwatchers.forEach((unwatch) => unwatch());
    unwatchers = [];
  }

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(() => {
    loadUserEscrows();
  });

  onDestroy(() => {
    cleanupEventListeners();
  });

  // Reload when wallet connects/changes
  $: if ($wallet.isConnected && $wallet.address) {
    cleanupEventListeners();
    loadUserEscrows().then(() => {
      setupEventListeners();
    });
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  $: totalEscrows = escrows.length;
  $: totalLiquidity = escrows.reduce(
    (sum, e) => sum + e.availableLiquidity,
    0n,
  );
  $: totalSold = escrows.reduce((sum, e) => sum + e.totalSold, 0n);
  $: activeEscrows = escrows.filter((e) => e.availableLiquidity > 0n).length;
</script>

<div class="dashboard">
  <header>
    <div class="title-section">
      <h1>ESCROW DASHBOARD</h1>
      <div class="subtitle">Your P2P Grid Trading Contracts</div>
    </div>
    <a href="/create" class="btn-create">
      <span class="icon">+</span> CREATE NEW ESCROW
    </a>
  </header>

  {#if !$wallet.connected}
    <div class="message info">
      <div class="message-icon">ℹ</div>
      <div class="message-content">
        <strong>WALLET NOT CONNECTED</strong>
        <p>Please connect your wallet to view your escrows.</p>
      </div>
    </div>
  {:else if loading}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <div class="loading-text">LOADING ESCROWS...</div>
    </div>
  {:else if error}
    <div class="message error">
      <div class="message-icon">⚠</div>
      <div class="message-content">
        <strong>ERROR LOADING ESCROWS</strong>
        <p>{error}</p>
        <button class="btn-retry" on:click={loadUserEscrows}>RETRY</button>
      </div>
    </div>
  {:else if escrows.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <h2>NO ESCROWS YET</h2>
      <p>You haven't created any escrow contracts yet.</p>
      <p>Create your first P2P grid trading escrow to get started!</p>
      <a href="/create" class="btn-primary">CREATE YOUR FIRST ESCROW</a>
    </div>
  {:else}
    <!-- Stats Summary -->
    <section class="stats">
      <div class="stat-card">
        <div class="stat-label">TOTAL ESCROWS</div>
        <div class="stat-value">{totalEscrows}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ACTIVE</div>
        <div class="stat-value">{activeEscrows}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TOTAL LIQUIDITY</div>
        <div class="stat-value">
          {#if totalLiquidity > 0n}
            <!-- Show in BTC equivalent (assuming 8 decimals) -->
            {formatAmount(totalLiquidity, 8)} BTC
          {:else}
            0.00 BTC
          {/if}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TOTAL SOLD</div>
        <div class="stat-value">
          {#if totalSold > 0n}
            {formatAmount(totalSold, 8)} BTC
          {:else}
            0.00 BTC
          {/if}
        </div>
      </div>
    </section>

    <!-- Escrow Cards Grid -->
    <section class="escrows-grid">
      {#each escrows as escrow (escrow.address)}
        <EscrowCard {escrow} on:refresh={() => refreshEscrow(escrow.address)} />
      {/each}
    </section>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
    font-family: "Courier New", monospace;
    color: #00ff41;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px solid #00ff41;
  }

  .title-section h1 {
    font-size: 2rem;
    margin: 0 0 0.5rem 0;
    color: #00ff41;
  }

  .subtitle {
    font-size: 1rem;
    opacity: 0.7;
  }

  .btn-create {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #00ff41;
    color: #0a0e14;
    padding: 1rem 1.5rem;
    font-weight: bold;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-create:hover {
    background: #00ffff;
    box-shadow: 0 0 20px #00ffff66;
  }

  .icon {
    font-size: 1.5rem;
  }

  /* Messages */
  .message {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
    border: 2px solid;
    margin-bottom: 2rem;
  }

  .message.info {
    border-color: #00ffff;
    background: #00ffff11;
  }

  .message.error {
    border-color: #ff0000;
    background: #ff000011;
  }

  .message-icon {
    font-size: 2rem;
  }

  .message-content {
    flex: 1;
  }

  .message-content strong {
    display: block;
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }

  .message-content p {
    margin: 0.5rem 0;
    opacity: 0.8;
  }

  .btn-retry {
    background: #ff0000;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    margin-top: 1rem;
    cursor: pointer;
    font-family: "Courier New", monospace;
    font-weight: bold;
  }

  .btn-retry:hover {
    background: #ff3333;
  }

  /* Loading */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 0;
    gap: 1rem;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid #00ff4133;
    border-top-color: #00ff41;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    font-size: 1.2rem;
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

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    border: 2px dashed #00ff4166;
    background: #0a0e14;
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    font-size: 1.8rem;
    margin: 1rem 0;
    color: #00ff41;
  }

  .empty-state p {
    font-size: 1.1rem;
    opacity: 0.7;
    margin: 0.5rem 0;
  }

  .btn-primary {
    display: inline-block;
    background: #00ff41;
    color: #0a0e14;
    padding: 1rem 2rem;
    margin-top: 2rem;
    font-weight: bold;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    background: #00ffff;
    box-shadow: 0 0 20px #00ffff66;
  }

  /* Stats */
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin-bottom: 3rem;
  }

  .stat-card {
    background: #0a0e14;
    border: 2px solid #00ff41;
    padding: 1.5rem;
    text-align: center;
  }

  .stat-label {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: bold;
    color: #00ffff;
  }

  /* Escrows Grid */
  .escrows-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 2rem;
  }

  @media (max-width: 768px) {
    header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .escrows-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
