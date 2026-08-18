import { AnimatePresence, useReducedMotion } from "framer-motion";
import { DEMO_COMPANIES } from "@fxfold/solver";
import { arcTestnet } from "viem/chains";
import { CONTRACTS, ROUND_ID } from "./lib/wagmi";
import { useFxFoldDemo } from "./hooks/useFxFoldDemo";
import { TopBar } from "./components/TopBar";
import { NetworkStage } from "./components/stages/NetworkStage";
import { SmeStage } from "./components/stages/SmeStage";
import { JoinStage } from "./components/stages/JoinStage";
import { FoldStage } from "./components/stages/FoldStage";
import { FxStage } from "./components/stages/FxStage";
import { FundStage } from "./components/stages/FundStage";
import { DoneStage } from "./components/stages/DoneStage";

export function App() {
  const reducedMotion = Boolean(useReducedMotion());
  const demo = useFxFoldDemo(reducedMotion);
  const { sme, metrics, flow, activeStage } = demo;

  return (
    <div className="app-shell">
      <TopBar
        activeStage={activeStage}
        smeName={sme.company.name}
        short={demo.short}
        isConnected={demo.isConnected}
        onArc={demo.onArc}
        isPending={demo.isPending}
        onWalletClick={() => {
          if (!demo.onArc) demo.switchChain({ chainId: arcTestnet.id });
          else demo.disconnect();
        }}
        onConnect={() => demo.connect({ connector: demo.connectors[0] })}
      />

      <main className="stage">
        <AnimatePresence mode="wait">
          {activeStage === "network" && (
            <NetworkStage
              reducedMotion={reducedMotion}
              grossTradeUsd={metrics.grossTradeUsd}
              grossFxDemandUsd={metrics.grossFxDemandUsd}
              smeName={sme.company.name}
              smeCity={sme.company.city}
              isConnected={demo.isConnected}
              onContinue={demo.onConnectAsSme}
            />
          )}
          {activeStage === "sme" && (
            <SmeStage
              reducedMotion={reducedMotion}
              sme={sme}
              short={demo.short}
              address={demo.address}
              isWriting={demo.isWriting}
              statusNote={flow.statusNote}
              error={flow.error}
              onJoin={demo.onJoinRound}
            />
          )}
          {activeStage === "join" && (
            <JoinStage
              reducedMotion={reducedMotion}
              readyCount={flow.readyCount}
              smeName={sme.company.name}
              joined={flow.joined}
              peersReady={demo.peersReady}
              joinTxHash={flow.joinTxHash}
              onFold={demo.onFold}
            />
          )}
          {activeStage === "fold" && (
            <FoldStage
              reducedMotion={reducedMotion}
              folding={flow.folding}
              result={demo.result}
              sme={sme}
              onSeeFx={() => demo.dispatch({ type: "setStage", stage: "fx" })}
            />
          )}
          {activeStage === "fx" && (
            <FxStage
              reducedMotion={reducedMotion}
              externalFxUsd={metrics.externalFxUsd}
              residualFxUsd={sme.residualFxUsd}
              internalFxMatchedUsd={metrics.internalFxMatchedUsd}
              fxCompression={metrics.fxCompression}
              onAuthorize={() => demo.dispatch({ type: "setStage", stage: "fund" })}
            />
          )}
          {activeStage === "fund" && (
            <FundStage
              reducedMotion={reducedMotion}
              smeName={sme.company.name}
              yourResultSummary={sme.yourResultSummary}
              isConnected={demo.isConnected}
              onArc={demo.onArc}
              isWriting={demo.isWriting}
              isConfirming={demo.isConfirming}
              alreadyFunded={demo.alreadyFunded}
              alreadySettled={demo.alreadySettled}
              statusNote={flow.statusNote}
              error={flow.error}
              txHash={flow.txHash}
              onSwitchArc={() => demo.switchChain({ chainId: arcTestnet.id })}
              onFund={demo.onFund}
            />
          )}
          {activeStage === "done" && (
            <DoneStage
              reducedMotion={reducedMotion}
              grossTradeUsd={metrics.grossTradeUsd}
              tradeMultiplier={metrics.tradeMultiplier}
              txHash={flow.txHash}
              onBack={() => demo.dispatch({ type: "reset", joinedOnChain: demo.joinedOnChain })}
            />
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
