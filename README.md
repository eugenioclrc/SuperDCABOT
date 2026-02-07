# SuperDCABOT

**P2P Grid Trading AMM for Ethereum**

> Built for ETHGlobal Hack the Money 2026

NOTE: This is a monorepo containing smart contracts, frontend, and backend services.

---

## 🎯 What is SuperDCABOT?

SuperDCABOT is a **peer-to-peer grid trading protocol** where users deploy personal escrow contracts that generate exponential sell ladders. Other traders buy directly from these ladders, and escrow owners can "rebuy" to reset the ladder at new prices—creating a continuous "buy low, sell high" cycle without any intermediaries.

## Structure

```
dca-hackthemoney2/
├── contracts/       # Foundry/Forge smart contracts
├── frontend/        # SvelteKit frontend application
└── keep/           # Bun backend service
```

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) (for frontend and keep)
- [Foundry](https://getfoundry.sh) (for contracts)

### Installation

Install dependencies for all workspaces:
```bash
bun install
```

### Development

**Frontend (SvelteKit):**
```bash
bun run dev:frontend
# or
cd frontend && bun run dev
```

**Keep (Bun service):**
```bash
bun run dev:keep
# or
cd keep && bun run index.ts
```

**Contracts (Forge):**
```bash
cd contracts
forge build
forge test
```

### Build

**Frontend:**
```bash
bun run build:frontend
```

**Contracts:**
```bash
bun run build:contracts
```

## Project Details

### Contracts
- Framework: Foundry/Forge
- Location: `./contracts`
- Standard Forge project structure with `src/`, `test/`, and `script/` directories

### Frontend
- Framework: SvelteKit 5
- TypeScript: Yes
- Location: `./frontend`
- Package manager: Bun

### Keep
- Runtime: Bun
- TypeScript: Yes
- Location: `./keep`
- Entry point: `index.ts`
