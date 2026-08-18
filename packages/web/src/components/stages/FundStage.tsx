import { m } from "framer-motion";
import { DEMO_FUND_USDC } from "@fxfold/solver";
import { EXPLORER } from "../../lib/wagmi";

type FundStageProps = {
  reducedMotion: boolean;
  smeName: string;
  yourResultSummary: string;
  isConnected: boolean;
  onArc: boolean;
  isWriting: boolean;
  isConfirming: boolean;
  alreadyFunded: boolean;
  alreadySettled: boolean;
  statusNote: string;
  error: string;
  txHash?: `0x${string}`;
  onSwitchArc: () => void;
  onFund: () => void;
};

export function FundStage({
  reducedMotion,
  smeName,
  yourResultSummary,
  isConnected,
  onArc,
  isWriting,
  isConfirming,
  alreadyFunded,
  alreadySettled,
  statusNote,
  error,
  txHash,
  onSwitchArc,
  onFund,
}: FundStageProps) {
  return (
    <m.section
      key="fund"
      className="panel"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="kicker">Your settlement · one SME, not network admin</div>
      <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
        Fund your net position
      </h2>
      <p className="hero-sub">
        Your wallet authorizes the final obligation for {smeName}. The other seven SMEs are already
        pre-funded. This is a real Arc Testnet USDC transaction.
      </p>
      <ul className="list-quiet">
        <li>
          <span>Economic net (after FOLD)</span>
          <strong>{yourResultSummary}</strong>
        </li>
        <li>
          <span>Arc deposit from your wallet</span>
          <strong>{DEMO_FUND_USDC} USDC</strong>
        </li>
        <li>
          <span>Peer SMEs</span>
          <strong>Pre-funded ✓</strong>
        </li>
      </ul>
      <div className="cta-row" style={{ marginTop: "1.5rem" }}>
        {!onArc && isConnected && (
          <button className="btn btn-ghost" onClick={onSwitchArc}>
            Switch to Arc Testnet
          </button>
        )}
        <button
          className="btn btn-primary"
          onClick={onFund}
          disabled={isWriting || isConfirming || alreadyFunded || alreadySettled}
        >
          {isWriting || isConfirming
            ? "Confirm in wallet…"
            : alreadyFunded || alreadySettled
              ? "Already funded"
              : "Fund Net Position"}
        </button>
      </div>
      {statusNote && <p className="tagline">{statusNote}</p>}
      {error && <p className="badge-demo">{error}</p>}
      {txHash && (
        <p className="tagline" style={{ marginTop: "1rem" }}>
          Tx:{" "}
          <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
            {txHash.slice(0, 10)}…{txHash.slice(-8)}
          </a>
        </p>
      )}
    </m.section>
  );
}
