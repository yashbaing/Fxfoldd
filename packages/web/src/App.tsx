import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DEMO_COMPANIES,
  DEMO_OBLIGATIONS,
  DEFAULT_RATES,
  formatMult,
  formatPct,
  formatUsd,
  solveFxFold,
} from "@fxfold/solver";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { arcTestnet } from "viem/chains";
import { TradeGraph } from "./components/TradeGraph";
import { CONTRACTS, EXPLORER } from "./lib/wagmi";

type Stage = "graph" | "fold" | "fx" | "settle" | "done";

export function App() {
  const result = useMemo(
    () => solveFxFold(DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES),
    []
  );
  const m = result.metrics;

  const [stage, setStage] = useState<Stage>("graph");
  const [folding, setFolding] = useState(false);
  const [settling, setSettling] = useState(false);
  const [txNote, setTxNote] = useState<string>("");

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const onFold = async () => {
    setFolding(true);
    setStage("fold");
    await wait(1300);
    setFolding(false);
  };

  const onResidual = () => setStage("fx");

  const onSettle = async () => {
    setSettling(true);
    setStage("settle");
    setTxNote("Participants approving clearing round…");
    await wait(900);
    setTxNote("Executing residual FX via StableFX demo adapter…");
    await wait(900);
    setTxNote("Atomic settlement on Arc Testnet…");
    await wait(1000);
    setSettling(false);
    setStage("done");
    if (CONTRACTS.clearingRound) {
      setTxNote(`Contracts live on Arc — ${EXPLORER}/address/${CONTRACTS.clearingRound}`);
    } else {
      setTxNote("Local demo complete. Deploy contracts to pin this round on Arc.");
    }
  };

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">
            FX<em style={{ color: "var(--copper)", fontStyle: "normal" }}>Fold</em>
          </div>
          <div className="tagline">Net first. FX the rest. Settle once.</div>
        </div>
        <div className="cta-row">
          <div className="steps" style={{ margin: 0 }}>
            {(
              [
                ["graph", "Network"],
                ["fold", "Fold"],
                ["fx", "Residual FX"],
                ["settle", "Arc Settle"],
              ] as const
            ).map(([id, label]) => (
              <span
                key={id}
                className={`step-pill ${stage === id || (stage === "done" && id === "settle") ? "active" : ""} ${
                  stageOrder(stage) > stageOrder(id) ? "done" : ""
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          {isConnected ? (
            <button className="btn btn-ghost wallet-chip" onClick={() => disconnect()}>
              {chainId !== arcTestnet.id ? "Wrong network" : short}
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              disabled={isPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <main className="stage">
        <AnimatePresence mode="wait">
          {stage === "graph" && (
            <motion.section
              key="graph"
              className="hero-stage"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45 }}
            >
              <div>
                <div className="kicker">UAE SME trade network · Arc Testnet</div>
                <h1 className="hero-brand">
                  FX<em>Fold</em>
                </h1>
                <p className="hero-sub">
                  Eight businesses. Thirty-one accepted invoices across AED, USD and EUR.
                  Today they would move and exchange far more money than the trade requires.
                </p>
              </div>

              <TradeGraph folding={false} folded={false} />

              <div>
                <div className="metrics-row">
                  <div className="metric">
                    <div className="label">Gross Trade</div>
                    <div className="value">{formatUsd(m.grossTradeUsd)}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Gross FX Demand</div>
                    <div className="value">{formatUsd(m.grossFxDemandUsd)}</div>
                  </div>
                  <div className="metric">
                    <div className="label">Invoices</div>
                    <div className="value">{m.invoiceCount}</div>
                  </div>
                </div>
                <div className="cta-row" style={{ marginTop: "1.25rem" }}>
                  <button className="btn btn-primary btn-fold" onClick={onFold}>
                    FOLD
                  </button>
                  <span className="tagline">Run multilateral netting + FX compression</span>
                </div>
              </div>
            </motion.section>
          )}

          {(stage === "fold" || folding) && stage !== "fx" && stage !== "settle" && stage !== "done" && (
            <motion.section
              key="fold"
              className="panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="kicker">Compression engine</div>
              <h2 className="h-display" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                Obligations cancel. Currency demand matches.
              </h2>
              <TradeGraph folding={folding} folded={!folding} />
              {!folding && (
                <>
                  <div className="result-grid">
                    <div className="stat-block">
                      <div className="label">External Liquidity</div>
                      <div className="value good">{formatUsd(m.externalLiquidityUsd)}</div>
                    </div>
                    <div className="stat-block">
                      <div className="label">External FX</div>
                      <div className="value good">{formatUsd(m.externalFxUsd)}</div>
                    </div>
                    <div className="stat-block">
                      <div className="label">Liquidity Compression</div>
                      <div className="value">{formatPct(m.liquidityCompression)}</div>
                    </div>
                    <div className="stat-block">
                      <div className="label">FX Compression</div>
                      <div className="value">{formatPct(m.fxCompression)}</div>
                    </div>
                    <div className="stat-block">
                      <div className="label">Trade Multiplier</div>
                      <div className="value">{formatMult(m.tradeMultiplier)}</div>
                    </div>
                    <div className="stat-block">
                      <div className="label">vs Gross Trade</div>
                      <div className="value" style={{ fontSize: "1.6rem", marginTop: "0.8rem" }}>
                        {formatUsd(m.grossTradeUsd)} → {formatUsd(m.externalLiquidityUsd)}
                      </div>
                    </div>
                  </div>
                  <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                    <button className="btn btn-primary" onClick={onResidual}>
                      Show residual FX
                    </button>
                  </div>
                </>
              )}
            </motion.section>
          )}

          {stage === "fx" && (
            <motion.section
              key="fx"
              className="panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="kicker">Circle StableFX · residual only</div>
              <h2 className="h-display" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                StableFX executes the leftover — not the whole book.
              </h2>
              <p className="hero-sub">
                FXFold reduces how much FX needs to happen. StableFX optimizes execution of the
                residual.
              </p>
              <ul className="list-quiet">
                <li>
                  <span>Internal FX matched</span>
                  <strong>{formatUsd(m.internalFxMatchedUsd)}</strong>
                </li>
                <li>
                  <span>Residual FX → StableFX adapter</span>
                  <strong>{formatUsd(m.externalFxUsd)}</strong>
                </li>
                <li>
                  <span>Adapter mode</span>
                  <strong>Demo RFQ (IS_DEMO_ADAPTER)</strong>
                </li>
              </ul>
              <div className="badge-demo">Demo adapter — swap for live Circle StableFX credentials</div>
              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                {isConnected && chainId !== arcTestnet.id && (
                  <button className="btn btn-ghost" onClick={() => switchChain({ chainId: arcTestnet.id })}>
                    Switch to Arc Testnet
                  </button>
                )}
                <button className="btn btn-primary" onClick={onSettle} disabled={settling}>
                  SETTLE ROUND
                </button>
              </div>
            </motion.section>
          )}

          {stage === "settle" && (
            <motion.section
              key="settle"
              className="panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="kicker">Arc atomic settlement</div>
              <h2 className="h-display" style={{ fontSize: "clamp(2rem, 5vw, 3rem)" }}>
                Entire clearing round succeeds — or reverts.
              </h2>
              <p className="hero-sub">{txNote}</p>
              <motion.div
                style={{
                  marginTop: "2rem",
                  height: 6,
                  background: "rgba(16,34,38,0.08)",
                  overflow: "hidden",
                }}
              >
                <motion.div
                  style={{ height: "100%", background: "var(--copper)" }}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.6, ease: "easeInOut" }}
                />
              </motion.div>
            </motion.section>
          )}

          {stage === "done" && (
            <motion.section
              key="done"
              className="finale"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="kicker">Cleared on Arc</div>
              <div className="moved">{formatUsd(m.externalLiquidityUsd)} MOVED</div>
              <div className="cleared">{formatUsd(m.grossTradeUsd)} TRADE CLEARED</div>
              <ul className="list-quiet">
                <li>
                  <span>Invoices settled</span>
                  <strong>{m.invoiceCount}</strong>
                </li>
                <li>
                  <span>Trade Multiplier</span>
                  <strong>{formatMult(m.tradeMultiplier)}</strong>
                </li>
                <li>
                  <span>FX Compression</span>
                  <strong>{formatPct(m.fxCompression)}</strong>
                </li>
              </ul>
              <p className="hero-sub" style={{ marginTop: "1.25rem" }}>
                UAE is making trade machine-readable. FXFold makes liquidity machine-routable.
              </p>
              <p className="hero-sub" style={{ fontFamily: "var(--font-display)", color: "var(--brand-deep)" }}>
                Net first. FX the rest. Settle once.
              </p>
              {txNote && <p className="tagline">{txNote}</p>}
              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setStage("graph");
                    setTxNote("");
                  }}
                >
                  Replay demo
                </button>
                {CONTRACTS.atomicSettlement && (
                  <a
                    className="btn btn-primary"
                    href={`${EXPLORER}/address/${CONTRACTS.atomicSettlement}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View AtomicSettlement
                  </a>
                )}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="footer">
        <span>FXFold · Multicurrency trade compression for UAE SMEs</span>
        <span>
          {CONTRACTS.clearingRound
            ? `Arc Round #1 · ${CONTRACTS.clearingRound.slice(0, 6)}…${CONTRACTS.clearingRound.slice(-4)}`
            : "Primary track: SME Trade Finance · Built on Arc"}
        </span>
      </footer>
    </div>
  );
}

function stageOrder(s: Stage | string): number {
  const order: Record<string, number> = { graph: 0, fold: 1, fx: 2, settle: 3, done: 4 };
  return order[s] ?? 0;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
