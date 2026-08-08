export type InvoiceCurrency = 'AED' | 'USD' | 'EUR';
export type SettlementCurrency = 'USDC' | 'EURC';

export interface SME {
  id: string;
  name: string;
  address: `0x${string}`;
  city: string;
}

export interface TradeObligation {
  invoiceId: string;
  debtor: string;
  creditor: string;
  amount: number; // invoice denomination (whole units)
  invoiceCurrency: InvoiceCurrency;
  settlementCurrency: SettlementCurrency;
  dueDate: string;
}

export interface FxRates {
  AED: number; // per 1 AED in USD
  USD: number;
  EUR: number; // per 1 EUR in USD
}

export interface NetPosition {
  participant: string;
  currency: SettlementCurrency;
  amount: number; // positive = receives, negative = pays (USD equivalent)
}

export interface InternalFxMatch {
  participantA: string;
  participantB: string;
  currencyA: SettlementCurrency;
  currencyB: SettlementCurrency;
  amountA: number;
  amountB: number;
}

export interface ExternalFxLeg {
  sellCurrency: SettlementCurrency;
  buyCurrency: SettlementCurrency;
  sellAmount: number;
  buyAmount: number;
}

export interface SolverResult {
  grossObligations: number;
  grossFxDemand: number;
  externalLiquidity: number;
  externalFx: number;
  internalFxMatched: number;
  liquidityCompression: number;
  fxCompression: number;
  tradeMultiplier: number;
  netPositions: NetPosition[];
  internalMatches: InternalFxMatch[];
  externalFxLegs: ExternalFxLeg[];
  residualEdges: Array<{ from: string; to: string; amount: number; currency: SettlementCurrency }>;
  includedObligations: TradeObligation[];
  participants: string[];
  roundHash: string;
}

export const DEFAULT_FX_RATES: FxRates = {
  AED: 0.2723,
  USD: 1,
  EUR: 1.08,
};

export const USDC_EURC_RATE = 1.08; // 1 EURC = 1.08 USDC

export function toUsd(amount: number, currency: InvoiceCurrency, rates: FxRates = DEFAULT_FX_RATES): number {
  return amount * rates[currency];
}

export function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
