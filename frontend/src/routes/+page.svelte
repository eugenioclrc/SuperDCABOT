<script lang="ts">
  import { goto } from "$app/navigation";
  import { wallet } from "../lib/stores/wallet";

  const features = [
    {
      icon: "◆",
      title: "NON-CUSTODIAL",
      description: "Your keys, your funds. Always.",
      detail:
        "Zero custody risk. Orders execute directly from your wallet through battle-tested smart contracts.",
    },
    {
      icon: "▣",
      title: "ROUND-BASED DCA",
      description: "Exponential laddering strategy",
      detail:
        "Automatically average down with scaling order sizes. DCA positions that adapt as price moves.",
    },
    {
      icon: "⬢",
      title: "AUTOMATED EXECUTION",
      description: "Set it and forget it",
      detail:
        "Keeper network monitors prices 24/7. Orders execute at optimal levels without manual intervention.",
    },
    {
      icon: "◈",
      title: "PROFIT AUTOMATION",
      description: "Auto-compound or accumulate",
      detail:
        "Choose your profit mode: reinvest gains for compound returns or withdraw profits after each round.",
    },
  ];

  function handleGetStarted() {
    if ($wallet.isConnected) {
      goto("/create");
    } else {
      wallet.connect();
    }
  }
</script>

<div class="landing-page">
  <!-- Top Navigation -->
  <nav class="landing-nav fade-in">
    <div class="landing-nav-content">
      <a href="/" class="nav-brand text-glow-cyan">
        <span class="logo-bracket">[</span>
        AUTO<span class="text-glow-amber">DCA</span>
        <span class="logo-bracket">]</span>
      </a>
      <div class="nav-actions">
        <a href="/dashboard" class="nav-link-inline">Dashboard</a>
        <a href="/backtest" class="nav-link-inline">Backtest</a>
        <a href="/create" class="nav-link-inline">Create Order</a>
        {#if $wallet.isConnected}
          <button
            class="btn btn-secondary btn-sm"
            on:click={() => wallet.disconnect()}
          >
            Disconnect
          </button>
        {:else}
          <button
            class="btn btn-primary btn-sm"
            on:click={() => wallet.connect()}
          >
            Connect Wallet
          </button>
        {/if}
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero-section fade-in">
    <div class="hero-grid">
      <!-- Left: Main Pitch -->
      <div class="hero-content">
        <div class="system-tag mb-4 slide-in-left">
          <span class="tag-bracket">[</span>
          <span class="tag-text">SYSTEM_ONLINE</span>
          <span class="tag-bracket">]</span>
          <span class="tag-status">●</span>
        </div>

        <h1 class="hero-title text-glow-cyan boot-sequence">
          AUTONOMOUS DCA
          <br />
          <span class="text-glow-amber">PROTOCOL</span>
        </h1>

        <p class="hero-subtitle slide-in-left">
          Non-custodial dollar-cost averaging with exponential ladder
          strategies.
          <br />
          Built for traders who want precision automation without giving up control.
        </p>

        <div class="hero-actions slide-in-left">
          <button class="btn btn-primary btn-lg" on:click={handleGetStarted}>
            {#if $wallet.isConnected}
              ▸ LAUNCH_TERMINAL
            {:else}
              ▸ CONNECT_WALLET
            {/if}
          </button>
          <a href="/backtest" class="btn btn-secondary btn-lg">
            ⟳ RUN_BACKTEST
          </a>
        </div>
      </div>

      <!-- Right: Visual Element -->
      <div class="hero-visual slide-in-right">
        <div class="terminal-panel visual-panel">
          <div class="terminal-panel-header">
            <div class="terminal-panel-title">▸ SYSTEM_DIAGNOSTICS</div>
          </div>
          <div class="visual-content">
            <div class="diagnostic-line">
              <span class="diagnostic-label">PROTOCOL_STATUS:</span>
              <span class="text-glow-green">OPERATIONAL</span>
            </div>
            <div class="diagnostic-line">
              <span class="diagnostic-label">CHAIN_NETWORK:</span>
              <span class="text-glow-cyan">ETHEREUM_SEPOLIA</span>
            </div>
            <div class="diagnostic-line">
              <span class="diagnostic-label">CONTRACT_VERSION:</span>
              <span class="text-glow-amber">v1.0.0</span>
            </div>
            <div class="diagnostic-separator"></div>
            <div class="diagnostic-line">
              <span class="diagnostic-label">ACTIVE_ORDERS:</span>
              <span class="text-glow-cyan number-tick">127</span>
            </div>
            <div class="diagnostic-line">
              <span class="diagnostic-label">TOTAL_VOLUME:</span>
              <span class="text-glow-amber number-tick">$2,847,391</span>
            </div>
            <div class="diagnostic-line">
              <span class="diagnostic-label">EXECUTIONS_24H:</span>
              <span class="text-glow-green number-tick">1,834</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Features Grid -->
  <section class="features-section">
    <div class="section-header fade-in">
      <h2 class="section-title text-glow-cyan">› CORE_CAPABILITIES</h2>
      <p class="section-subtitle">
        Professional-grade DCA automation without the custody risk of
        centralized platforms
      </p>
    </div>

    <div class="features-grid fade-in-stagger">
      {#each features as feature}
        <div class="feature-card terminal-panel hover-lift">
          <div class="feature-icon text-glow-cyan">{feature.icon}</div>
          <h3 class="feature-title">{feature.title}</h3>
          <p class="feature-description">{feature.description}</p>
          <div class="feature-detail label">{feature.detail}</div>
        </div>
      {/each}
    </div>
  </section>

  <!-- How It Works -->
  <section class="how-it-works-section">
    <div class="section-header fade-in">
      <h2 class="section-title text-glow-amber">› EXECUTION_PROTOCOL</h2>
      <p class="section-subtitle">
        Four-phase position building with exponential ladder mechanics
      </p>
    </div>

    <div class="protocol-flow fade-in-stagger">
      <div class="protocol-step terminal-panel scale-in">
        <div class="step-number text-glow-cyan">01</div>
        <div class="step-content">
          <h3 class="step-title">BASE_ORDER</h3>
          <p class="step-description">
            Initial entry at your activation price. Sets the foundation for your
            position with configurable size.
          </p>
        </div>
      </div>

      <div class="protocol-arrow text-glow-cyan">▼</div>

      <div class="protocol-step terminal-panel scale-in">
        <div class="step-number text-glow-amber">02</div>
        <div class="step-content">
          <h3 class="step-title">DCA_LADDER</h3>
          <p class="step-description">
            Exponential safety orders trigger as price moves against you. Each
            level scales in size and spacing.
          </p>
        </div>
      </div>

      <div class="protocol-arrow text-glow-amber">▼</div>

      <div class="protocol-step terminal-panel scale-in">
        <div class="step-number text-glow-green">03</div>
        <div class="step-content">
          <h3 class="step-title">TAKE_PROFIT</h3>
          <p class="step-description">
            Automatic exit when position reaches your target profit percentage.
            Weighted average exit price.
          </p>
        </div>
      </div>

      <div class="protocol-arrow text-glow-green">▼</div>

      <div class="protocol-step terminal-panel scale-in">
        <div class="step-number text-glow-cyan">04</div>
        <div class="step-content">
          <h3 class="step-title">COOLDOWN</h3>
          <p class="step-description">
            Configurable wait period before next round begins. Prevents
            overtrading and allows market breathing room.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA Section -->
  <section class="cta-section fade-in">
    <div class="cta-panel terminal-panel hover-glow">
      <h2 class="cta-title text-glow-cyan">READY TO DEPLOY?</h2>
      <p class="cta-subtitle">
        Connect your wallet and configure your first autonomous DCA strategy in
        under 60 seconds.
        <br />
        No custody. No trust. Just code.
      </p>
      <button class="btn btn-primary btn-lg" on:click={handleGetStarted}>
        {#if $wallet.isConnected}
          ▸ CREATE_FIRST_ORDER
        {:else}
          ▸ CONNECT_WALLET_NOW
        {/if}
      </button>
      <p class="cta-disclaimer label">
        Testnet deployment on Sepolia. Non-custodial smart contracts. Unaudited
        alpha software.
      </p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="landing-footer fade-in">
    <div class="footer-content">
      <div class="footer-brand">
        <div class="footer-logo text-glow-cyan">
          [AUTO<span class="text-glow-amber">DCA</span>]
        </div>
        <p class="footer-tagline label">
          Non-custodial position automation protocol
        </p>
      </div>
      <div class="footer-links">
        <a href="/dashboard" class="footer-link">Dashboard</a>
        <a href="/create" class="footer-link">Create Order</a>
        <a href="/backtest" class="footer-link">Backtest</a>
      </div>
      <div class="footer-status">
        <div class="status-indicator">
          <span class="status-dot"></span>
          <span class="status-text">SYSTEM_ONLINE</span>
        </div>
        <p class="footer-meta label">ETHGlobal Hack the Money 2026</p>
      </div>
    </div>
  </footer>
</div>

<style>
  .landing-page {
    min-height: 100vh;
    background: var(--noir-void);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     TOP NAVIGATION
     ═══════════════════════════════════════════════════════════════════════ */

  .landing-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(10, 10, 10, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--noir-steel);
    padding: var(--space-4) 0;
  }

  .landing-nav-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 var(--space-8);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-brand {
    font-family: var(--font-terminal);
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: 0.15em;
    text-decoration: none;
    transition: transform 0.3s ease;
  }

  .nav-brand:hover {
    transform: scale(1.05);
  }

  .logo-bracket {
    color: var(--text-tertiary);
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: var(--space-6);
  }

  .nav-link-inline {
    color: var(--text-secondary);
    text-decoration: none;
    font-family: var(--font-terminal);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.05em;
    transition: color 0.3s ease;
    position: relative;
  }

  .nav-link-inline::after {
    content: "";
    position: absolute;
    bottom: -4px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--phosphor-cyan);
    transform: scaleX(0);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .nav-link-inline:hover {
    color: var(--phosphor-cyan);
  }

  .nav-link-inline:hover::after {
    transform: scaleX(1);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HERO SECTION
     ═══════════════════════════════════════════════════════════════════════ */

  .hero-section {
    position: relative;
    overflow: hidden;
    padding: 90px 40px;
  }

  .hero-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 500px;
    background: radial-gradient(
      ellipse at top,
      rgba(0, 255, 209, 0.1) 0%,
      transparent 70%
    );
    pointer-events: none;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-12);
    max-width: 1400px;
    margin: 0 auto;
    align-items: center;
  }

  .hero-content {
    position: relative;
    z-index: 1;
  }

  .system-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-family: var(--font-terminal);
    font-size: var(--text-sm);
    color: var(--phosphor-green);
    padding: var(--space-2) var(--space-4);
    background: rgba(57, 255, 20, 0.05);
    border: 1px solid var(--phosphor-green);
    border-radius: var(--radius-sm);
  }

  .tag-bracket {
    color: var(--text-tertiary);
  }

  .tag-status {
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .hero-title {
    font-family: var(--font-terminal);
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: 0.02em;
    margin-bottom: var(--space-6);
  }

  .hero-subtitle {
    font-size: var(--text-lg);
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: var(--space-8);
    max-width: 600px;
  }

  .hero-actions {
    display: flex;
    gap: var(--space-4);
    margin-bottom: var(--space-12);
  }

  /* Hero Visual */
  .hero-visual {
    position: relative;
  }

  .visual-panel {
    background: var(--noir-charcoal);
  }

  .visual-content {
    padding: var(--space-6);
  }

  .diagnostic-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-3) 0;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .diagnostic-label {
    color: var(--text-tertiary);
    letter-spacing: 0.05em;
  }

  .diagnostic-separator {
    height: 1px;
    background: var(--noir-steel);
    margin: var(--space-4) 0;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FEATURES SECTION
     ═══════════════════════════════════════════════════════════════════════ */

  .features-section {
    padding: var(--space-16) var(--space-8);
    max-width: 1400px;
    margin: 0 auto;
  }

  .section-header {
    text-align: center;
    margin-bottom: var(--space-12);
  }

  .section-title {
    font-family: var(--font-terminal);
    font-size: var(--text-3xl);
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-4);
  }

  .section-subtitle {
    font-size: var(--text-lg);
    color: var(--text-secondary);
    max-width: 700px;
    margin: 0 auto;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-6);
  }

  .feature-card {
    padding: var(--space-8);
    text-align: center;
  }

  .feature-icon {
    font-size: var(--text-5xl);
    margin-bottom: var(--space-4);
    animation: glowPulse 3s ease-in-out infinite;
  }

  .feature-title {
    font-family: var(--font-terminal);
    font-size: var(--text-lg);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.1em;
    margin-bottom: var(--space-3);
  }

  .feature-description {
    font-size: var(--text-base);
    color: var(--phosphor-cyan);
    margin-bottom: var(--space-4);
  }

  .feature-detail {
    color: var(--text-tertiary);
    line-height: 1.6;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     HOW IT WORKS SECTION
     ═══════════════════════════════════════════════════════════════════════ */

  .how-it-works-section {
    padding: var(--space-16) var(--space-8);
    max-width: 900px;
    margin: 0 auto;
  }

  .protocol-flow {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .protocol-step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-6);
    padding: var(--space-6);
  }

  .step-number {
    font-family: var(--font-terminal);
    font-size: var(--text-4xl);
    font-weight: 700;
    line-height: 1;
    flex-shrink: 0;
  }

  .step-content {
    flex: 1;
  }

  .step-title {
    font-family: var(--font-terminal);
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.1em;
    margin-bottom: var(--space-3);
  }

  .step-description {
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .protocol-arrow {
    font-size: var(--text-2xl);
    text-align: center;
    animation: float 2s ease-in-out infinite;
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(10px);
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     CTA SECTION
     ═══════════════════════════════════════════════════════════════════════ */

  .cta-section {
    padding: var(--space-16) var(--space-8) var(--space-20);
    max-width: 900px;
    margin: 0 auto;
  }

  .cta-panel {
    padding: var(--space-12);
    text-align: center;
    background: var(--noir-charcoal);
  }

  .cta-title {
    font-family: var(--font-terminal);
    font-size: var(--text-3xl);
    font-weight: 700;
    letter-spacing: 0.1em;
    margin-bottom: var(--space-4);
  }

  .cta-subtitle {
    font-size: var(--text-lg);
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: var(--space-8);
  }

  .cta-disclaimer {
    margin-top: var(--space-6);
    color: var(--text-tertiary);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     FOOTER
     ═══════════════════════════════════════════════════════════════════════ */

  .landing-footer {
    border-top: 1px solid var(--noir-steel);
    padding: var(--space-12) var(--space-8);
    background: var(--noir-charcoal);
  }

  .footer-content {
    max-width: 1400px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-8);
    align-items: center;
  }

  .footer-logo {
    font-family: var(--font-terminal);
    font-size: var(--text-xl);
    font-weight: 700;
    letter-spacing: 0.15em;
    margin-bottom: var(--space-2);
  }

  .footer-tagline {
    color: var(--text-tertiary);
  }

  .footer-links {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .footer-link {
    color: var(--text-secondary);
    text-decoration: none;
    font-family: var(--font-terminal);
    font-size: var(--text-sm);
    transition: color 0.2s ease;
  }

  .footer-link:hover {
    color: var(--phosphor-cyan);
  }

  .footer-status {
    text-align: right;
  }

  .footer-meta {
    margin-top: var(--space-2);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════════════════════════════ */

  @media (max-width: 1024px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: var(--space-8);
    }

    .hero-visual {
      order: -1;
    }

    .footer-content {
      grid-template-columns: 1fr;
      text-align: center;
      gap: var(--space-6);
    }

    .footer-links {
      align-items: center;
    }

    .footer-status {
      text-align: center;
    }
  }

  @media (max-width: 768px) {
    .landing-nav-content {
      padding: 0 var(--space-4);
    }

    .nav-actions {
      gap: var(--space-3);
    }

    .nav-link-inline {
      display: none;
    }

    .hero-section {
      padding: calc(var(--space-12) + 60px) var(--space-4) var(--space-8);
    }

    .stats-bar {
      grid-template-columns: 1fr;
    }

    .hero-actions {
      flex-direction: column;
    }

    .hero-actions .btn {
      width: 100%;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
