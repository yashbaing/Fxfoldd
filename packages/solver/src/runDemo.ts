import { DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES } from "./demoData.js";
import { formatMult, formatPct, formatUsd, solveFxFold } from "./solver.js";

const result = solveFxFold(DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES);
const m = result.metrics;

console.log("=== FXFold Demo Solver ===");
console.log(`Companies: ${m.companyCount}`);
console.log(`Invoices:  ${m.invoiceCount}`);
console.log(`Gross Trade:          ${formatUsd(m.grossTradeUsd)} (${m.grossTradeUsd.toFixed(2)})`);
console.log(`Gross FX Demand:      ${formatUsd(m.grossFxDemandUsd)} (${m.grossFxDemandUsd.toFixed(2)})`);
console.log(`External Liquidity:   ${formatUsd(m.externalLiquidityUsd)} (${m.externalLiquidityUsd.toFixed(2)})`);
console.log(`External FX:          ${formatUsd(m.externalFxUsd)} (${m.externalFxUsd.toFixed(2)})`);
console.log(`Internal FX Matched:  ${formatUsd(m.internalFxMatchedUsd)}`);
console.log(`Liquidity Compression:${formatPct(m.liquidityCompression)}`);
console.log(`FX Compression:       ${formatPct(m.fxCompression)}`);
console.log(`Trade Multiplier:     ${formatMult(m.tradeMultiplier)}`);
console.log(`Settlement legs:      ${result.settlementLegs.length}`);
console.log(`Internal FX matches:  ${result.fxMatches.length}`);
console.log(`Residual FX legs:     ${result.residualFx.length}`);
