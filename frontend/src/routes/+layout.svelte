<script lang="ts">
	import "../app.css";
	import { wallet } from "../lib/stores/wallet";
	import { page } from "$app/stores";

	let { children } = $props();

	const navItems = [
		{ path: "/dashboard", label: "DASHBOARD", icon: "▸" },
		{ path: "/backtest", label: "BACKTEST", icon: "⟳" },
		{ path: "/create", label: "CREATE_ORDER", icon: "+" },
	];

	function formatAddress(address: string): string {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	// Hide sidebar on landing page
	const isLandingPage = $derived($page.url.pathname === "/");
</script>

<svelte:head>
	<title>AutoDCA Terminal | Non-Custodial DCA Protocol</title>
	<meta
		name="description"
		content="Professional-grade DCA trading automation on Ethereum"
	/>
</svelte:head>

<div class="app-container" class:landing-mode={isLandingPage}>
	<!-- Terminal Navigation (hidden on landing page) -->
	{#if !isLandingPage}
		<nav class="terminal-nav">
			<div class="nav-header">
				<h1 class="nav-logo text-glow-cyan">
					<span class="logo-bracket">[</span>
					AUTO<span class="text-glow-amber">DCA</span>
					<span class="logo-bracket">]</span>
				</h1>
				<p class="nav-subtitle label">NON-CUSTODIAL_PROTOCOL_v1.0</p>
			</div>

			<ul class="nav-links">
				{#each navItems as item}
					<li>
						<a
							href={item.path}
							class="nav-link"
							class:active={$page.url.pathname === item.path}
						>
							<span class="nav-icon">{item.icon}</span>
							<span class="nav-label">{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>

			<div class="nav-footer">
				<!-- Wallet Connection -->
				<div class="wallet-section">
					{#if $wallet.isConnected}
						<div class="wallet-connected">
							<span class="wallet-address text-glow-green"
								>{formatAddress($wallet.address || "")}</span
							>
							<button
								onclick={() => wallet.disconnect()}
								class="btn btn-danger btn-sm"
							>
								✕ DISCONNECT
							</button>
						</div>
					{:else}
						<button
							onclick={() => wallet.connect()}
							class="btn btn-primary w-full"
						>
							▸ CONNECT_WALLET
						</button>
					{/if}
				</div>

				<!-- System Status -->
				<div class="status-indicator">
					<span class="status-dot"></span>
					<span class="status-text">SYSTEM_ONLINE</span>
				</div>
				<p class="label">NODE: 0x7A9F_SEPOLIA</p>
			</div>
		</nav>
	{/if}

	<!-- Main Content Area -->
	<main class="terminal-main">
		{@render children()}
	</main>
</div>

<style>
	.app-container {
		display: flex;
		min-height: 100vh;
		background: var(--noir-void);
	}

	/* ═══════════════════════════════════════════════════════════════════════
	   TERMINAL NAVIGATION
	   ═══════════════════════════════════════════════════════════════════════ */

	.terminal-nav {
		width: 280px;
		background: var(--noir-charcoal);
		border-right: 2px solid var(--phosphor-cyan);
		display: flex;
		flex-direction: column;
		position: fixed;
		height: 100vh;
		z-index: 100;

		/* Subtle inner glow */
		box-shadow: inset -10px 0 30px rgba(0, 255, 209, 0.05);
	}

	.nav-header {
		padding: var(--space-8) var(--space-6);
		border-bottom: 1px solid var(--noir-steel);
	}

	.nav-logo {
		font-family: var(--font-terminal);
		font-size: var(--text-2xl);
		font-weight: 700;
		letter-spacing: 0.15em;
		margin: 0;
		text-transform: uppercase;
	}

	.logo-bracket {
		color: var(--text-tertiary);
	}

	.nav-subtitle {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
	}

	/* Navigation Links */
	.nav-links {
		flex: 1;
		padding: var(--space-6) 0;
		list-style: none;
		margin: 0;
	}

	.nav-link {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-6);
		color: var(--text-secondary);
		text-decoration: none;
		font-family: var(--font-terminal);
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
		position: relative;
	}

	.nav-link::before {
		content: "";
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: var(--phosphor-cyan);
		box-shadow: 0 0 10px var(--phosphor-cyan);
		transform: scaleY(0);
		transform-origin: bottom;
		transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.nav-link:hover {
		color: var(--phosphor-cyan);
		background: rgba(0, 255, 209, 0.05);
	}

	.nav-link:hover::before {
		transform: scaleY(1);
	}

	.nav-link.active {
		color: var(--phosphor-cyan);
		background: rgba(0, 255, 209, 0.1);
		text-shadow: var(--glow-cyan);
	}

	.nav-link.active::before {
		transform: scaleY(1);
	}

	.nav-icon {
		font-size: var(--text-lg);
		transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.nav-link:hover .nav-icon {
		transform: scale(1.2);
	}

	.nav-link.active .nav-icon {
		animation: glowPulse 2s ease-in-out infinite;
	}

	.nav-label {
		text-transform: uppercase;
	}

	/* Navigation Footer */
	.nav-footer {
		padding: var(--space-6);
		border-top: 1px solid var(--noir-steel);
	}

	.wallet-section {
		margin-bottom: var(--space-4);
	}

	.wallet-connected {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.wallet-address {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		padding: var(--space-2) var(--space-3);
		background: rgba(57, 255, 20, 0.1);
		border: 1px solid var(--phosphor-green);
		border-radius: var(--radius-sm);
		text-align: center;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
		font-size: var(--text-sm);
		color: var(--phosphor-green);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--phosphor-green);
		box-shadow: var(--glow-green);
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(0.9);
		}
	}

	@keyframes glowPulse {
		0%,
		100% {
			text-shadow:
				0 0 10px currentColor,
				0 0 20px currentColor;
			transform: scale(1);
		}
		50% {
			text-shadow:
				0 0 15px currentColor,
				0 0 30px currentColor,
				0 0 40px currentColor;
			transform: scale(1.05);
		}
	}

	.status-text {
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Main Content Area */
	.terminal-main {
		flex: 1;
		margin-left: 280px;
		position: relative;
	}

	/* Landing Page Mode - Full Width */
	.landing-mode .terminal-main {
		margin-left: 0;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.terminal-nav {
			width: 100%;
			height: auto;
			position: relative;
			border-right: none;
			border-bottom: 2px solid var(--phosphor-cyan);
		}

		.nav-links {
			display: flex;
			padding: var(--space-4) var(--space-6);
		}

		.nav-link {
			flex-direction: column;
			gap: var(--space-1);
			padding: var(--space-3);
		}

		.nav-link::before {
			width: 100%;
			height: 2px;
			left: 0;
			top: auto;
			bottom: 0;
			transform: scaleX(0);
			transform-origin: left;
		}

		.nav-link:hover::before,
		.nav-link.active::before {
			transform: scaleX(1);
		}

		.nav-icon {
			font-size: var(--text-2xl);
		}

		.nav-label {
			font-size: var(--text-xs);
		}

		.terminal-main {
			margin-left: 0;
		}
	}
</style>
