import type { SME, TradeObligation } from './types.js';

/** 8 UAE SMEs for hackathon demo — addresses are deterministic Anvil/Hardhat-style for reproducibility */
export const DEMO_SMES: SME[] = [
  { id: 'A', name: 'Al Noor Trading', address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', city: 'Dubai' },
  { id: 'B', name: 'Gulf Logistics LLC', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', city: 'Abu Dhabi' },
  { id: 'C', name: 'Desert Tech Solutions', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', city: 'Sharjah' },
  { id: 'D', name: 'Emirates Import Co', address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', city: 'Dubai' },
  { id: 'E', name: 'Falcon Foods FZE', address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', city: 'Ajman' },
  { id: 'F', name: 'Pearl Marine Services', address: '0x9965507D1a55bcC2695C58ba16Fa37c819D0A4e6', city: 'Fujairah' },
  { id: 'G', name: 'Oasis Retail Group', address: '0x976EA74026E726554dB657Fa54763abd0C3a0aa9', city: 'Dubai' },
  { id: 'H', name: 'Sandstone Construction', address: '0x14dC79964da2C08b23698B20387C16bDa233bC18', city: 'Ras Al Khaimah' },
];

const addr = (id: string) => DEMO_SMES.find((s) => s.id === id)!.address;

/** 31 invoices across AED/USD/EUR with USDC/EURC settlement — tuned for ~$1.24M gross trade */
export const DEMO_OBLIGATIONS: TradeObligation[] = [
  // Cycle A→B→C→D→A (classic netting demo)
  { invoiceId: 'INV-001', debtor: 'A', creditor: 'B', amount: 100000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-01' },
  { invoiceId: 'INV-002', debtor: 'B', creditor: 'C', amount: 95000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-05' },
  { invoiceId: 'INV-003', debtor: 'C', creditor: 'D', amount: 90000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-10' },
  { invoiceId: 'INV-004', debtor: 'D', creditor: 'A', amount: 80000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-15' },

  // AED denominated (converted to USDC at clearing)
  { invoiceId: 'INV-005', debtor: 'A', creditor: 'E', amount: 367000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-02' },
  { invoiceId: 'INV-006', debtor: 'E', creditor: 'F', amount: 330000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-08' },
  { invoiceId: 'INV-007', debtor: 'F', creditor: 'A', amount: 293000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-12' },

  // EUR with EURC settlement
  { invoiceId: 'INV-008', debtor: 'B', creditor: 'G', amount: 90000, invoiceCurrency: 'EUR', settlementCurrency: 'EURC', dueDate: '2026-09-03' },
  { invoiceId: 'INV-009', debtor: 'G', creditor: 'H', amount: 85000, invoiceCurrency: 'EUR', settlementCurrency: 'EURC', dueDate: '2026-09-07' },
  { invoiceId: 'INV-010', debtor: 'H', creditor: 'B', amount: 75000, invoiceCurrency: 'EUR', settlementCurrency: 'EURC', dueDate: '2026-09-14' },

  // Cross-currency FX matching opportunities
  { invoiceId: 'INV-011', debtor: 'C', creditor: 'E', amount: 50000, invoiceCurrency: 'USD', settlementCurrency: 'EURC', dueDate: '2026-09-04' },
  { invoiceId: 'INV-012', debtor: 'E', creditor: 'C', amount: 48000, invoiceCurrency: 'EUR', settlementCurrency: 'USDC', dueDate: '2026-09-06' },
  { invoiceId: 'INV-013', debtor: 'D', creditor: 'G', amount: 120000, invoiceCurrency: 'USD', settlementCurrency: 'EURC', dueDate: '2026-09-09' },
  { invoiceId: 'INV-014', debtor: 'G', creditor: 'D', amount: 110000, invoiceCurrency: 'EUR', settlementCurrency: 'USDC', dueDate: '2026-09-11' },

  // Dense network edges
  { invoiceId: 'INV-015', debtor: 'A', creditor: 'C', amount: 45000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-01' },
  { invoiceId: 'INV-016', debtor: 'C', creditor: 'A', amount: 42000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-13' },
  { invoiceId: 'INV-017', debtor: 'B', creditor: 'D', amount: 65000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-02' },
  { invoiceId: 'INV-018', debtor: 'D', creditor: 'B', amount: 60000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-16' },
  { invoiceId: 'INV-019', debtor: 'E', creditor: 'G', amount: 55000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-05' },
  { invoiceId: 'INV-020', debtor: 'G', creditor: 'E', amount: 50000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-10' },
  { invoiceId: 'INV-021', debtor: 'F', creditor: 'H', amount: 40000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-03' },
  { invoiceId: 'INV-022', debtor: 'H', creditor: 'F', amount: 38000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-15' },
  { invoiceId: 'INV-023', debtor: 'A', creditor: 'G', amount: 70000, invoiceCurrency: 'EUR', settlementCurrency: 'EURC', dueDate: '2026-09-04' },
  { invoiceId: 'INV-024', debtor: 'G', creditor: 'A', amount: 65000, invoiceCurrency: 'EUR', settlementCurrency: 'EURC', dueDate: '2026-09-12' },
  { invoiceId: 'INV-025', debtor: 'B', creditor: 'F', amount: 88000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-06' },
  { invoiceId: 'INV-026', debtor: 'F', creditor: 'B', amount: 82000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-14' },
  { invoiceId: 'INV-027', debtor: 'C', creditor: 'H', amount: 95000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-07' },
  { invoiceId: 'INV-028', debtor: 'H', creditor: 'C', amount: 90000, invoiceCurrency: 'USD', settlementCurrency: 'USDC', dueDate: '2026-09-17' },
  { invoiceId: 'INV-029', debtor: 'D', creditor: 'E', amount: 52000, invoiceCurrency: 'EUR', settlementCurrency: 'EURC', dueDate: '2026-09-08' },
  { invoiceId: 'INV-030', debtor: 'E', creditor: 'D', amount: 48000, invoiceCurrency: 'USD', settlementCurrency: 'EURC', dueDate: '2026-09-11' },
  { invoiceId: 'INV-031', debtor: 'A', creditor: 'H', amount: 110000, invoiceCurrency: 'AED', settlementCurrency: 'USDC', dueDate: '2026-09-09' },
];

export function resolveDemoObligations(): TradeObligation[] {
  return DEMO_OBLIGATIONS.map((o) => ({
    ...o,
    debtor: addr(o.debtor),
    creditor: addr(o.creditor),
  }));
}

export function getSmeByAddress(address: string): SME | undefined {
  return DEMO_SMES.find((s) => s.address.toLowerCase() === address.toLowerCase());
}

export function getSmeLabel(address: string): string {
  const sme = getSmeByAddress(address);
  return sme ? `${sme.id}: ${sme.name}` : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
