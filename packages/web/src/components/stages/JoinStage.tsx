import { m } from "framer-motion";
import { ROUND_ID, EXPLORER } from "../../lib/wagmi";

type JoinStageProps = {
  reducedMotion: boolean;
  readyCount: number;
  smeName: string;
  joined: boolean;
  peersReady: boolean;
  joinTxHash?: `0x${string}`;
  onFold: () => void;
};

export function JoinStage({
  reducedMotion,
  readyCount,
  smeName,
  joined,
  peersReady,
  joinTxHash,
  onFold,
}: JoinStageProps) {
  return (
    <m.section
      key="join"
      className="panel"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0 }}
    >
      <div className="kicker">Clearing round #{ROUND_ID.toString()}</div>
      <h2 className="h-display" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
        {readyCount} / 8 SMEs ready
      </h2>
      <p className="hero-sub">
        You joined as {smeName}. The other seven participants are demo-authorized - no extra wallets
        needed.
      </p>
      <ul className="list-quiet">
        <li>
          <span>You ({smeName})</span>
          <strong>{joined ? "Joined ✓" : "…"}</strong>
        </li>
        <li>
          <span>Peer SMEs (pre-authorized)</span>
          <strong>7 / 7 ✓</strong>
        </li>
        <li>
          <span>Peers ready on Arc</span>
          <strong>{peersReady ? "Yes ✓" : "Pending"}</strong>
        </li>
      </ul>
      {joinTxHash && (
        <p className="tagline">
          Join tx:{" "}
          <a href={`${EXPLORER}/tx/${joinTxHash}`} target="_blank" rel="noreferrer">
            {joinTxHash.slice(0, 10)}…{joinTxHash.slice(-8)}
          </a>
        </p>
      )}
      <div className="cta-row" style={{ marginTop: "1.5rem" }}>
        <button className="btn btn-primary btn-fold" onClick={onFold}>
          Run FOLD
        </button>
        <span className="tagline">Off-chain network calculation - no wallet popup</span>
      </div>
    </m.section>
  );
}
