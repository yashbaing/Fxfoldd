import { m } from "framer-motion";
import { formatPct, formatUsd } from "@fxfold/solver";

type FxStageProps = {
  reducedMotion: boolean;
  externalFxUsd: number;
  residualFxUsd: number;
  internalFxMatchedUsd: number;
  fxCompression: number;
  onAuthorize: () => void;
};

export function FxStage({
  reducedMotion,
  externalFxUsd,
  residualFxUsd,
  internalFxMatchedUsd,
  fxCompression,
  onAuthorize,
}: FxStageProps) {
  return (
    <m.section
      key="fx"
      className="panel"
      initial={reducedMotion ? false : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
    >
      <div className="kicker">StableFX · residual only</div>
      <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
        Only unmatched FX reaches StableFX
      </h2>
      <div className="result-grid">
        <div className="stat-block">
          <div className="label">Network residual FX</div>
          <div className="value">{formatUsd(externalFxUsd)}</div>
        </div>
        <div className="stat-block">
          <div className="label">Your residual FX</div>
          <div className="value">{formatUsd(residualFxUsd)}</div>
        </div>
        <div className="stat-block">
          <div className="label">Internal FX matched</div>
          <div className="value good">{formatUsd(internalFxMatchedUsd)}</div>
        </div>
        <div className="stat-block">
          <div className="label">FX Compression</div>
          <div className="value">{formatPct(fxCompression)}</div>
        </div>
      </div>
      <p className="badge-demo">
        Demo StableFX adapter - residual execution layer, not the core product
      </p>
      <div className="cta-row" style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary" onClick={onAuthorize}>
          Authorize Settlement
        </button>
      </div>
    </m.section>
  );
}
