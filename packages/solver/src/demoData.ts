import type { Company, Obligation } from "./types.js";

/**
 * Eight UAE SME trade participants across import / re-export / services.
 */
export const DEMO_COMPANIES: Company[] = [
  {
    id: "A",
    name: "Gulf Pearl Trading",
    city: "Dubai",
    sector: "Re-export",
    address: "0x1111111111111111111111111111111111111111",
  },
  {
    id: "B",
    name: "Sharjah Components",
    city: "Sharjah",
    sector: "Manufacturing",
    address: "0x2222222222222222222222222222222222222222",
  },
  {
    id: "C",
    name: "Abu Dhabi Logistics",
    city: "Abu Dhabi",
    sector: "Logistics",
    address: "0x3333333333333333333333333333333333333333",
  },
  {
    id: "D",
    name: "RAK Metals LLC",
    city: "Ras Al Khaimah",
    sector: "Commodities",
    address: "0x4444444444444444444444444444444444444444",
  },
  {
    id: "E",
    name: "Ajman Textiles",
    city: "Ajman",
    sector: "Textiles",
    address: "0x5555555555555555555555555555555555555555",
  },
  {
    id: "F",
    name: "Fujairah Fuels",
    city: "Fujairah",
    sector: "Energy",
    address: "0x6666666666666666666666666666666666666666",
  },
  {
    id: "G",
    name: "Marina Spares DMCC",
    city: "Dubai",
    sector: "Marine",
    address: "0x7777777777777777777777777777777777777777",
  },
  {
    id: "H",
    name: "Al Ain Agri Supply",
    city: "Al Ain",
    sector: "Agri",
    address: "0x8888888888888888888888888888888888888888",
  },
];

function usd(
  id: string,
  debtorId: string,
  creditorId: string,
  amount: number,
  dueDate: string
): Obligation {
  return {
    invoiceId: id,
    debtorId,
    creditorId,
    amount,
    invoiceCurrency: "USD",
    settlementCurrency: "USDC",
    dueDate,
  };
}

function eur(
  id: string,
  debtorId: string,
  creditorId: string,
  amount: number,
  dueDate: string
): Obligation {
  return {
    invoiceId: id,
    debtorId,
    creditorId,
    amount,
    invoiceCurrency: "EUR",
    settlementCurrency: "EURC",
    dueDate,
  };
}

function aed(
  id: string,
  debtorId: string,
  creditorId: string,
  amount: number,
  settlementCurrency: "USDC" | "EURC",
  dueDate: string
): Obligation {
  return {
    invoiceId: id,
    debtorId,
    creditorId,
    amount,
    invoiceCurrency: "AED",
    settlementCurrency,
    dueDate,
  };
}

/**
 * 31 accepted invoices — dense multicurrency UAE SME graph.
 * Calibrated so the deterministic solver shows dramatic liquidity + FX compression.
 */
export const DEMO_OBLIGATIONS: Obligation[] = [
  // USDC cycles
  usd("INV-001", "A", "B", 100000, "2026-08-15"),
  usd("INV-002", "B", "C", 95000, "2026-08-16"),
  usd("INV-003", "C", "D", 90000, "2026-08-18"),
  usd("INV-004", "D", "A", 80000, "2026-08-20"),
  usd("INV-005", "E", "F", 70000, "2026-08-14"),
  usd("INV-006", "F", "G", 65000, "2026-08-22"),
  usd("INV-007", "G", "E", 60000, "2026-08-12"),
  usd("INV-008", "C", "F", 55000, "2026-08-13"),
  usd("INV-009", "F", "H", 50000, "2026-08-23"),
  usd("INV-010", "H", "C", 45000, "2026-08-11"),
  usd("INV-011", "B", "D", 40000, "2026-08-26"),
  usd("INV-012", "D", "G", 38000, "2026-08-10"),
  usd("INV-013", "G", "B", 35000, "2026-08-24"),

  // EURC cycles
  eur("INV-014", "A", "B", 50000, "2026-08-27"),
  eur("INV-015", "B", "E", 47000, "2026-08-09"),
  eur("INV-016", "E", "A", 42000, "2026-08-28"),
  eur("INV-017", "F", "H", 30000, "2026-08-29"),
  eur("INV-018", "H", "D", 28000, "2026-08-08"),
  eur("INV-019", "D", "F", 25000, "2026-08-30"),
  eur("INV-020", "C", "G", 22000, "2026-08-07"),
  eur("INV-021", "G", "C", 20000, "2026-08-31"),

  // AED FX demand (no AED stablecoin on Arc — converts into USDC/EURC)
  aed("INV-022", "A", "C", 200000, "USDC", "2026-09-01"),
  aed("INV-023", "C", "E", 180000, "USDC", "2026-09-02"),
  aed("INV-024", "E", "A", 160000, "USDC", "2026-09-03"),
  aed("INV-025", "B", "F", 150000, "EURC", "2026-09-04"),
  aed("INV-026", "F", "G", 140000, "EURC", "2026-09-05"),
  aed("INV-027", "G", "B", 120000, "EURC", "2026-09-06"),
  aed("INV-028", "D", "H", 100000, "USDC", "2026-09-07"),
  aed("INV-029", "H", "D", 90000, "EURC", "2026-09-08"),

  // Residual liquidity / FX injectors
  usd("INV-030", "H", "A", 40000, "2026-09-09"),
  eur("INV-031", "E", "F", 25000, "2026-09-10"),
];

export const DEFAULT_RATES = {
  AED_USD: 0.272294,
  EUR_USD: 1.085,
  USD_USD: 1,
  USDC_EURC: 1.085,
};
