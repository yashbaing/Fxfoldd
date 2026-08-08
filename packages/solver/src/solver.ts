import type {
  FxRates,
  InternalFxMatch,
  NetPosition,
  SettlementCurrency,
  SolverResult,
  TradeObligation,
  ExternalFxLeg,
} from './types.js';
import { DEFAULT_FX_RATES, toUsd, USDC_EURC_RATE } from './types.js';

interface SettlementEdge {
  debtor: string;
  creditor: string;
  settlementCurrency: SettlementCurrency;
  usdAmount: number;
}

function hashResult(data: unknown): string {
  const str = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `0x${Math.abs(h).toString(16).padStart(8, '0')}${Date.now().toString(16)}`;
}

/** Stage 1: Convert obligations to settlement-currency edges and net same-currency bilateral flows */
function buildSettlementEdges(obligations: TradeObligation[], rates: FxRates): SettlementEdge[] {
  const edgeMap = new Map<string, SettlementEdge>();

  for (const ob of obligations) {
    const usd = toUsd(ob.amount, ob.invoiceCurrency, rates);
    const key = `${ob.debtor}|${ob.creditor}|${ob.settlementCurrency}`;
    const revKey = `${ob.creditor}|${ob.debtor}|${ob.settlementCurrency}`;

    if (edgeMap.has(revKey)) {
      const rev = edgeMap.get(revKey)!;
      if (rev.usdAmount > usd) {
        rev.usdAmount -= usd;
      } else if (usd > rev.usdAmount) {
        edgeMap.delete(revKey);
        edgeMap.set(key, {
          debtor: ob.debtor,
          creditor: ob.creditor,
          settlementCurrency: ob.settlementCurrency,
          usdAmount: usd - rev.usdAmount,
        });
      } else {
        edgeMap.delete(revKey);
      }
    } else {
      const existing = edgeMap.get(key);
      if (existing) existing.usdAmount += usd;
      else
        edgeMap.set(key, {
          debtor: ob.debtor,
          creditor: ob.creditor,
          settlementCurrency: ob.settlementCurrency,
          usdAmount: usd,
        });
    }
  }

  return [...edgeMap.values()].filter((e) => e.usdAmount > 0.01);
}

/** Stage 2: Multilateral netting via net position per participant per currency */
function computeNetPositions(edges: SettlementEdge[]): Map<string, Map<SettlementCurrency, number>> {
  const positions = new Map<string, Map<SettlementCurrency, number>>();

  const adjust = (participant: string, currency: SettlementCurrency, delta: number) => {
    if (!positions.has(participant)) positions.set(participant, new Map());
    const m = positions.get(participant)!;
    m.set(currency, (m.get(currency) ?? 0) + delta);
  };

  for (const e of edges) {
    adjust(e.debtor, e.settlementCurrency, -e.usdAmount);
    adjust(e.creditor, e.settlementCurrency, e.usdAmount);
  }

  return positions;
}

/** Stage 3: Internal FX matching between participants with opposing currency needs */
function matchInternalFx(
  positions: Map<string, Map<SettlementCurrency, number>>
): { matches: InternalFxMatch[]; residual: Map<string, Map<SettlementCurrency, number>> } {
  const residual = new Map<string, Map<SettlementCurrency, number>>();
  for (const [p, m] of positions) {
    residual.set(p, new Map(m));
  }

  const matches: InternalFxMatch[] = [];

  const participants = [...residual.keys()];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participants[i];
      const b = participants[j];
      const posA = residual.get(a)!;
      const posB = residual.get(b)!;

      // A has USDC surplus, needs EURC; B has EURC surplus, needs USDC
      const aUsdc = posA.get('USDC') ?? 0;
      const aEurc = posA.get('EURC') ?? 0;
      const bUsdc = posB.get('USDC') ?? 0;
      const bEurc = posB.get('EURC') ?? 0;

      if (aUsdc > 0 && aEurc < 0 && bEurc > 0 && bUsdc < 0) {
        const matchUsdc = Math.min(aUsdc, Math.abs(bUsdc));
        const matchEurc = Math.min(Math.abs(aEurc), bEurc);
        const matchUsd = Math.min(matchUsdc, matchEurc * USDC_EURC_RATE);
        if (matchUsd > 0.01) {
          const eurcAmt = matchUsd / USDC_EURC_RATE;
          matches.push({
            participantA: a,
            participantB: b,
            currencyA: 'USDC',
            currencyB: 'EURC',
            amountA: matchUsd,
            amountB: eurcAmt,
          });
          posA.set('USDC', aUsdc - matchUsd);
          posA.set('EURC', aEurc + eurcAmt);
          posB.set('EURC', bEurc - eurcAmt);
          posB.set('USDC', bUsdc + matchUsd);
        }
      }

      if (aEurc > 0 && aUsdc < 0 && bUsdc > 0 && bEurc < 0) {
        const matchEurc = Math.min(aEurc, Math.abs(bEurc));
        const matchUsdc = Math.min(Math.abs(aUsdc), bUsdc);
        const matchUsd = Math.min(matchEurc * USDC_EURC_RATE, matchUsdc);
        if (matchUsd > 0.01) {
          const eurcAmt = matchUsd / USDC_EURC_RATE;
          matches.push({
            participantA: a,
            participantB: b,
            currencyA: 'EURC',
            currencyB: 'USDC',
            amountA: eurcAmt,
            amountB: matchUsd,
          });
          posA.set('EURC', aEurc - eurcAmt);
          posA.set('USDC', aUsdc + matchUsd);
          posB.set('USDC', bUsdc - matchUsd);
          posB.set('EURC', bEurc + eurcAmt);
        }
      }
    }
  }

  return { matches, residual };
}

