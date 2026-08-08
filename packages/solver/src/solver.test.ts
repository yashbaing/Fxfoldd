import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES } from "./demoData.js";
import { solveFxFold } from "./solver.js";

describe("FXFold solver", () => {
  it("compresses liquidity and FX on the UAE demo graph", () => {
    const result = solveFxFold(DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES);
    const m = result.metrics;

    assert.equal(m.invoiceCount, 31);
    assert.equal(m.companyCount, 8);
    assert.ok(m.grossTradeUsd > 1_000_000, "gross trade should exceed $1M");
    assert.ok(m.externalLiquidityUsd < m.grossTradeUsd * 0.25, "liquidity compression should be strong");
    assert.ok(m.liquidityCompression > 0.7, "liquidity compression > 70%");
    assert.ok(m.fxCompression > 0.5, "fx compression > 50%");
    assert.ok(m.tradeMultiplier > 4, "trade multiplier > 4x");
    assert.ok(result.settlementLegs.length > 0);
  });

  it("nets a simple same-currency cycle to near-zero liquidity", () => {
    const companies = DEMO_COMPANIES.slice(0, 3);
    const obligations = [
      {
        invoiceId: "T1",
        debtorId: "A",
        creditorId: "B",
        amount: 100,
        invoiceCurrency: "USD" as const,
        settlementCurrency: "USDC" as const,
        dueDate: "2026-08-01",
      },
      {
        invoiceId: "T2",
        debtorId: "B",
        creditorId: "C",
        amount: 100,
        invoiceCurrency: "USD" as const,
        settlementCurrency: "USDC" as const,
        dueDate: "2026-08-01",
      },
      {
        invoiceId: "T3",
        debtorId: "C",
        creditorId: "A",
        amount: 100,
        invoiceCurrency: "USD" as const,
        settlementCurrency: "USDC" as const,
        dueDate: "2026-08-01",
      },
    ];
    const result = solveFxFold(companies, obligations, DEFAULT_RATES);
    assert.ok(result.metrics.externalLiquidityUsd < 1);
    assert.ok(result.metrics.liquidityCompression > 0.99);
  });
});
