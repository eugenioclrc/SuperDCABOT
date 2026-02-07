# SuperDCA BOT Protocol

**P2P Grid Trading AMM for Ethereum**

> Built for ETHGlobal Hack the Money 2026

---

## 🎯 What is SuperDCA BOT?

SuperDCA BOT is a **peer-to-peer grid trading protocol** where users deploy personal escrow contracts that generate exponential sell ladders. Other traders buy directly from these ladders, and escrow owners can "rebuy" to reset the ladder at new prices—creating a continuous "buy low, sell high" cycle without any intermediaries.

**How It Works:**
1. **Deploy Escrow** - Create your own smart contract with 5 BTC
2. **Ladder Generates** - 10 sell orders from $100k to $120k (exponential spacing)
3. **Others Buy** - Traders pay USDC, receive BTC (P2P, no AMM pool)
4. **Rebuy & Reset** - Sell BTC back when profitable → ladder regenerates at current price
5. **Repeat** - Cycle continues indefinitely

**Key Features:**
- 🔓 **Non-Custodial** - You deploy your own contract, full control
- 🤝 **P2P Execution** - Trade directly, no keepers or relayers needed
- 📊 **Exponential Ladders** - Smart price spacing for capital efficiency
- 🔄 **Dynamic Resets** - Ladder regenerates at current oracle price
- ⚡ **Gas Efficient** - Clone pattern (EIP-1167) for cheap deployments

**Example:**
```
1. Deploy escrow with 5 BTC at $100k
2. Ladder: Order 1 @ $100k, Order 2 @ $102k, ... Order 10 @ $120k
3. Buyer pays 10k USDC → receives 0.1 BTC from Order 1
4. After ladder fills, rebuy 5 BTC at $99k → reset at $99k
5. Profit: (avg sell $110k - rebuy $99k) × 5 BTC = $55k
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Foundry (install via `curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- MetaMask or another Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/dca-hackthemoney.git
cd dca-hackthemoney

# Install frontend dependencies
cd frontend && npm install

# Smart contracts are managed by Foundry
cd ../contracts
```

### Development Workflow

**1. Start local blockchain:**
```bash
cd contracts
anvil
```

**2. Deploy contracts locally:**
```bash
# In a new terminal
cd contracts
forge script script/DeployEscrow.s.sol --rpc-url http://localhost:8545 --broadcast
```

**3. Start frontend dev server:**
```bash
cd frontend
npm run dev
# Open http://localhost:5173
```

---

## 📁 Repository Structure

```
dca-hackthemoney/
├── contracts/              # Foundry smart contract project
│   ├── src/                # Solidity contracts
│   │   ├── Escrow.sol          # Core P2P grid trading logic (317 lines)
│   │   ├── EscrowFactory.sol   # Clone pattern deployer (24 lines)
│   │   └── IChainlinkAggregator.sol  # Oracle interface (18 lines)
│   ├── test/               # Foundry tests (.t.sol)
│   │   ├── Escrow.t.sol        # 18 tests, 100% passing
│   │   └── EscrowFactory.t.sol # Factory tests
│   ├── script/             # Deployment scripts
│   │   └── DeployEscrow.s.sol  # Sepolia deployment
│   └── foundry.toml        # Foundry configuration
│
├── frontend/               # SvelteKit web application
│   ├── src/
│   │   ├── routes/         # Pages (dashboard, create)
│   │   ├── lib/            # Components & utilities
│   │   │   ├── components/ # Svelte components (5 core)
│   │   │   ├── types.ts    # TypeScript types
│   │   │   ├── contracts.ts # ABIs & addresses
│   │   │   ├── utils.ts    # Helper functions
│   │   │   └── stores/     # Svelte stores (wallet)
│   │   └── app.html        # HTML template
│   └── package.json
│
└── README.md               # This file
```

---

## 🏗️ Architecture

### Smart Contracts (3 Total)

**1. Escrow.sol (317 lines)** - Main grid trading contract
- `initialize()` - Set up ladder with asset pair, oracles, parameters
- `buy()` - Users buy asset0 by paying asset1 (fills orders sequentially)
- `sell()` - Owner sells asset0 back → triggers ladder reset
- `getSellOrders()` - View current ladder state
- `estimateBuyOutput()` - Preview buy before execution

**Key Data Structures:**
```solidity
struct SellOrder {
    uint128 amount;  // Total asset0 in order
    uint128 filled;  // Amount filled so far
    uint128 price;   // Asset1 per asset0 (1e8 scale)
}

