import { m } from "framer-motion";
import { formatUsd } from "@fxfold/solver";
import { TradeGraph } from "../TradeGraph";

type NetworkStageProps = {
  reducedMotion: boolean;
  grossTradeUsd: number;
  grossFxDemandUsd: number;
  smeName: string;
  smeCity: string;
  isConnected: boolean;
  onContinue: () => void;
};

export function NetworkStage({
  reducedMotion,
  grossTradeUsd,
  grossFxDemandUsd,
  smeName,
  smeCity,
  isConnected,
  onContinue,
}: NetworkStageProps) {
  return (
    <m.section
      key="network"
      className="hero-stage"
      initial={reducedMotion ? false : { opacity: 0, transform: "translateY(16px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={reducedMotion ? undefined : { opacity: 0, transform: "translateY(-12px)" }}
    >
      <div>
        <div className="kicker">UAE SME trade network · Arc Testnet</div>
        <h1 className="hero-brand">
          FX<em>Fold</em>
        </h1>
        <p className="hero-sub">
          Eight businesses. Thirty-one accepted invoices across AED, USD and EUR. You are the
          highlighted SME - the other seven are pre-authorized demo participants.
        </p>
      </div>

      <TradeGraph folding={false} folded={false} />

      <div>
        <div className="metrics-row">
          <div className="metric">
            <div className="label">Gross Trade</div>
            <div className="value">{formatUsd(grossTradeUsd)}</div>
          </div>
          <div className="metric">
            <div className="label">Gross FX Demand</div>
            <div className="value">{formatUsd(grossFxDemandUsd)}</div>
          </div>
          <div className="metric">
            <div className="label">You</div>
            <div className="value" style={{ fontSize: "1.25rem" }}>
              {smeName}
            </div>
          </div>
        </div>
        <div className="cta-row" style={{ marginTop: "1.25rem" }}>
          <button className="btn btn-primary" onClick={onContinue}>
            {isConnected ? "Continue as this SME" : "Connect as this SME"}
          </button>
          <span className="tagline">
            Your wallet = {smeName} ({smeCity})
          </span>
        </div>
      </div>
    </m.section>
  );
}
