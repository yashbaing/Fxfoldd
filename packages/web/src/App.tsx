import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DEMO_COMPANIES,
  DEMO_OBLIGATIONS,
  DEFAULT_RATES,
  DEMO_FUND_USDC,
  DEMO_FUND_EURC,
  YOU_SME_ID,
  buildSmeView,
  formatMult,
  formatPct,
  formatUsd,
  solveFxFold,
} from "@fxfold/solver";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useConfig,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { arcTestnet } from "viem/chains";
import { parseUnits } from "viem";
import { TradeGraph } from "./components/TradeGraph";
import { CONTRACTS, EXPLORER, ROUND_ID, USDC } from "./lib/wagmi";
import { atomicSettlementAbi, erc20Abi } from "./lib/abis";

type Stage = "network" | "sme" | "join" | "fold" | "fx" | "fund" | "done";

export function App() {
  const result = useMemo(
    () => solveFxFold(DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES),
    []
  );
  const sme = useMemo(
    () => buildSmeView(DEMO_COMPANIES, DEMO_OBLIGATIONS, result, YOU_SME_ID),
    [result]
  );
  const m = result.metrics;

  const [stage, setStage] = useState<Stage>("network");
  const [folding, setFolding] = useState(false);
  const [joined, setJoined] = useState(false);
  const [readyCount, setReadyCount] = useState(7); // 7 peers pre-authorized
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string>("");
  const [settledUi, setSettledUi] = useState(false);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const config = useConfig();

  const { data: fundingStatus } = useReadContract({
    address: CONTRACTS.atomicSettlement,
    abi: atomicSettlementAbi,
    functionName: "fundingStatus",
    args: [ROUND_ID],
    query: { enabled: Boolean(CONTRACTS.atomicSettlement) },
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const onArc = chainId === arcTestnet.id;
  const peersReady = fundingStatus?.[1] ?? true;
  const alreadyFunded = fundingStatus?.[2] ?? false;
  const alreadySettled = fundingStatus?.[3] ?? false;

  useEffect(() => {
    if ((isConfirmed || alreadySettled) && txHash && stage === "fund") {
      setSettledUi(true);
    }
  }, [isConfirmed, alreadySettled, txHash, stage]);

  const ensureWallet = async () => {
    if (!isConnected) {
      connect({ connector: connectors[0] });
      return false;
    }
    if (!onArc) {
      await switchChain({ chainId: arcTestnet.id });
    }
    return true;
  };

  const onConnectAsSme = async () => {
    const ok = await ensureWallet();
    if (ok || isConnected) setStage("sme");
  };

  const onJoinRound = async () => {
    setError("");
    try {
      const ready = await ensureWallet();
      if (!ready && !isConnected) return;

      if (CONTRACTS.atomicSettlement && onArc) {
        const hash = await writeContractAsync({
          address: CONTRACTS.atomicSettlement,
          abi: atomicSettlementAbi,
          functionName: "joinRound",
          args: [ROUND_ID],
        });
        setTxHash(hash);
      }
      setJoined(true);
      setReadyCount(8);
      setStage("join");
    } catch (e) {
      // Allow local demo join if chain call fails (e.g. already joined)
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("already") || msg.includes("AlreadyJoined")) {
        setJoined(true);
        setReadyCount(8);
        setStage("join");
        return;
      }
      // Still progress demo UX if user rejects only after explaining
      setJoined(true);
      setReadyCount(8);
      setStage("join");
      setError("Joined in demo mode — connect Arc Testnet to join on-chain.");
    }
  };

  const onFold = async () => {
    setFolding(true);
    setStage("fold");
    await wait(1300);
    setFolding(false);
  };

  const onFund = async () => {
    setError("");
    try {
      const ready = await ensureWallet();
      if (!ready && !isConnected) {
        setError("Connect your wallet as this SME first.");
        return;
      }
      if (!CONTRACTS.atomicSettlement) {
        setError("Settlement contract not configured.");
        return;
      }
      if (!onArc) {
        await switchChain({ chainId: arcTestnet.id });
      }

      const amount = parseUnits(String(DEMO_FUND_USDC), 6);
      setStage("fund");

      const approveHash = await writeContractAsync({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.atomicSettlement, amount],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });

      const fundHash = await writeContractAsync({
        address: CONTRACTS.atomicSettlement,
        abi: atomicSettlementAbi,
        functionName: "fundNetPosition",
        args: [ROUND_ID],
      });
      setTxHash(fundHash);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(shortError(msg));
    }
  };

  const activeStage: Stage = settledUi ? "done" : stage;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">
            FX<em style={{ color: "var(--copper)", fontStyle: "normal" }}>Fold</em>
          </div>
          <div className="tagline">You are one SME in the clearing network</div>
        </div>
        <div className="cta-row">
          <div className="steps" style={{ margin: 0 }}>
            {(
              [
                ["network", "Network"],
                ["sme", "You"],
                ["join", "Join"],
                ["fold", "Fold"],
                ["fx", "FX"],
                ["fund", "Fund"],
              ] as const
            ).map(([id, label]) => (
              <span
                key={id}
                className={`step-pill ${activeStage === id || (activeStage === "done" && id === "fund") ? "active" : ""} ${
                  stageOrder(activeStage) > stageOrder(id) ? "done" : ""
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          {isConnected ? (
            <button className="btn btn-ghost wallet-chip" onClick={() => disconnect()}>
              {onArc ? `${sme.company.name.split(" ")[0]} · ${short}` : "Switch to Arc"}
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
          {activeStage === "network" && (
            <motion.section
              key="network"
              className="hero-stage"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <div>
                <div className="kicker">UAE SME trade network · Arc Testnet</div>
                <h1 className="hero-brand">
                  FX<em>Fold</em>
                </h1>
                <p className="hero-sub">
                  Eight businesses. Thirty-one accepted invoices across AED, USD and EUR.
                  One of them is you — highlighted on the network.
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
                    <div className="label">Your SME</div>
                    <div className="value" style={{ fontSize: "1.35rem" }}>
                      {sme.company.name}
                    </div>
                  </div>
                </div>
                <div className="cta-row" style={{ marginTop: "1.25rem" }}>
                  <button className="btn btn-primary" onClick={onConnectAsSme}>
                    {isConnected ? "View my invoices" : "Connect as this SME"}
                  </button>
                  <span className="tagline">
                    Wallet maps to {sme.company.name} ({sme.company.city})
                  </span>
                </div>
              </div>
            </motion.section>
          )}

          {activeStage === "sme" && (
            <motion.section
              key="sme"
              className="panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="kicker">Connected as SME</div>
              <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
                {sme.company.name}
              </h2>
              <p className="hero-sub">
                {sme.company.city} · {sme.company.sector}
                {address ? ` · ${short}` : " · connect wallet to continue"}
              </p>

              <div className="result-grid">
                <div className="stat-block">
                  <div className="label">You need to pay</div>
                  <div className="value">{formatUsd(sme.grossPayUsd)}</div>
                  <div className="tagline">{sme.payableCount} invoices</div>
                </div>
                <div className="stat-block">
                  <div className="label">You are owed</div>
                  <div className="value">{formatUsd(sme.grossReceiveUsd)}</div>
                  <div className="tagline">{sme.receivableCount} invoices</div>
                </div>
              </div>

              <ul className="list-quiet">
                {sme.invoices.map((inv) => (
                  <li key={inv.invoiceId}>
                    <span>
                      <strong>{inv.direction === "pay" ? "Pay" : "Receive"}</strong> {inv.invoiceId} ·{" "}
                      {inv.counterpartyName}
                    </span>
                    <strong>
                      {inv.amount.toLocaleString()} {inv.invoiceCurrency}
                    </strong>
                  </li>
                ))}
              </ul>

              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                <button className="btn btn-primary" onClick={onJoinRound} disabled={isWriting}>
                  Join Clearing Round
                </button>
                <span className="tagline">7 other SMEs are already pre-authorized</span>
              </div>
              {error && <p className="badge-demo">{error}</p>}
            </motion.section>
          )}

          {activeStage === "join" && (
            <motion.section
              key="join"
              className="panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="kicker">Clearing round #{ROUND_ID.toString()}</div>
              <h2 className="h-display" style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>
                {readyCount} / 8 SMEs ready
              </h2>
              <p className="hero-sub">
                You joined as {sme.company.name}. The other seven participants are demo-authorized —
                no extra wallets needed.
              </p>
              <ul className="list-quiet">
                <li>
                  <span>You ({sme.company.name})</span>
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
              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                <button className="btn btn-primary btn-fold" onClick={onFold}>
                  Run FOLD
                </button>
                <span className="tagline">Off-chain network calculation — no wallet popup</span>
              </div>
            </motion.section>
          )}

          {activeStage === "fold" && (
            <motion.section
              key="fold"
              className="panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="kicker">Network-level compression</div>
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
                        {m.invoiceCount} → {result.settlementLegs.length}
                      </div>
                    </div>
                    <div className="stat-block">
                      <div className="label">Gross → net settlement</div>
                      <div className="value" style={{ fontSize: "1.8rem" }}>
                        {formatUsd(m.grossTradeUsd)} → {formatUsd(m.externalLiquidityUsd)}
                      </div>
                    </div>
                    <div className="stat-block">
                      <div className="label">Gross FX → residual</div>
                      <div className="value" style={{ fontSize: "1.8rem" }}>
                        {formatUsd(m.grossFxDemandUsd)} → {formatUsd(m.externalFxUsd)}
                      </div>
                    </div>
                    <div className="stat-block">
                      <div className="label">Trade Multiplier</div>
                      <div className="value good">{formatMult(m.tradeMultiplier)}</div>
                    </div>
                  </div>

                  <div className="you-panel">
                    <div className="kicker">Your Result · {sme.company.name}</div>
                    <div className="you-compare">
                      <div>
                        <div className="label">Before FOLD</div>
                        <div className="value" style={{ fontSize: "1.6rem" }}>
                          {sme.beforeActions.length} separate payments / FX
                        </div>
                        <ul className="list-quiet">
                          {sme.beforeActions.slice(0, 5).map((a) => (
                            <li key={a.label}>
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
                          Net USDC {sme.netUsdc >= 0 ? "+" : ""}
                          {formatUsd(Math.abs(sme.netUsdc))} · Net EURC {sme.netEurc >= 0 ? "+" : ""}
                          {sme.netEurc.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                    <button className="btn btn-primary" onClick={() => setStage("fx")}>
                      See residual FX
                    </button>
                  </div>
                </>
              )}
            </motion.section>
          )}

          {activeStage === "fx" && (
            <motion.section
              key="fx"
              className="panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="kicker">StableFX · residual only</div>
              <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
                Only unmatched FX reaches StableFX
              </h2>
              <div className="result-grid">
                <div className="stat-block">
                  <div className="label">Network residual FX</div>
                  <div className="value">{formatUsd(m.externalFxUsd)}</div>
                </div>
                <div className="stat-block">
                  <div className="label">Your residual FX</div>
                  <div className="value">{formatUsd(sme.residualFxUsd)}</div>
                </div>
                <div className="stat-block">
                  <div className="label">Internal FX matched</div>
                  <div className="value good">{formatUsd(m.internalFxMatchedUsd)}</div>
                </div>
                <div className="stat-block">
                  <div className="label">FX Compression</div>
                  <div className="value">{formatPct(m.fxCompression)}</div>
                </div>
              </div>
              <p className="badge-demo">Demo StableFX adapter — residual execution layer, not the core product</p>
              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                <button className="btn btn-primary" onClick={() => setStage("fund")}>
                  Continue to fund net position
                </button>
              </div>
            </motion.section>
          )}

          {activeStage === "fund" && (
            <motion.section
              key="fund"
              className="panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="kicker">Your settlement · not admin</div>
              <h2 className="h-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)" }}>
                Fund your net position
              </h2>
              <p className="hero-sub">
                Authorize the final obligation for {sme.company.name}. Other SMEs are already
                pre-funded. Your wallet pays the demo net deposit on Arc — then the whole round
                settles.
              </p>
              <ul className="list-quiet">
                <li>
                  <span>Economic net (after FOLD)</span>
                  <strong>{sme.yourResultSummary}</strong>
                </li>
                <li>
                  <span>Arc demo deposit (this wallet)</span>
                  <strong>{DEMO_FUND_USDC} USDC</strong>
                </li>
                <li>
                  <span>Peer SMEs</span>
                  <strong>Pre-funded ✓</strong>
                </li>
              </ul>
              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                {!onArc && isConnected && (
                  <button className="btn btn-ghost" onClick={() => switchChain({ chainId: arcTestnet.id })}>
                    Switch to Arc Testnet
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={onFund}
                  disabled={isWriting || isConfirming || alreadyFunded}
                >
                  {isWriting || isConfirming
                    ? "Confirm in wallet…"
                    : alreadyFunded
                      ? "Already funded"
                      : "Fund Net Position"}
                </button>
              </div>
              {error && <p className="badge-demo">{error}</p>}
              {txHash && (
                <p className="tagline" style={{ marginTop: "1rem" }}>
                  Tx:{" "}
                  <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
                    {txHash.slice(0, 10)}…{txHash.slice(-8)}
                  </a>
                </p>
              )}
            </motion.section>
          )}

          {activeStage === "done" && (
            <motion.section
              key="done"
              className="finale"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
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
                  <span>Asset</span>
                  <strong>USDC{DEMO_FUND_EURC ? " / EURC" : ""}</strong>
                </li>
                <li>
                  <span>Your deposit</span>
                  <strong>{DEMO_FUND_USDC} USDC</strong>
                </li>
                <li>
                  <span>Trade cleared</span>
                  <strong>
                    {formatUsd(m.grossTradeUsd)} · {formatMult(m.tradeMultiplier)}
                  </strong>
                </li>
                <li>
                  <span>Transaction</span>
                  <strong>
                    <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
                      {txHash?.slice(0, 12)}…{txHash?.slice(-10)}
                    </a>
                  </strong>
                </li>
              </ul>
              <p className="hero-sub" style={{ marginTop: "1.25rem" }}>
                You connected as one UAE SME → joined the round → FXFold folded your obligations with
                7 others → your payments became one net position → you funded it → the round settled
                on Arc.
              </p>
              <p
                className="hero-sub"
                style={{ fontFamily: "var(--font-display)", color: "var(--brand-deep)" }}
              >
                Net first. FX the rest. Settle once.
              </p>
              <div className="cta-row" style={{ marginTop: "1.5rem" }}>
                <a
                  className="btn btn-primary"
                  href={`${EXPLORER}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Arc Explorer
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setStage("network");
                    setTxHash(undefined);
                    setJoined(false);
                    setReadyCount(7);
                    setError("");
                    setSettledUi(false);
                  }}
                >
                  Replay
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="footer">
        <span>
          You = {sme.company.name} · {DEMO_COMPANIES.length - 1} peers pre-authorized
        </span>
        <span>
          Round #{ROUND_ID.toString()} ·{" "}
          {CONTRACTS.atomicSettlement
            ? `${CONTRACTS.atomicSettlement.slice(0, 6)}…${CONTRACTS.atomicSettlement.slice(-4)}`
            : "Arc Testnet"}
        </span>
      </footer>
    </div>
  );
}

function stageOrder(s: Stage | string): number {
  const order: Record<string, number> = {
    network: 0,
    sme: 1,
    join: 2,
    fold: 3,
    fx: 4,
    fund: 5,
    done: 6,
  };
  return order[s] ?? 0;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shortError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("denied")) return "Wallet rejected the transaction.";
  if (msg.includes("insufficient")) return "Insufficient USDC — get Arc Testnet USDC from faucet.circle.com";
  return msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
}
