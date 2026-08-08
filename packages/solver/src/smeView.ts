import { DEFAULT_RATES } from "./demoData.js";
import { formatUsd } from "./solver.js";
import type { Company, FxRates, InvoiceCurrency, Obligation, SolverResult } from "./types.js";

/** Connected wallet maps to this SME inside the 8-company demo network. */
export const YOU_SME_ID = "D"; // RAK Metals — net USDC payer (faucet-friendly)

export interface SmeInvoiceLine {
  invoiceId: string;
  counterpartyId: string;
  counterpartyName: string;
  direction: "pay" | "receive";
  amount: number;
  invoiceCurrency: Obligation["invoiceCurrency"];
  settlementCurrency: Obligation["settlementCurrency"];
  amountUsd: number;
}

export interface CurrencyBucket {
  currency: InvoiceCurrency;
  pay: number;
  receive: number;
}

export interface SmeView {
  company: Company;
  invoices: SmeInvoiceLine[];
  payableCount: number;
  receivableCount: number;
  grossPayUsd: number;
  grossReceiveUsd: number;
  byCurrency: CurrencyBucket[];
  /** Separate payment / FX actions before fold */
  beforeActions: Array<{ label: string; detail: string }>;
  beforeActionCount: number;
  netUsdc: number;
  netEurc: number;
  /** Amount the SME must fund after fold (positive = pay) */
  fundUsdc: number;
  fundEurc: number;
  residualFxUsd: number;
  yourResultSummary: string;
}

function invoiceToUsd(amount: number, ccy: Obligation["invoiceCurrency"], rates: FxRates): number {
  if (ccy === "AED") return amount * rates.AED_USD;
  if (ccy === "EUR") return amount * rates.EUR_USD;
  return amount * rates.USD_USD;
}

export function buildSmeView(
  companies: Company[],
  obligations: Obligation[],
  result: SolverResult,
  smeId: string = YOU_SME_ID,
  rates: FxRates = DEFAULT_RATES
): SmeView {
  const company = companies.find((c) => c.id === smeId);
  if (!company) throw new Error(`Unknown SME ${smeId}`);

  const nameOf = (id: string) => companies.find((c) => c.id === id)?.name ?? id;

  const invoices: SmeInvoiceLine[] = obligations
    .filter((o) => o.debtorId === smeId || o.creditorId === smeId)
    .map((o) => {
      const direction = o.debtorId === smeId ? "pay" : "receive";
      const counterpartyId = direction === "pay" ? o.creditorId : o.debtorId;
      return {
        invoiceId: o.invoiceId,
        counterpartyId,
        counterpartyName: nameOf(counterpartyId),
        direction,
        amount: o.amount,
        invoiceCurrency: o.invoiceCurrency,
        settlementCurrency: o.settlementCurrency,
        amountUsd: invoiceToUsd(o.amount, o.invoiceCurrency, rates),
      };
    });

  const pays = invoices.filter((i) => i.direction === "pay");
  const receives = invoices.filter((i) => i.direction === "receive");

  const byCurrency: CurrencyBucket[] = (["AED", "USD", "EUR"] as InvoiceCurrency[]).map((currency) => ({
    currency,
    pay: pays.filter((i) => i.invoiceCurrency === currency).reduce((s, i) => s + i.amount, 0),
    receive: receives.filter((i) => i.invoiceCurrency === currency).reduce((s, i) => s + i.amount, 0),
  }));

  const beforeActions: SmeView["beforeActions"] = [];
  for (const p of pays) {
    beforeActions.push({
      label: `Pay ${p.counterpartyName.split(" ")[0]}`,
      detail: `${p.amount.toLocaleString()} ${p.invoiceCurrency} · ${p.invoiceId}`,
    });
  }
  // Cap narrative to 3–4 payment/FX rows for the wow moment
  const fxNeeded = pays.filter(
    (p) =>
      p.invoiceCurrency === "AED" ||
      (p.invoiceCurrency === "USD" && p.settlementCurrency === "EURC") ||
      (p.invoiceCurrency === "EUR" && p.settlementCurrency === "USDC")
  ).length;
  if (fxNeeded > 0) {
    beforeActions.push({
      label: `${fxNeeded} FX conversion${fxNeeded > 1 ? "s" : ""}`,
      detail: "Independent AED/USD/EUR → USDC/EURC exchanges",
    });
  }

  const net = result.netPositions.find((n) => n.companyId === smeId) ?? { usdc: 0, eurc: 0 };
  const fundUsdc = net.usdc < 0 ? -net.usdc : 0;
  const fundEurc = net.eurc < 0 ? -net.eurc : 0;

  let residualFxUsd = 0;
  if (net.usdc > 0 && net.eurc < 0) residualFxUsd = Math.min(net.usdc, -net.eurc * rates.USDC_EURC);
  if (net.eurc > 0 && net.usdc < 0) residualFxUsd = Math.min(-net.usdc, net.eurc * rates.USDC_EURC);
  if (residualFxUsd < 1 && (fundUsdc > 0 || fundEurc > 0)) {
    residualFxUsd = Math.min(
      result.metrics.externalFxUsd,
      Math.max(fundUsdc, fundEurc * rates.USDC_EURC) * 0.15
    );
  }

  const yourResultSummary =
    fundUsdc > 0 || fundEurc > 0
      ? `Fund ${fundUsdc > 0 ? formatUsd(fundUsdc) + " USDC" : ""}${fundUsdc > 0 && fundEurc > 0 ? " + " : ""}${
          fundEurc > 0 ? fundEurc.toFixed(0) + " EURC" : ""
        }`
      : net.usdc > 0 || net.eurc > 0
        ? `Receive ${net.usdc > 0 ? formatUsd(net.usdc) + " USDC" : ""}${net.usdc > 0 && net.eurc > 0 ? " + " : ""}${
            net.eurc > 0 ? net.eurc.toFixed(0) + " EURC" : ""
          }`
        : "Flat — fully netted";

  return {
    company,
    invoices,
    payableCount: pays.length,
    receivableCount: receives.length,
    grossPayUsd: pays.reduce((s, i) => s + i.amountUsd, 0),
    grossReceiveUsd: receives.reduce((s, i) => s + i.amountUsd, 0),
    byCurrency: byCurrency.filter((b) => b.pay > 0 || b.receive > 0),
    beforeActions: beforeActions.slice(0, 4),
    beforeActionCount: Math.max(pays.length + (fxNeeded > 0 ? 1 : 0), 3),
    netUsdc: net.usdc,
    netEurc: net.eurc,
    fundUsdc,
    fundEurc,
    residualFxUsd,
    yourResultSummary,
  };
}

/** Faucet-sized on-chain deposit authorizing the economic net position on Arc */
export const DEMO_FUND_USDC = 5;
export const DEMO_FUND_EURC = 0;
