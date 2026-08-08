import { formatUsd, formatPct } from '@fxfold/solver';
import type { SolverResult } from '@fxfold/solver';

interface Props {
  result: SolverResult | null;
  before?: boolean;
}

export function MetricsPanel({ result, before = false }: Props) {
  if (before || !result) {
    return (
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Gross Trade</div>
          <div className="metric-value">{formatUsd(result?.grossObligations ?? 1_240_000)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Gross FX Demand</div>
          <div className="metric-value">{formatUsd(result?.grossFxDemand ?? 410_000)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Invoices</div>
          <div className="metric-value">31</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">SMEs</div>
          <div className="metric-value">8</div>
        </div>
      </div>
    );
  }

  return (
    <div className="metrics-grid">
      <div className="metric-card highlight">
        <div className="metric-label">External Liquidity</div>
        <div className="metric-value big">{formatUsd(result.externalLiquidity)}</div>
      </div>
      <div className="metric-card highlight">
        <div className="metric-label">External FX</div>
        <div className="metric-value big">{formatUsd(result.externalFx)}</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Liquidity Compression</div>
        <div className="metric-value">{formatPct(result.liquidityCompression)}</div>
        <div className="compression-bar">
          <div className="compression-fill" style={{ width: `${result.liquidityCompression * 100}%` }} />
        </div>
      </div>
      <div className="metric-card">
        <div className="metric-label">FX Compression</div>
        <div className="metric-value">{formatPct(result.fxCompression)}</div>
        <div className="compression-bar">
          <div className="compression-fill" style={{ width: `${result.fxCompression * 100}%` }} />
        </div>
      </div>
      <div className="metric-card highlight">
        <div className="metric-label">Trade Multiplier</div>
        <div className="metric-value big">{result.tradeMultiplier.toFixed(1)}×</div>
      </div>
      <div className="metric-card">
        <div className="metric-label">Internal FX Matched</div>
        <div className="metric-value">{formatUsd(result.internalFxMatched)}</div>
      </div>
    </div>
  );
}
