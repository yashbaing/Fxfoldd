export type InvoiceCurrency = "AED" | "USD" | "EUR";
export type SettlementCurrency = "USDC" | "EURC";

export interface Company {
  id: string;
  name: string;
  city: string;
  sector: string;
  /** Demo wallet address (checksum optional) */
  address: `0x${string}`;
}

export interface Obligation {
  invoiceId: string;
  debtorId: string;
  creditorId: string;
  amount: number; // major units in invoice currency
  invoiceCurrency: InvoiceCurrency;
  settlementCurrency: SettlementCurrency;
  dueDate: string;
}

export interface FxRates {
  /** Invoice currency → USD */
  AED_USD: number;
  EUR_USD: number;
  USD_USD: number;
  /** Settlement pairs */
  USDC_EURC: number;
}

export interface NetPosition {
  companyId: string;
  usdc: number; // +surplus / -deficit
  eurc: number;
}

export interface FxMatch {
  fromCompanyId: string;
  toCompanyId: string;
  fromCurrency: SettlementCurrency;
  toCurrency: SettlementCurrency;
  fromAmount: number;
  toAmount: number;
  external: boolean;
}

export interface SettlementLeg {
  fromCompanyId: string;
  toCompanyId: string;
  currency: SettlementCurrency;
  amount: number;
}

export interface CompressionMetrics {
  grossTradeUsd: number;
  grossFxDemandUsd: number;
  externalLiquidityUsd: number;
  externalFxUsd: number;
  internalFxMatchedUsd: number;
  liquidityCompression: number;
  fxCompression: number;
  tradeMultiplier: number;
  invoiceCount: number;
  companyCount: number;
}

export interface SolverResult {
  rates: FxRates;
  metrics: CompressionMetrics;
  netPositions: NetPosition[];
  settlementLegs: SettlementLeg[];
  fxMatches: FxMatch[];
  residualFx: FxMatch[];
  cancelledCycles: Array<{ path: string[]; currency: SettlementCurrency; amount: number }>;
  obligationIds: string[];
}
