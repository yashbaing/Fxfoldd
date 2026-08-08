# FXFold

**Multicurrency trade compression for UAE SMEs.**

> Net first. FX the rest. Settle once.

FXFold nets SME trade obligations across currencies, matches opposing FX demand internally, and settles only the remaining liquidity and FX gap on [Arc](https://docs.arc.network).

## Why FXFold (vs obligation-only netting)

| | Cycles-style netting | **FXFold** |
|---|---|---|
| Optimizes | Obligations → minimum liquidity | **Obligations + currency demand → minimum liquidity + minimum FX** |
| One-liner | How little cash can settle the network? | How little cash **and FX** can settle the network? |

## Live on Arc Testnet (chain `5042002`)

| Contract | Address |
|---|---|
| ObligationRegistry | [`0xdCEA9245A47D5a75333E3510015D431BF93B3963`](https://testnet.arcscan.app/address/0xdCEA9245A47D5a75333E3510015D431BF93B3963) |
| ClearingRound | [`0x2e3B67b1457801F70875B77804ed2b76963C5160`](https://testnet.arcscan.app/address/0x2e3B67b1457801F70875B77804ed2b76963C5160) |
| AtomicSettlement | [`0x09B8B6b85907bfa62F8e9B76d20fFd4d4547BC37`](https://testnet.arcscan.app/address/0x09B8B6b85907bfa62F8e9B76d20fFd4d4547BC37) |
| StableFXAdapter (demo) | [`0x35FBbf682006867968249327bB5E53734eE427D0`](https://testnet.arcscan.app/address/0x35FBbf682006867968249327bB5E53734eE427D0) |
| USDC | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

Seeded demo: **Clearing Round `#1`** — 12 accepted obligations, 8 SME participants, operator-approved and ready for atomic settlement.

Deployment artifact: [`contracts/deployments/arc-testnet.json`](./contracts/deployments/arc-testnet.json)

## Demo metrics (deterministic solver)

Against the 8-SME / 31-invoice UAE graph:

| Metric | Value |
|---|---|
| Gross Trade | ~$1.49M |
| Gross FX Demand | ~$310K |
| External Liquidity | ~$87K |
| External FX | ~$6.1K |
| Liquidity Compression | **94.1%** |
| FX Compression | **98.0%** |
| Trade Multiplier | **17.0×** |

## Architecture

```
Invoices (AED/USD/EUR)
        ↓ bilateral wallet acceptance
ObligationRegistry (Arc)
        ↓ off-chain FXFold solver
   Stage 1: same-currency netting
   Stage 2: multilateral obligation netting
   Stage 3: cross-currency FX matching
        ↓
ClearingRound (+ EIP-712 / operator approvals)
        ↓ residual only
StableFXAdapter (demo RFQ) ──→ Circle StableFX later
        ↓
AtomicSettlement (USDC/EURC transfers, all-or-nothing)
```

## Repo layout

```
contracts/           Foundry (paris EVM) — Arc-ready Solidity
packages/solver/     Deterministic netting + FX compression engine
packages/web/        Hackathon demo UI (graph → FOLD → residual FX → settle)
```

## Quick start

### Prerequisites

- Node 20+
- [Foundry](https://book.getfoundry.sh/)
- Arc Testnet USDC from [Circle Faucet](https://faucet.circle.com)

### Install

```bash
npm install
cd contracts && forge install && forge build
```

### Run solver

```bash
npm run solver:demo
npm run solver:test
```

### Run demo UI

```bash
cp packages/web/.env.production packages/web/.env
npm run dev
```

Open `http://localhost:5173` → press **FOLD**.

## Deploy on Vercel

This repo is Vercel-ready via root [`vercel.json`](./vercel.json).

1. Import **yashbaing/Fxfoldd** in [Vercel](https://vercel.com/new)
2. Framework preset: **Vite** (auto from `vercel.json`)
3. Keep defaults:
   - **Install:** `npm install`
   - **Build:** `npm run build -w @fxfold/web`
   - **Output:** `packages/web/dist`
4. Deploy — Arc contract addresses are already baked into `packages/web/.env.production`

Optional CLI:

```bash
npm i -g vercel
vercel --prod
```

No secrets required for the public demo (only public `VITE_*` addresses).

### Deploy / re-seed on Arc

```bash
export PRIVATE_KEY=0x...
export ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io

cd contracts
forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC_URL --broadcast

export OBLIGATION_REGISTRY=0x...
export CLEARING_ROUND=0x...
forge script script/SeedDemo.s.sol:SeedDemo --rpc-url $ARC_TESTNET_RPC_URL --broadcast --slow
```

## Pitch line

**Move less money. Exchange less currency. Clear more trade.**

UAE is making trade machine-readable through eInvoicing. FXFold turns those obligations into a programmable multicurrency clearing network.

## Track

Primary: **SME Trade Finance** — reduce how much credit SMEs need in the first place.