function computeExternalFx(residual: Map<string, Map<SettlementCurrency, number>>): {
  legs: ExternalFxLeg[];
  total: number;
} {
  let totalUsdcSurplus = 0;
  let totalUsdcDeficit = 0;
  let totalEurcSurplus = 0;
  let totalEurcDeficit = 0;

  for (const m of residual.values()) {
    const usdc = m.get('USDC') ?? 0;
    const eurc = m.get('EURC') ?? 0;
    if (usdc > 0) totalUsdcSurplus += usdc;
    else totalUsdcDeficit += Math.abs(usdc);
    if (eurc > 0) totalEurcSurplus += eurc;
    else totalEurcDeficit += Math.abs(eurc);
  }

  const legs: ExternalFxLeg[] = [];
  const matchAmount = Math.min(totalUsdcSurplus, totalEurcDeficit * USDC_EURC_RATE);
  if (matchAmount > 0.01) {
    legs.push({
      sellCurrency: 'USDC',
      buyCurrency: 'EURC',
      sellAmount: matchAmount,
      buyAmount: matchAmount / USDC_EURC_RATE,
    });
  }

  const reverseMatch = Math.min(totalEurcSurplus, totalUsdcDeficit / USDC_EURC_RATE);
  if (reverseMatch > 0.01) {
    legs.push({
      sellCurrency: 'EURC',
      buyCurrency: 'USDC',
      sellAmount: reverseMatch,
      buyAmount: reverseMatch * USDC_EURC_RATE,
    });
  }

  const total = legs.reduce((s, l) => s + l.sellAmount, 0);
  return { legs, total };
}

function flattenPositions(residual: Map<string, Map<SettlementCurrency, number>>): NetPosition[] {
  const result: NetPosition[] = [];
  for (const [participant, m] of residual) {
    for (const [currency, amount] of m) {
      if (Math.abs(amount) > 0.01) {
        result.push({ participant, currency, amount: Math.round(amount * 100) / 100 });
      }
    }
  }
  return result;
}

export function solveFXFold(
  obligations: TradeObligation[],
  rates: FxRates = DEFAULT_FX_RATES
): SolverResult {
  const grossObligations = obligations.reduce((s, o) => s + toUsd(o.amount, o.invoiceCurrency, rates), 0);

  // Gross FX demand: sum of obligations where invoice currency != settlement currency equivalent
  const grossFxDemand = obligations.reduce((s, o) => {
    const needsFx =
      (o.invoiceCurrency === 'EUR' && o.settlementCurrency === 'USDC') ||
      (o.invoiceCurrency === 'USD' && o.settlementCurrency === 'EURC') ||
      (o.invoiceCurrency === 'AED' && o.settlementCurrency === 'EURC');
    return s + (needsFx ? toUsd(o.amount, o.invoiceCurrency, rates) : 0);
  }, 0);

  const edges = buildSettlementEdges(obligations, rates);
  const positions = computeNetPositions(edges);
  const { matches, residual } = matchInternalFx(positions);
  const { legs: externalFxLegs, total: externalFx } = computeExternalFx(residual);
  const netPositions = flattenPositions(residual);

  const externalLiquidity = netPositions
    .filter((p) => p.amount < 0)
    .reduce((s, p) => s + Math.abs(p.amount), 0);

  const internalFxMatched = matches.reduce((s, m) => s + m.amountA, 0);

  const liquidityCompression = grossObligations > 0 ? 1 - externalLiquidity / grossObligations : 0;
  const fxCompression = grossFxDemand > 0 ? 1 - externalFx / grossFxDemand : 0;
  const tradeMultiplier = externalLiquidity > 0 ? grossObligations / externalLiquidity : grossObligations;

  const participants = [...new Set(obligations.flatMap((o) => [o.debtor, o.creditor]))];

  const residualEdges = edges.map((e) => ({
    from: e.debtor,
    to: e.creditor,
    amount: e.usdAmount,
    currency: e.settlementCurrency,
  }));

  const result: SolverResult = {
    grossObligations: Math.round(grossObligations),
    grossFxDemand: Math.round(grossFxDemand),
    externalLiquidity: Math.round(externalLiquidity),
    externalFx: Math.round(externalFx),
    internalFxMatched: Math.round(internalFxMatched),
    liquidityCompression,
    fxCompression,
    tradeMultiplier,
    netPositions,
    internalMatches: matches,
    externalFxLegs,
    residualEdges,
    includedObligations: obligations,
    participants,
    roundHash: hashResult({ grossObligations, externalLiquidity, netPositions }),
  };

  return result;
}
