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
| ObligationRegistry | [`0xabb7…E862`](https://testnet.arcscan.app/address/0xabb7649BCa61379536197D420B0D37f85CdfE862) |
| ClearingRound | [`0x6017…6d1a`](https://testnet.arcscan.app/address/0x60171ca8455F41A82c041607e4dE069BecAF6d1a) |
| AtomicSettlement | [`0x7272…5Cf1`](https://testnet.arcscan.app/address/0x72721853fb5253AaCf19d567A529dF0664bd5Cf1) |
| StableFXAdapter (demo) | [`0xF092…63cA`](https://testnet.arcscan.app/address/0xF092eB2152dd9AD2CaF3Dd76c44194De331263cA) |
| USDC | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |

### Participant demo flow
You are **one real SME** (RAK Metals) inside an 8-SME network. The other 7 are pre-authorized.

1. Connect wallet → mapped to your SME  
2. **Join Clearing Round** → `8 / 8 SMEs ready`  
3. **Run FOLD** (off-chain) → see network compression + **Your Result**  
4. **Fund Net Position** → real Arc USDC tx (5 USDC demo deposit)  
5. Round settles → tx hash + Arc Explorer  

Seeded: **Clearing Round `#1`** — approved, peers ready, waiting for your fund.

Deployment artifact: [`contracts/deployments/arc-testnet.json`](./contracts/deployments/arc-testnet.json)

## Participant demo flow

The connected wallet is **one real SME** (RAK Metals) inside the 8-SME network:

1. **Network** — 8 SMEs / 31 invoices; your node is highlighted  
2. **Connect as SME** — wallet maps to you; see pay/receive in AED·USD·EUR  
3. **Join Round** — you join; 7 peers are pre-authorized → `8 / 8 ready`  
4. **Run FOLD** — off-chain compression (no wallet popup) + **Your Result**  
5. **Residual FX** — network residual + your residual  
6. **Fund Net Position** — real Arc USDC tx from your wallet (not admin)  
7. **Settled** — tx hash + Arc Explorer + round ID  

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
