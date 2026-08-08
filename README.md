# FXFold

**Multicurrency Trade Compression for UAE SMEs**

> Net first. FX the rest. Settle once.

FXFold nets SME trade obligations across currencies, matches opposing FX demand internally, and settles only the remaining liquidity and FX gap on [Arc Testnet](https://docs.arc.io/arc/references/connect-to-arc).

## Live on Arc Testnet

| Contract | Address |
|----------|---------|
| **ObligationRegistry** | [`0x3d72617B8ef426fEFD1EA0765684A51862304b78`](https://testnet.arcscan.app/address/0x3d72617B8ef426fEFD1EA0765684A51862304b78) |
| **ClearingRound** | [`0x538c36747F043a3AbFb765ed49E379A19A85F776`](https://testnet.arcscan.app/address/0x538c36747F043a3AbFb765ed49E379A19A85F776) |
| **AtomicSettlement** | [`0x7e61732c43b94C91988b95d122D34b55719F66d8`](https://testnet.arcscan.app/address/0x7e61732c43b94C91988b95d122D34b55719F66d8) |
| **StableFXAdapter** | [`0x7c24eA0e04DAe74284129738f8cD35ae4C95E24d`](https://testnet.arcscan.app/address/0x7c24eA0e04DAe74284129738f8cD35ae4C95E24d) |

**Chain:** Arc Testnet (5042002) · **RPC:** `https://rpc.testnet.arc.io` · **Explorer:** [testnet.arcscan.app](https://testnet.arcscan.app)

## What It Does

1. **Payment Compression** — Multilateral netting finds circular obligations and reduces gross invoices to minimum external liquidity.
2. **FX Compression** — Matches opposing USDC/EURC requirements internally; only residual FX goes to StableFX.
3. **Atomic Settlement** — Entire clearing round executes on Arc — all transfers succeed or revert together.

### Demo Metrics (8 SMEs, 31 invoices)

| Metric | Before | After FOLD |
|--------|--------|------------|
| Gross Trade | ~$1.24M | — |
| External Liquidity | $1.24M | ~$85K |
| Gross FX Demand | ~$410K | ~$62K external |
| Trade Multiplier | 1× | ~14.6× |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Frontend   │────▶│ FXFold Solver │────▶│ ClearingRound   │
│  (React)    │     │  (TypeScript) │     │  (Arc contract) │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                     ┌──────────────────────────────┼──────────────────┐
                     ▼                              ▼                  ▼
            ObligationRegistry            AtomicSettlement    StableFXAdapter
            (bilateral accept)            (USDC/EURC xfer)    (residual FX)
```

## Project Structure

```
├── contracts/          # Solidity (Foundry) — Arc Testnet deployment
│   ├── src/
│   │   ├── ObligationRegistry.sol
│   │   ├── ClearingRound.sol
│   │   ├── AtomicSettlement.sol
│   │   └── StableFXAdapter.sol
│   └── deployments/arc-testnet.json
├── packages/solver/    # Off-chain optimization engine
│   └── src/solver.ts   # 3-stage: same-currency → multilateral → FX match
└── frontend/           # React demo UI with graph visualization
```

## Quick Start

### Prerequisites

- Node.js 20+
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Install

```bash
npm install
cd packages/solver && npm install && npm run build
cd ../../frontend && npm install
```

### Run Demo UI

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — connect MetaMask to Arc Testnet, press **FOLD**, walk through the 4-screen demo flow.

### Add Arc Testnet to Wallet

| Field | Value |
|-------|-------|
| Network | Arc Testnet |
| RPC | `https://rpc.testnet.arc.io` |
| Chain ID | `5042002` |
| Currency | USDC |

Get testnet USDC/EURC from [faucet.circle.com](https://faucet.circle.com).

### Deploy Contracts (optional re-deploy)

```bash
cd contracts
export PRIVATE_KEY=your_key_with_usdc_for_gas
forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast --legacy
```

### Run Contract Tests

```bash
cd contracts && forge test
```

## Solver Stages

1. **Same-Currency Netting** — Offset bilateral obligations in the same settlement currency.
2. **Multilateral Obligation Netting** — Compute net positions per participant per currency.
3. **Cross-Currency Matching** — Pair participants with opposing USDC/EURC surpluses/deficits.

## Differentiation vs Cycles Protocol

| | Cycles | FXFold |
|---|--------|--------|
| Optimizes | Obligations → min liquidity | Obligations + currency demand → min liquidity + min FX |
| Tagline | How little cash settles the network | How little cash **and FX** settle the network |

## License

MIT