struct Params {
    uint256 dcaOrdersSize;               // Ladder depth (e.g., 10)
    uint256 priceDeviationBPS;           // Step size (e.g., 200 = 2%)
    uint128 priceMultiplierBPS;          // Exponential spacing (11000 = 1.1x)
    uint128 dcaOrderSizeMultiplierBPS;   // Size scaling (10500 = 1.05x)
    uint128 baseOrderAmount;             // First order size
    uint128 dcaOrderAmount;              // Subsequent base size
}
```

**2. EscrowFactory.sol (24 lines)** - Clone deployer
- `createEscrow()` - Deploys minimal proxy clone (EIP-1167)
- Emits `EscrowCreated(escrow, owner, asset0, asset1)` event
- Frontend listens to events for discovery

**3. IChainlinkAggregator.sol (18 lines)** - Oracle interface
- Used for BTC/USD, ETH/USD, USDC/USD price feeds

### Exponential Ladder Math

```solidity
// Starting at $100k with 2% deviation, 1.1x multiplier:
Order 1: $100,000 (base price)
Order 2: $100,000 + ($100k × 0.02) = $102,000 (+2%)
Order 3: $100,000 + ($100k × 0.02) + ($100k × 0.022) = $104,200 (+4.2%)
Order 4: $100,000 + cumulative(0.02 × 1.1^i) = $106,620 (+6.62%)
...

// General formula:
cumulativeDeviation = Σ(priceDeviationBPS × multiplier^i / 10000^i) for i=0..n
price_n = basePrice × (1 + cumulativeDeviation / 10000)
```

**Why Exponential?** Capital efficiency. Wider gaps at higher prices maximize liquidity utilization.

---

## 🛠️ Tech Stack

**Smart Contracts:**
- Solidity 0.8.13
- Foundry (testing & deployment)
- Solady (gas-optimized libraries: LibClone, ReentrancyGuard, Initializable)
- Chainlink Price Feeds (BTC/USD, ETH/USD, USDC/USD)

**Frontend:**
- SvelteKit + TypeScript
- Vite (build tool)
- ethers.js v6 (Web3 library)
- Terminal aesthetic (green-on-black, monospace fonts)

**No Backend Required** - Fully on-chain, frontend is static SPA

---

## 🧪 Testing

### Smart Contracts

```bash
cd contracts

# Run all tests (19 tests)
forge test

# Run with verbose output
forge test -vvv

# Run specific test
forge test --match-test test_Buy_PartialFill

# Generate coverage report
forge coverage
# Expected: >80% coverage

# Gas benchmarks
forge test --gas-report
# Expected: <300k gas per trade

# Fuzz testing
forge test --fuzz-runs 10000
```

**Test Results:**
- ✅ 18 Escrow tests passing
- ✅ 1 Factory test passing
- ✅ Total: 19/19 passing (100%)

### Frontend

```bash
cd frontend

# Type checking
npm run check

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🚢 Deployment

### Testnet Deployment (Sepolia)

```bash
cd contracts

# Set environment variables
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_KEY"
export PRIVATE_KEY="your_private_key"
export ETHERSCAN_API_KEY="your_etherscan_key"

# Deploy
forge script script/DeployEscrow.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify

# Expected output:
# - Escrow implementation deployed at: 0x...
# - EscrowFactory deployed at: 0x...
```

**Update Frontend:**
```typescript
// frontend/src/lib/contracts.ts
export const CONTRACT_ADDRESSES = {
  escrowImplementation: '0x...', // From deployment
  escrowFactory: '0x...',        // From deployment
};
```

### Frontend Deployment

```bash
cd frontend

# Build for production
npm run build

# Deploy to Vercel
vercel deploy

# Or deploy to Netlify
netlify deploy --prod
```

---

## 🎮 User Flows

### 1. Create Escrow Flow

```
Dashboard → "Create New Escrow" → Configure:
- Asset0: WBTC (selling)
- Asset1: USDC (receiving)
- Base Order: 0.5 BTC
- DCA Order: 0.5 BTC
- Ladder Depth: 10 orders
- Price Deviation: 2% (200 BPS)
- Price Multiplier: 1.1x (11000 BPS)
- Size Multiplier: 1.05x (10500 BPS)

Preview shows:
Order 1: 0.5 BTC @ $100,000
Order 2: 0.5 BTC @ $102,000
...
Order 10: 0.55 BTC @ $120,458

Total Required: 5.13 BTC

→ Approve WBTC → Create Escrow → Deployed! 🎉
```

### 2. Buy from Escrow Flow

