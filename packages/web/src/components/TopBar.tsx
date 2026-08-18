import type { Stage } from "../hooks/useDemoFlow";
import { stageOrder } from "../lib/demoHelpers";

const STEPS = [
  ["network", "Network"],
  ["sme", "You"],
  ["join", "Join"],
  ["fold", "Fold"],
  ["fx", "FX"],
  ["fund", "Fund"],
] as const;

type TopBarProps = {
  activeStage: Stage;
  smeName: string;
  short: string;
  isConnected: boolean;
  onArc: boolean;
  isPending: boolean;
  onWalletClick: () => void;
  onConnect: () => void;
};

export function TopBar({
  activeStage,
  smeName,
  short,
  isConnected,
  onArc,
  isPending,
  onWalletClick,
  onConnect,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <div className="brand-mark">
          FX<em style={{ color: "var(--copper)", fontStyle: "normal" }}>Fold</em>
        </div>
        <div className="tagline">You are one SME in the clearing network</div>
      </div>
      <div className="cta-row">
        <div className="steps" style={{ margin: 0 }}>
          {STEPS.map(([id, label]) => (
            <span
              key={id}
              className={`step-pill ${
                activeStage === id || (activeStage === "done" && id === "fund") ? "active" : ""
              } ${stageOrder(activeStage) > stageOrder(id) ? "done" : ""}`}
            >
              {label}
            </span>
          ))}
        </div>
        {isConnected ? (
          <button className="btn btn-ghost wallet-chip" onClick={onWalletClick}>
            {onArc ? `${smeName.split(" ")[0]} · ${short}` : "Switch to Arc"}
          </button>
        ) : (
          <button className="btn btn-ghost" disabled={isPending} onClick={onConnect}>
            Connect wallet
          </button>
        )}
      </div>
    </header>
  );
}
