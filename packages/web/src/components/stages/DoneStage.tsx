import { m } from "framer-motion";
import { DEMO_FUND_EURC, DEMO_FUND_USDC, formatMult, formatUsd } from "@fxfold/solver";
import { CONTRACTS, EXPLORER, ROUND_ID } from "../../lib/wagmi";

type DoneStageProps = {
  reducedMotion: boolean;
  grossTradeUsd: number;
  tradeMultiplier: number;
  txHash?: `0x${string}`;
  onBack: () => void;
};

export function DoneStage({
  reducedMotion,
  grossTradeUsd,
  tradeMultiplier,
  txHash,
  onBack,
}: DoneStageProps) {
  return (
    <m.section
      key="done"
      className="finale"
      initial={reducedMotion ? false : { opacity: 0, transform: "translateY(10px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
    >
      <div className="kicker">Cleared on Arc</div>
      <div className="moved">All positions funded ✓</div>
      <div className="cleared">Clearing Round Settled on Arc ✓</div>
      <ul className="list-quiet">
        <li>
          <span>Round ID</span>
          <strong>#{ROUND_ID.toString()}</strong>
        </li>
        <li>
          <span>Assets</span>
          <strong>USDC{DEMO_FUND_EURC ? " / EURC" : ""}</strong>
        </li>
        <li>
          <span>Your deposit</span>
          <strong>{DEMO_FUND_USDC} USDC</strong>
        </li>
        <li>
          <span>Trade cleared</span>
          <strong>
            {formatUsd(grossTradeUsd)} · {formatMult(tradeMultiplier)}
          </strong>
        </li>
        {txHash && (
          <li>
            <span>Transaction</span>
            <strong>
              <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
                {txHash.slice(0, 12)}…{txHash.slice(-10)}
              </a>
            </strong>
          </li>
        )}
        <li>
          <span>Settlement contract</span>
          <strong>
            <a
              href={`${EXPLORER}/address/${CONTRACTS.atomicSettlement}`}
              target="_blank"
              rel="noreferrer"
            >
              {CONTRACTS.atomicSettlement.slice(0, 8)}…
              {CONTRACTS.atomicSettlement.slice(-6)}
            </a>
          </strong>
        </li>
      </ul>
      <p className="hero-sub" style={{ marginTop: "1.25rem" }}>
        You connected as one UAE SME → joined the round → FXFold folded your obligations with 7
        others → your payments became one net position → you funded it → the round settled on Arc.
      </p>
      <p
        className="hero-sub"
        style={{ fontFamily: "var(--font-display)", color: "var(--brand-deep)" }}
      >
        Net first. FX the rest. Settle once.
      </p>
      <div className="cta-row" style={{ marginTop: "1.5rem" }}>
        {txHash && (
          <a
            className="btn btn-primary"
            href={`${EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Arc Explorer
          </a>
        )}
        <button className="btn btn-ghost" onClick={onBack}>
          Back to network
        </button>
      </div>
    </m.section>
  );
}
