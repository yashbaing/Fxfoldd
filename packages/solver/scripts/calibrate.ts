/**
 * Search a compact obligation design that hits pitch-like compression metrics.
 */
import { DEMO_COMPANIES, DEFAULT_RATES } from "../src/demoData.js";
import { solveFxFold } from "../src/solver.js";
import type { Obligation } from "../src/types.js";

function buildObligations(): Obligation[] {
  // Tight USDC cycles (USD invoices) — high gross, low net
  const usdcCycles: Obligation[] = [
    // Cycle 1: A-B-C-D-A  gross 365k, net liquidity 20k
    ["A", "B", 100000],
    ["B", "C", 95000],
    ["C", "D", 90000],
    ["D", "A", 80000],
    // Cycle 2: E-F-G-E
    ["E", "F", 70000],
    ["F", "G", 65000],
    ["G", "E", 60000],
    // Cycle 3: C-F-H-C
    ["C", "F", 55000],
    ["F", "H", 50000],
    ["H", "C", 45000],
    // Cycle 4: B-D-G-B
    ["B", "D", 40000],
    ["D", "G", 38000],
    ["G", "B", 35000],
  ].map((row, i) => ({
    invoiceId: `INV-U${String(i + 1).padStart(2, "0")}`,
    debtorId: row[0] as string,
    creditorId: row[1] as string,
    amount: row[2] as number,
    invoiceCurrency: "USD" as const,
    settlementCurrency: "USDC" as const,
    dueDate: "2026-08-20",
  }));

  // EURC cycles (EUR invoices)
  const eurcCycles: Obligation[] = [
    ["A", "B", 50000],
    ["B", "E", 47000],
    ["E", "A", 42000],
    ["F", "H", 30000],
    ["H", "D", 28000],
    ["D", "F", 25000],
    ["C", "G", 22000],
    ["G", "C", 20000],
  ].map((row, i) => ({
    invoiceId: `INV-E${String(i + 1).padStart(2, "0")}`,
    debtorId: row[0] as string,
    creditorId: row[1] as string,
    amount: row[2] as number,
    invoiceCurrency: "EUR" as const,
    settlementCurrency: "EURC" as const,
    dueDate: "2026-08-22",
  }));

  // AED FX demand (settled USDC/EURC) in near-cycles
  const aed: Obligation[] = [
    ["A", "C", 200000, "USDC"],
    ["C", "E", 180000, "USDC"],
    ["E", "A", 160000, "USDC"],
    ["B", "F", 150000, "EURC"],
    ["F", "G", 140000, "EURC"],
    ["G", "B", 120000, "EURC"],
    ["D", "H", 100000, "USDC"],
    ["H", "D", 90000, "EURC"],
  ].map((row, i) => ({
    invoiceId: `INV-A${String(i + 1).padStart(2, "0")}`,
    debtorId: row[0] as string,
    creditorId: row[1] as string,
    amount: row[2] as number,
    invoiceCurrency: "AED" as const,
    settlementCurrency: row[3] as "USDC" | "EURC",
    dueDate: "2026-08-25",
  }));

  // Residual imbalance injectors for ~85k liquidity + opposing FX books
  const residual: Obligation[] = [
    {
      invoiceId: "INV-R01",
      debtorId: "H",
      creditorId: "A",
      amount: 40000,
      invoiceCurrency: "USD",
      settlementCurrency: "USDC",
      dueDate: "2026-09-01",
    },
    {
      invoiceId: "INV-R02",
      debtorId: "E",
      creditorId: "F",
      amount: 25000,
      invoiceCurrency: "EUR",
      settlementCurrency: "EURC",
      dueDate: "2026-09-02",
    },
  ];

  return [...usdcCycles, ...eurcCycles, ...aed, ...residual];
}

const obs = buildObligations();
console.log("count", obs.length);
const r = solveFxFold(DEMO_COMPANIES, obs, DEFAULT_RATES);
const m = r.metrics;
console.log({
  grossTradeUsd: m.grossTradeUsd.toFixed(0),
  grossFx: m.grossFxDemandUsd.toFixed(0),
  extLiq: m.externalLiquidityUsd.toFixed(0),
  extFx: m.externalFxUsd.toFixed(0),
  liqC: (m.liquidityCompression * 100).toFixed(1),
  fxC: (m.fxCompression * 100).toFixed(1),
  mult: m.tradeMultiplier.toFixed(1),
});
console.log("net", r.netPositions);
