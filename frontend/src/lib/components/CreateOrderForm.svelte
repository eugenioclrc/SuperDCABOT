<script lang="ts">
  import { Contract, parseUnits, formatUnits } from 'ethers';
  import { wallet } from '../stores/wallet';
  import { CONTRACT_ADDRESSES, ORDER_BOOK_ABI, ERC20_ABI } from '../contracts';
  import { Side, ProfitMode, type OrderFormData } from '../types';

  let formData: OrderFormData = {
    baseAsset: CONTRACT_ADDRESSES.wbtc,
    quoteAsset: CONTRACT_ADDRESSES.usdc,
    side: Side.BUY,
    baseOrderSize: '1000',
    dcaOrderSize: '500',
    priceDeviationBps: 200, // 2%
    takeProfitBps: 400, // 4%
    maxDcaOrders: 10,
    deviationMultiplier: 1100, // 1.1x
    orderSizeMultiplier: 1500, // 1.5x
    activationPrice: '0',
    cooldownBlocks: 15,
    keeperFeeBps: 50, // 0.5%
    profitMode: ProfitMode.AUTO_COMPOUND,
  };

  let creating = false;
  let error = '';
  let success = '';
  let estimatedCapital = '0';
  let activePreset = 'balanced';

  // Presets for quick configuration
  const presets = {
    conservative: {
      priceDeviationBps: 300, // 3%
      takeProfitBps: 200, // 2%
      maxDcaOrders: 5,
      deviationMultiplier: 1000, // 1.0x
      orderSizeMultiplier: 1000, // 1.0x
    },
    balanced: {
      priceDeviationBps: 200, // 2%
      takeProfitBps: 400, // 4%
      maxDcaOrders: 10,
      deviationMultiplier: 1100, // 1.1x
      orderSizeMultiplier: 1500, // 1.5x
    },
    aggressive: {
      priceDeviationBps: 150, // 1.5%
      takeProfitBps: 600, // 6%
      maxDcaOrders: 15,
      deviationMultiplier: 1200, // 1.2x
      orderSizeMultiplier: 2000, // 2.0x
    },
  };

  function applyPreset(preset: keyof typeof presets) {
    activePreset = preset;
    formData = { ...formData, ...presets[preset] };
    calculateEstimatedCapital();
  }

  function calculateEstimatedCapital() {
    let total = parseFloat(formData.baseOrderSize);
    let dcaSize = parseFloat(formData.dcaOrderSize);

    for (let i = 0; i < formData.maxDcaOrders; i++) {
      total += dcaSize;
      dcaSize = (dcaSize * formData.orderSizeMultiplier) / 1000;
    }

    estimatedCapital = total.toFixed(2);
  }

  $: {
    // Recalculate when relevant fields change
    formData.baseOrderSize;
    formData.dcaOrderSize;
    formData.maxDcaOrders;
    formData.orderSizeMultiplier;
    calculateEstimatedCapital();
  }

  async function createOrder() {
    if (!$wallet.connected || !$wallet.provider) {
      error = 'ERROR: WALLET_NOT_CONNECTED. Please connect your wallet first.';
      return;
    }

    creating = true;
    error = '';
    success = '';

    try {
      const signer = await $wallet.provider.getSigner();
      const orderBook = new Contract(CONTRACT_ADDRESSES.orderBook, ORDER_BOOK_ABI, signer);

      // Parse amounts (assuming 6 decimals for USDC)
      const baseOrderSize = parseUnits(formData.baseOrderSize, 6);
      const dcaOrderSize = parseUnits(formData.dcaOrderSize, 6);
      const activationPrice = formData.activationPrice === '0'
        ? 0n
        : parseUnits(formData.activationPrice, 18);

      // Approve USDC spending first
      const quoteToken = new Contract(formData.quoteAsset, ERC20_ABI, signer);
      const totalCapital = parseUnits(estimatedCapital, 6);

      const allowance = await quoteToken.allowance($wallet.address, CONTRACT_ADDRESSES.orderBook);

      if (allowance < totalCapital) {
        const approveTx = await quoteToken.approve(CONTRACT_ADDRESSES.orderBook, totalCapital);
        await approveTx.wait();
      }

      // Create order
      const tx = await orderBook.createRecurringOrder(
        formData.baseAsset,
        formData.quoteAsset,
        formData.side,
        baseOrderSize,
        dcaOrderSize,
        formData.priceDeviationBps,
        formData.takeProfitBps,
        formData.maxDcaOrders,
        formData.deviationMultiplier,
        formData.orderSizeMultiplier,
        activationPrice,
        formData.cooldownBlocks,
        formData.keeperFeeBps,
        formData.profitMode
      );

      const receipt = await tx.wait();
      success = `SUCCESS: Order created! TX_HASH: ${receipt.hash.slice(0, 10)}...${receipt.hash.slice(-8)}`;

      // Reset form
      formData.baseOrderSize = '1000';
      formData.dcaOrderSize = '500';
    } catch (err: any) {
      error = `ERROR: ${err.message || 'Transaction failed'}`;
      console.error('Create order error:', err);
    } finally {
      creating = false;
    }
  }
