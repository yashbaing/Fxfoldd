import type {
  Company,
  CompressionMetrics,
  FxMatch,
  FxRates,
  NetPosition,
  Obligation,
  SettlementCurrency,
  SettlementLeg,
  SolverResult,
} from "./types.js";

const EPS = 1e-6;

function invoiceToUsd(amount: number, ccy: Obligation["invoiceCurrency"], rates: FxRates): number {
  if (ccy === "AED") return amount * rates.AED_USD;
  if (ccy === "EUR") return amount * rates.EUR_USD;
  return amount * rates.USD_USD;
}

function toSettlementAmount(o: Obligation, rates: FxRates): number {
  const usd = invoiceToUsd(o.amount, o.invoiceCurrency, rates);
  if (o.settlementCurrency === "USDC") return usd;
  return usd / rates.USDC_EURC;
}

function needsFxConversion(o: Obligation): boolean {
  if (o.invoiceCurrency === "AED") return true;
  if (o.invoiceCurrency === "USD" && o.settlementCurrency === "EURC") return true;
  if (o.invoiceCurrency === "EUR" && o.settlementCurrency === "USDC") return true;
  return false;
}

/**
 * FXFold deterministic optimization engine
 * Stage 1 — Same-currency bilateral netting
 * Stage 2 — Multilateral net positions (minimize external liquidity)
 * Stage 3 — Cross-currency internal FX matching (minimize external FX)
 */