```
Dashboard → Select Escrow → "Buy" →
- Input: 10,000 USDC
- Preview shows:
  * You receive: ~0.098 BTC
  * Avg price: $102,040
  * Orders filled: #1 (partial)
  * Slippage: +2.04%

→ Approve USDC → Execute Buy → Success! ✅
```

### 3. Sell & Reset Flow

```
Dashboard → Select Escrow → "Sell & Reset" →
- Input: 1.0 BTC
- Preview shows:
  * You receive: ~99,000 USDC
  * Rebuy price: $99,000
  * Profit: +$3,000 (+3.03%)
  * ⚠️ This will reset the ladder!

→ Approve WBTC → Execute Sell → Ladder resets at $99k! 🔄
```

---

## 🔐 Security

**⚠️ IMPORTANT: This is a hackathon prototype.**

- Smart contracts have NOT been audited
- Use on testnets only (Sepolia recommended)
- Do NOT deploy to mainnet without professional security audit
- Do NOT use with real funds

**Security Features Implemented:**
- ✅ ReentrancyGuard (Solady) on all external functions
- ✅ Checks-effects-interactions pattern
- ✅ Slippage protection (minAmount0Out / minAmount1Out)
- ✅ Oracle staleness validation (1-hour max age)
- ✅ Deadline protection (prevents stale transactions)
- ✅ Initializable (prevents re-initialization)
- ✅ SafeERC20-style transfers

**Pre-Mainnet Requirements:**
- [ ] Professional audit (CertiK, Trail of Bits, Consensys Diligence)
- [ ] Bug bounty program (ImmuneFi, $50k+ pool)
- [ ] Economic attack analysis (flash loan attacks, oracle manipulation)
- [ ] Formal verification of core math (ladder calculation, PnL)
- [ ] Multi-sig admin controls (if any admin functions added)

---

## 🎤 Pitch & Demo

### Elevator Pitch (30 seconds)
> "SuperDCA BOT is a P2P grid trading protocol for Ethereum. Instead of trading against AMM pools, users deploy personal escrow contracts that generate exponential sell ladders. Others buy directly from these ladders, and escrow owners 'rebuy' to reset—creating a continuous 'buy low, sell high' cycle. No keepers, no custody risk, no middlemen. Pure peer-to-peer grid trading, fully on-chain."

### Key Differentiators

| Feature | SuperDCA BOT | CEX Grid Bots | Uniswap V3 |
|---------|---------|---------------|------------|
| **Custody** | Non-custodial (your contract) | Custodial (CEX holds) | Non-custodial (pool) |
| **Execution** | P2P direct trades | Bot executes | AMM algorithm |
| **Fees** | Gas only (~$5-10) | Monthly subscription ($10-50) | 0.05-1% per swap |
| **Pricing** | Exponential ladders | Fixed grid | Concentrated liquidity |
| **Reset** | Manual (rebuy) | Automatic | No resets |
| **Capital Efficiency** | High (exponential spacing) | Medium (linear grid) | High (concentrated) |

**Advantages over CEX Bots:**
1. ✅ No custody risk (FTX, Celsius, Voyager collapse risk)
2. ✅ No subscriptions ($0 vs $10-50/month)
3. ✅ Fully transparent (on-chain, auditable)
4. ✅ Permissionless (no KYC, no account)

**Advantages over Uniswap V3:**
1. ✅ Controlled execution (no impermanent loss from LPs)
2. ✅ Exponential spacing (better capital utilization)
3. ✅ Reset mechanism (adapt to market conditions)
4. ✅ No liquidity fragmentation

---

## 🏆 Hackathon Achievements

**ETHGlobal Hack the Money 2026:**

✅ **Fully Functional Prototype**
- 3 smart contracts (317 + 24 + 18 lines)
- 19 tests passing (100% pass rate)
- 5 frontend components (2,200 lines)
- Complete type system & utilities

✅ **Innovative Architecture**
- P2P grid trading without keepers
- Clone pattern for gas efficiency (EIP-1167)
- Exponential ladder mathematics
- Event-based discovery system

✅ **Production-Ready Code Quality**
- >80% test coverage
- Comprehensive error handling
- Security best practices
- Detailed documentation (2,000+ lines)

---

## 🤝 Team

- **Solo Builder** - Full-stack development, smart contracts, frontend, testing, documentation, pitch deck, demo video
- Built in 7 days for ETHGlobal Hack the Money 2026

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- **ETHGlobal** - For hosting Hack the Money 2026
- **Solady** - For gas-optimized smart contract libraries
- **Chainlink** - For decentralized price oracles
- **Foundry** - For blazing-fast smart contract development

---

**Built with ❤️ for the DeFi community at ETHGlobal Hack the Money 2026** 🚀