</script>

<div class="container fade-in">
  <!-- Terminal Header -->
  <h1 class="text-glow-cyan mb-4">▸ ORDER_CONSTRUCTOR.EXE</h1>
  <p class="label mb-8">Round-based DCA strategy deployment interface</p>

  <!-- Preset Selectors -->
  <div class="preset-grid mb-8">
    <button
      type="button"
      class="preset-btn"
      class:active={activePreset === 'conservative'}
      on:click={() => applyPreset('conservative')}
    >
      <span class="preset-icon">◇</span>
      <span class="preset-name">CONSERVATIVE</span>
      <span class="preset-desc">Low risk, small spreads</span>
    </button>
    <button
      type="button"
      class="preset-btn"
      class:active={activePreset === 'balanced'}
      on:click={() => applyPreset('balanced')}
    >
      <span class="preset-icon">◆</span>
      <span class="preset-name">BALANCED</span>
      <span class="preset-desc">Moderate risk & reward</span>
    </button>
    <button
      type="button"
      class="preset-btn"
      class:active={activePreset === 'aggressive'}
      on:click={() => applyPreset('aggressive')}
    >
      <span class="preset-icon">◈</span>
      <span class="preset-name">AGGRESSIVE</span>
      <span class="preset-desc">High risk, wide ladders</span>
    </button>
  </div>

  <form on:submit|preventDefault={createOrder} class="fade-in-stagger">
    <!-- Strategy Configuration -->
    <div class="terminal-panel mb-6 scale-in">
      <div class="terminal-panel-header">
        <h2 class="terminal-panel-title">› STRATEGY_CONFIG</h2>
      </div>

      <div style="padding: var(--space-6);">
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="side">POSITION_SIDE</label>
            <select class="form-select" id="side" bind:value={formData.side}>
              <option value={Side.BUY}>BUY [LONG]</option>
              <option value={Side.SELL}>SELL [SHORT]</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="profitMode">PROFIT_MODE</label>
            <select class="form-select" id="profitMode" bind:value={formData.profitMode}>
              <option value={ProfitMode.AUTO_COMPOUND}>AUTO_COMPOUND [REINVEST]</option>
              <option value={ProfitMode.ACCUMULATE}>ACCUMULATE [WITHDRAW]</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="baseOrderSize">BASE_ORDER_SIZE [USDC]</label>
            <input
              class="form-input"
              id="baseOrderSize"
              type="number"
              step="0.01"
              bind:value={formData.baseOrderSize}
              required
            />
            <p class="label mt-2">Initial entry order size</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="dcaOrderSize">DCA_ORDER_SIZE [USDC]</label>
            <input
              class="form-input"
              id="dcaOrderSize"
              type="number"
              step="0.01"
              bind:value={formData.dcaOrderSize}
              required
            />
            <p class="label mt-2">Safety order size per level</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Ladder Parameters -->
    <div class="terminal-panel mb-6 scale-in">
      <div class="terminal-panel-header">
        <h2 class="terminal-panel-title">› LADDER_PARAMETERS</h2>
        <p class="terminal-panel-subtitle">Exponential DCA configuration</p>
      </div>

      <div style="padding: var(--space-6);">
        <div class="form-group">
          <label class="form-label" for="priceDeviation">
            PRICE_DEVIATION [{(formData.priceDeviationBps / 100).toFixed(2)}%]
          </label>
          <input
            class="form-range"
            id="priceDeviation"
            type="range"
            min="50"
            max="1000"
            step="10"
            bind:value={formData.priceDeviationBps}
          />
          <p class="label mt-2">Distance to first DCA trigger</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="takeProfit">
            TAKE_PROFIT [{(formData.takeProfitBps / 100).toFixed(2)}%]
          </label>
          <input
            class="form-range"
            id="takeProfit"
            type="range"
            min="100"
            max="2000"
            step="50"
            bind:value={formData.takeProfitBps}
          />
          <p class="label mt-2">Exit profit target percentage</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="maxDcaOrders">
            MAX_DCA_ORDERS [{formData.maxDcaOrders}]
          </label>
          <input
            class="form-range"
            id="maxDcaOrders"
            type="range"
            min="1"
            max="20"
            step="1"
            bind:value={formData.maxDcaOrders}
          />
          <p class="label mt-2">Maximum safety orders per round</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="deviationMultiplier">
            DEVIATION_MULTIPLIER [{(formData.deviationMultiplier / 1000).toFixed(2)}x]
          </label>
          <input
            class="form-range"
            id="deviationMultiplier"
            type="range"
            min="1000"
            max="2000"
            step="50"
            bind:value={formData.deviationMultiplier}
          />
          <p class="label mt-2">Exponential spacing between DCAs</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="orderSizeMultiplier">
            SIZE_MULTIPLIER [{(formData.orderSizeMultiplier / 1000).toFixed(2)}x]
          </label>
          <input
            class="form-range"
            id="orderSizeMultiplier"
            type="range"
            min="1000"
            max="3000"
            step="100"
            bind:value={formData.orderSizeMultiplier}
          />
          <p class="label mt-2">Size scaling per DCA level</p>
        </div>
      </div>
    </div>

    <!-- Advanced Options -->
    <div class="terminal-panel mb-6 scale-in">
      <div class="terminal-panel-header">
        <h2 class="terminal-panel-title">› ADVANCED_OPTIONS</h2>
      </div>

      <div style="padding: var(--space-6);">
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label" for="cooldownBlocks">
              COOLDOWN_BLOCKS [{formData.cooldownBlocks}]
            </label>
            <input
              class="form-input"
              id="cooldownBlocks"
              type="number"
              min="0"
              max="1000"
              bind:value={formData.cooldownBlocks}
            />
            <p class="label mt-2">~{Math.floor(formData.cooldownBlocks * 12 / 60)} minutes between rounds</p>
          </div>

          <div class="form-group">
            <label class="form-label" for="keeperFeeBps">
              KEEPER_FEE [{(formData.keeperFeeBps / 100).toFixed(2)}%]
            </label>
            <input
              class="form-range"
              id="keeperFeeBps"
              type="range"
              min="0"
              max="500"
              step="10"
              bind:value={formData.keeperFeeBps}
            />
            <p class="label mt-2">Fee paid to keeper bot per execution</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Capital Estimate -->
    <div class="capital-panel mb-6 scale-in">
      <div class="capital-label">ESTIMATED_CAPITAL_REQUIRED:</div>
      <div class="capital-value text-glow-amber glow-pulse">{estimatedCapital} USDC</div>
      <p class="label">Includes all DCA levels + keeper fees</p>
    </div>

    <!-- Error/Success Messages -->
    {#if error}
      <div class="terminal-panel mb-6" style="border-color: var(--phosphor-red);">
        <p class="text-glow-red">⚠ {error}</p>
      </div>
    {/if}

    {#if success}
      <div class="terminal-panel mb-6" style="border-color: var(--phosphor-green);">
        <p class="text-glow-green">✓ {success}</p>
      </div>
    {/if}

    <!-- Submit Button -->
    <button
      type="submit"
      class="btn btn-primary btn-lg w-full"
      disabled={creating || !$wallet.connected}
    >
      {#if creating}
        ⟳ DEPLOYING_ORDER...
      {:else if !$wallet.connected}
        ⚠ WALLET_NOT_CONNECTED
      {:else}
        ▸ DEPLOY_ORDER
      {/if}
    </button>
  </form>
</div>

<style>
  .preset-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-4);
  }

  .preset-btn {
    background: var(--noir-charcoal);
    border: 2px solid var(--noir-steel);
    border-radius: var(--radius-md);
    padding: var(--space-6) var(--space-4);
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .preset-btn:hover {
    border-color: var(--phosphor-cyan);
    box-shadow: 0 0 30px rgba(0, 255, 209, 0.3),
                inset 0 0 20px rgba(0, 255, 209, 0.1);
    transform: translateY(-4px) scale(1.03);
  }

  .preset-btn.active {
    border-color: var(--phosphor-cyan);
    background: rgba(0, 255, 209, 0.1);
    box-shadow: 0 0 30px rgba(0, 255, 209, 0.3),
                inset 0 0 30px rgba(0, 255, 209, 0.15);
    position: relative;
  }

  .preset-btn.active::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(0, 255, 209, 0.2) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: shimmer 3s linear infinite;
    border-radius: var(--radius-md);
  }

  .preset-icon {
    font-size: var(--text-3xl);
    color: var(--phosphor-cyan);
    text-shadow: var(--glow-cyan);
  }

  .preset-name {
    font-family: var(--font-terminal);
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.1em;
  }

  .preset-desc {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .capital-panel {
    background: var(--noir-charcoal);
    border: 2px solid var(--phosphor-amber);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    text-align: center;
    box-shadow: inset 0 0 20px rgba(255, 184, 0, 0.05);
  }

  .capital-label {
    font-family: var(--font-terminal);
    font-size: var(--text-sm);
    color: var(--phosphor-amber);
    text-shadow: var(--glow-amber);
    letter-spacing: 0.15em;
    margin-bottom: var(--space-2);
    font-weight: 600;
  }

  .capital-value {
    font-family: var(--font-terminal);
    font-size: var(--text-4xl);
    font-weight: 700;
    margin-bottom: var(--space-2);
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @media (max-width: 768px) {
    .preset-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