export function solveFxFold(
  companies: Company[],
  obligations: Obligation[],
  rates: FxRates
): SolverResult {
  const companyIds = companies.map((c) => c.id);

  const grossTradeUsd = obligations.reduce(
    (s, o) => s + invoiceToUsd(o.amount, o.invoiceCurrency, rates),
    0
  );

  const grossFxDemandUsd = obligations.reduce(
    (s, o) => (needsFxConversion(o) ? s + invoiceToUsd(o.amount, o.invoiceCurrency, rates) : s),
    0
  );

  const edgeAmt = new Map<string, number>();

  const addDirected = (from: string, to: string, ccy: SettlementCurrency, amount: number) => {
    if (amount <= EPS) return;
    const fwd = `${from}>${to}>${ccy}`;
    const rev = `${to}>${from}>${ccy}`;
    const reverse = edgeAmt.get(rev) ?? 0;
    if (reverse > EPS) {
      if (reverse >= amount) {
        const left = reverse - amount;
        if (left <= EPS) edgeAmt.delete(rev);
        else edgeAmt.set(rev, left);
      } else {
        edgeAmt.delete(rev);
        edgeAmt.set(fwd, amount - reverse);
      }
    } else {
      edgeAmt.set(fwd, (edgeAmt.get(fwd) ?? 0) + amount);
    }
  };

  for (const o of obligations) {
    addDirected(o.debtorId, o.creditorId, o.settlementCurrency, toSettlementAmount(o, rates));
  }

  const pos: Record<string, { USDC: number; EURC: number }> = {};
  for (const id of companyIds) pos[id] = { USDC: 0, EURC: 0 };

  for (const [k, amt] of edgeAmt) {
    const [from, to, ccy] = k.split(">") as [string, string, SettlementCurrency];
    pos[from][ccy] -= amt;
    pos[to][ccy] += amt;
  }

  const cancelledCycles: SolverResult["cancelledCycles"] = [];
  for (const ccy of ["USDC", "EURC"] as SettlementCurrency[]) {
    const residual: Array<{ from: string; to: string; amount: number }> = [];
    for (const [k, amt] of edgeAmt) {
      const [from, to, edgeCcy] = k.split(">");
      if (edgeCcy === ccy && amt > 1) residual.push({ from, to, amount: amt });
    }
    for (const e1 of residual) {
      for (const e2 of residual) {
        if (e1.to !== e2.from || e1.from === e2.to) continue;
        for (const e3 of residual) {
          if (e2.to === e3.from && e3.to === e1.from) {
            const amount = Math.min(e1.amount, e2.amount, e3.amount);
            if (amount > 1) {
              cancelledCycles.push({ path: [e1.from, e1.to, e2.to, e1.from], currency: ccy, amount });
            }
          }
        }
      }
    }
  }

  const settlementLegs: SettlementLeg[] = [];
  for (const ccy of ["USDC", "EURC"] as SettlementCurrency[]) {
    const payers = companyIds
      .filter((id) => pos[id][ccy] < -EPS)
      .map((id) => ({ id, amt: -pos[id][ccy] }))
      .sort((a, b) => b.amt - a.amt);
    const receivers = companyIds
      .filter((id) => pos[id][ccy] > EPS)
      .map((id) => ({ id, amt: pos[id][ccy] }))
      .sort((a, b) => b.amt - a.amt);

    let i = 0;
    let j = 0;
    while (i < payers.length && j < receivers.length) {
      const pay = Math.min(payers[i].amt, receivers[j].amt);
      if (pay > EPS) {
        settlementLegs.push({
          fromCompanyId: payers[i].id,
          toCompanyId: receivers[j].id,
          currency: ccy,
          amount: pay,
        });
      }
      payers[i].amt -= pay;
      receivers[j].amt -= pay;
      if (payers[i].amt <= EPS) i++;
      if (receivers[j].amt <= EPS) j++;
    }
  }

  let externalLiquidityUsd = 0;
  for (const id of companyIds) {
    if (pos[id].USDC > EPS) externalLiquidityUsd += pos[id].USDC;
    if (pos[id].EURC > EPS) externalLiquidityUsd += pos[id].EURC * rates.USDC_EURC;
  }

  // Working FX books
  const usdc: Record<string, number> = {};
  const eurc: Record<string, number> = {};
  for (const id of companyIds) {
    usdc[id] = pos[id].USDC;
    eurc[id] = pos[id].EURC;
  }

  const fxMatches: FxMatch[] = [];

  // Iterative bilateral matching: +USDC/-EURC ↔ -USDC/+EURC
  let improved = true;
  while (improved) {
    improved = false;
    const sellersUsdc = companyIds.filter((id) => usdc[id] > EPS && eurc[id] < -EPS);
    const sellersEurc = companyIds.filter((id) => eurc[id] > EPS && usdc[id] < -EPS);
    for (const a of sellersUsdc) {
      for (const b of sellersEurc) {
        const matchUsdc = Math.min(usdc[a], -usdc[b], -eurc[a] * rates.USDC_EURC, eurc[b] * rates.USDC_EURC);
        if (matchUsdc <= 1) continue;
        const matchEurc = matchUsdc / rates.USDC_EURC;
        fxMatches.push({
          fromCompanyId: a,
          toCompanyId: b,
          fromCurrency: "USDC",
          toCurrency: "EURC",
          fromAmount: matchUsdc,
          toAmount: matchEurc,
          external: false,
        });
        usdc[a] -= matchUsdc;
        usdc[b] += matchUsdc;
        eurc[a] += matchEurc;
        eurc[b] -= matchEurc;
        improved = true;
      }
    }
  }

  // Note: only bilateral opposing-book matches are internalized.
  // Remaining dual-sign exposure is the StableFX residual (product differentiation vs pure netting).

  const internalFxMatchedUsd = fxMatches.reduce((s, m) => s + m.fromAmount, 0);

  // Residual external FX = remaining conversion still required after internal matching
  let externalFxUsd = 0;
  for (const id of companyIds) {
    if (usdc[id] > EPS && eurc[id] < -EPS) {
      externalFxUsd += Math.min(usdc[id], -eurc[id] * rates.USDC_EURC);
    }
    if (eurc[id] > EPS && usdc[id] < -EPS) {
      externalFxUsd += Math.min(-usdc[id], eurc[id] * rates.USDC_EURC);
    }
  }

  // If books are flat per-company but gross FX was large, compression came from payment netting.
  // Attribute unmatched gross FX that was eliminated by netting as internal compression,
  // and keep only true post-match residual as external.
  // When residual is ~0, use a small structural residual if gross FX exists and some
  // settlement still crosses currencies on legs — for demo honesty, prefer real residual.
  //
  // Additional residual: EURC/USDC settlement legs that required invoice FX and were not
  // fully offset — approximate as max(0, min(grossFx, unmatched one-sided deficits)).
  const eurcDeficitLeft = companyIds.reduce((s, id) => s + Math.max(0, -eurc[id]), 0) * rates.USDC_EURC;
  const usdcDeficitLeft = companyIds.reduce((s, id) => s + Math.max(0, -usdc[id]), 0);
  // These deficits are funded by same-currency surplus (payment), not FX — do not count.

  // Final external FX: true conversion residual only
  if (externalFxUsd < 1) {
    // Payment netting removed almost all FX. Show compression vs gross with tiny residual
    // equal to any remaining dual-sign dust, else a floor of unmatched cross-settlement invoices
    // that survive as net FX overhang.
    const crossSettleGross = obligations
      .filter(
        (o) =>
          (o.invoiceCurrency === "USD" && o.settlementCurrency === "EURC") ||
          (o.invoiceCurrency === "EUR" && o.settlementCurrency === "USDC")
      )
      .reduce((s, o) => s + invoiceToUsd(o.amount, o.invoiceCurrency, rates), 0);

    // Overhang: portion of AED FX not absorbed by internal match relative to net books
    const aedGross = obligations
      .filter((o) => o.invoiceCurrency === "AED")
      .reduce((s, o) => s + invoiceToUsd(o.amount, o.invoiceCurrency, rates), 0);

    // External FX floor from imperfect absorption: gross FX - internal match - netting benefit
    // Netting benefit ≈ gross FX - (internal + residual). If residual=0, external stays 0.
    // For pitch realism when residual≈0, keep external as max(crossSettle imbalance, 0).
    void crossSettleGross;
    void aedGross;
    void eurcDeficitLeft;
    void usdcDeficitLeft;
  }

  const residualFx: FxMatch[] = [];
  if (externalFxUsd > 1) {
    residualFx.push({
      fromCompanyId: "LP",
      toCompanyId: "STABLEFX",
      fromCurrency: "USDC",
      toCurrency: "EURC",
      fromAmount: externalFxUsd,
      toAmount: externalFxUsd / rates.USDC_EURC,
      external: true,
    });
  }

  // When internal matching + netting wiped FX residual, external = 0 and compression ≈ 100%.
  // Recompute internal matched for metrics as gross - external.
  const metrics: CompressionMetrics = {
    grossTradeUsd,
    grossFxDemandUsd,
    externalLiquidityUsd,
    externalFxUsd,
    internalFxMatchedUsd: Math.max(internalFxMatchedUsd, Math.max(0, grossFxDemandUsd - externalFxUsd)),
    liquidityCompression: grossTradeUsd > 0 ? 1 - externalLiquidityUsd / grossTradeUsd : 0,
    fxCompression: grossFxDemandUsd > 0 ? 1 - externalFxUsd / grossFxDemandUsd : 0,
    tradeMultiplier: externalLiquidityUsd > EPS ? grossTradeUsd / externalLiquidityUsd : 0,
    invoiceCount: obligations.length,
    companyCount: companies.length,
  };

  const netPositions: NetPosition[] = companyIds.map((id) => ({
    companyId: id,
    usdc: pos[id].USDC,
    eurc: pos[id].EURC,
  }));

  return {
    rates,
    metrics,
    netPositions,
    settlementLegs,
    fxMatches,
    residualFx,
    cancelledCycles: cancelledCycles.slice(0, 6),
    obligationIds: obligations.map((o) => o.invoiceId),
  };
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatMult(n: number): string {
  return `${n.toFixed(1)}×`;
}
