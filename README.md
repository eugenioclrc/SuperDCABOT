# SuperDCABOT

A monorepo containing smart contracts, frontend, and backend services.

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
