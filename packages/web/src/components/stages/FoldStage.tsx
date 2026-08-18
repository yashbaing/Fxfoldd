import { m } from "framer-motion";
import { formatMult, formatUsd } from "@fxfold/solver";
import type { SmeView, SolverResult } from "@fxfold/solver";
import { TradeGraph } from "../TradeGraph";

type FoldStageProps = {
  reducedMotion: boolean;
  folding: boolean;
  result: SolverResult;
  sme: SmeView;
  onSeeFx: () => void;
};

export function FoldStage({ reducedMotion, folding, result, sme, onSeeFx }: FoldStageProps) {
  const mtr = result.metrics;
  return (
    <m.section
      key="fold"
      className="panel"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
    >
      <div className="kicker">Network-level compression · not a wallet tx</div>
      <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
        {folding ? "Folding obligations…" : "Your invoices folded with 7 other SMEs"}
      </h2>
      <TradeGraph folding={folding} folded={!folding} />

      {!folding && (
        <>
          <div className="result-grid">
            <div className="stat-block">
              <div className="label">Invoices → net legs</div>
              <div className="value" style={{ fontSize: "1.8rem" }}>
                {mtr.invoiceCount} → {result.settlementLegs.length}
              </div>
            </div>
            <div className="stat-block">
              <div className="label">Gross → net settlement</div>
              <div className="value" style={{ fontSize: "1.8rem" }}>
                {formatUsd(mtr.grossTradeUsd)} → {formatUsd(mtr.externalLiquidityUsd)}
              </div>
            </div>
            <div className="stat-block">
              <div className="label">Gross FX → matched → residual</div>
              <div className="value" style={{ fontSize: "1.5rem" }}>
                {formatUsd(mtr.grossFxDemandUsd)} → {formatUsd(mtr.internalFxMatchedUsd)} →{" "}
                {formatUsd(mtr.externalFxUsd)}
              </div>
            </div>
            <div className="stat-block">
              <div className="label">Trade Multiplier</div>
              <div className="value good">{formatMult(mtr.tradeMultiplier)}</div>
            </div>
          </div>

          <div className="you-panel">
            <div className="kicker">Your Result · {sme.company.name}</div>
            <div className="you-compare">
              <div>
                <div className="label">Before FOLD</div>
                <div className="value" style={{ fontSize: "1.6rem" }}>
                  {sme.beforeActionCount} separate payments / FX
                </div>
                <ul className="list-quiet">
                  {sme.beforeActions.map((a) => (
                    <li key={a.label + a.detail}>
                      <span>{a.label}</span>
                      <span className="tagline">{a.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="you-arrow">↓</div>
              <div>
                <div className="label">After FOLD</div>
                <div className="value good" style={{ fontSize: "1.6rem" }}>
                  1 final net position
                </div>
                <p className="hero-sub">{sme.yourResultSummary}</p>
                <p className="tagline">
                  Net USDC {sme.netUsdc >= 0 ? "+" : "−"}
                  {formatUsd(Math.abs(sme.netUsdc))}
                  {Math.abs(sme.netEurc) > 0.5
                    ? ` · Net EURC ${sme.netEurc >= 0 ? "+" : "−"}${Math.abs(sme.netEurc).toFixed(0)}`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="cta-row" style={{ marginTop: "1.5rem" }}>
            <button className="btn btn-primary" onClick={onSeeFx}>
              See residual FX
            </button>
          </div>
        </>
      )}
    </m.section>
  );
}
