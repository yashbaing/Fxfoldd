import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract, usePublicClient } from 'wagmi';
import {
  solveFXFold,
  resolveDemoObligations,
  formatUsd,
  getSmeLabel,
  type SolverResult,
} from '@fxfold/solver';
import { TradeGraph } from './components/TradeGraph';
import { MetricsPanel } from './components/MetricsPanel';
import { arcTestnet } from './config/wagmi';
import {
  ARC_TESTNET,
  ATOMIC_SETTLEMENT_ABI,
  CLEARING_ROUND_ABI,
  ERC20_ABI,
} from './config/contracts';

type DemoStep = 'graph' | 'folded' | 'residual' | 'settled';

const DEMO_OBLIGATIONS = resolveDemoObligations();

export default function App() {
  const [step, setStep] = useState<DemoStep>('graph');
  const [result, setResult] = useState<SolverResult | null>(null);
  const [folding, setFolding] = useState(false);
  const [txStatus, setTxStatus] = useState<string>('');
  const [roundId, setRoundId] = useState<bigint | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const contractsDeployed = ARC_TESTNET.obligationRegistry.length > 10;

  const handleConnect = () => {
    const connector = connectors[0];
    if (connector) connect({ connector });
    if (chainId !== arcTestnet.id) switchChain({ chainId: arcTestnet.id });
  };

  const runFold = useCallback(async () => {
    setFolding(true);
    await new Promise((r) => setTimeout(r, 1200));
    const solved = solveFXFold(DEMO_OBLIGATIONS);
    setResult(solved);
    setFolding(false);
    setStep('folded');
  }, []);

  const submitClearingRound = async () => {
    if (!result || !contractsDeployed) {
      setTxStatus('Contracts not deployed on Arc Testnet yet. Demo runs in simulation mode.');
      setStep('residual');
      return;
    }

    try {
      setTxStatus('Creating clearing round on Arc…');

      const netPositions = result.netPositions.map((p) => ({
        participant: p.participant as `0x${string}`,
        currency: p.currency === 'USDC' ? 0 : 1,
        amount: BigInt(Math.round(p.amount * 1e6)),
      }));

      const internalMatches = result.internalMatches.map((m) => ({
        participantA: m.participantA as `0x${string}`,
        participantB: m.participantB as `0x${string}`,
        currencyA: m.currencyA === 'USDC' ? 0 : 1,
        currencyB: m.currencyB === 'USDC' ? 0 : 1,
        amountA: BigInt(Math.round(m.amountA * 1e6)),
        amountB: BigInt(Math.round(m.amountB * 1e6)),
      }));

      const externalFx = result.externalFxLegs.map((l) => ({
        sellCurrency: l.sellCurrency === 'USDC' ? 0 : 1,
        buyCurrency: l.buyCurrency === 'USDC' ? 0 : 1,
        sellAmount: BigInt(Math.round(l.sellAmount * 1e6)),
        buyAmount: BigInt(Math.round(l.buyAmount * 1e6)),
      }));

      const hash = await writeContractAsync({
        address: ARC_TESTNET.clearingRound,
        abi: CLEARING_ROUND_ABI,
        functionName: 'createRound',
        args: [
          {
            roundHash: result.roundHash as `0x${string}`,
            participants: result.participants as `0x${string}`[],
            obligationIds: [],
            netPositions,
            internalMatches,
            externalFx,
            externalLiquidity: BigInt(Math.round(result.externalLiquidity * 1e6)),
            grossObligations: BigInt(Math.round(result.grossObligations * 1e6)),
            grossFxDemand: BigInt(Math.round(result.grossFxDemand * 1e6)),
          },
        ],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      const count = await publicClient?.readContract({
        address: ARC_TESTNET.clearingRound,
        abi: CLEARING_ROUND_ABI,
        functionName: 'roundCount',
      });
      if (count) setRoundId(count);

      setTxStatus('Clearing round created on Arc Testnet');
      setStep('residual');
    } catch (e) {
      setTxStatus(`On-chain error: ${(e as Error).message.slice(0, 120)}`);
      setStep('residual');
    }
  };

  const settleOnArc = async () => {
    if (!contractsDeployed || !roundId) {
      setStep('settled');
      setTxStatus('Settlement simulated — connect deployed contracts for live Arc settlement.');
      return;
    }

    try {
      setTxStatus('Approving USDC/EURC and settling on Arc…');

      if (address) {
        await writeContractAsync({
          address: ARC_TESTNET.usdc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ARC_TESTNET.atomicSettlement, BigInt('1000000000000')],
        });
        await writeContractAsync({
          address: ARC_TESTNET.eurc,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ARC_TESTNET.atomicSettlement, BigInt('1000000000000')],
        });
      }

      const hash = await writeContractAsync({
        address: ARC_TESTNET.atomicSettlement,
        abi: ATOMIC_SETTLEMENT_ABI,
        functionName: 'settleRound',
        args: [roundId],
      });

      await publicClient?.waitForTransactionReceipt({ hash });
      setTxStatus('Settlement executed atomically on Arc Testnet');
      setStep('settled');
    } catch (e) {
      setTxStatus(`Settlement error: ${(e as Error).message.slice(0, 120)}`);
      setStep('settled');
    }
  };

  const steps: { key: DemoStep; label: string }[] = [
    { key: 'graph', label: '1. Trade Graph' },
    { key: 'folded', label: '2. FOLD' },
    { key: 'residual', label: '3. Residual FX' },
    { key: 'settled', label: '4. Arc Settlement' },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>FXFold</h1>
          <p className="tagline">Net first. FX the rest. Settle once.</p>
        </div>
        {isConnected ? (
          <button className="wallet-btn" onClick={() => disconnect()}>
            {address?.slice(0, 6)}…{address?.slice(-4)} · Arc Testnet
          </button>
        ) : (
          <button className="wallet-btn" onClick={handleConnect}>
            Connect Wallet
          </button>
        )}
      </header>

      <div className="steps">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={`step-pill ${step === s.key ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      <MetricsPanel result={result} before={step === 'graph'} />

      {step === 'graph' && (
        <div className="panel">
          <h2>UAE SME Trade Network — 8 companies, 31 invoices (AED / USD / EUR)</h2>
          <TradeGraph obligations={DEMO_OBLIGATIONS} />
          <button className="fold-btn" onClick={runFold} disabled={folding}>
            {folding ? 'FOLDING…' : 'FOLD'}
          </button>
        </div>
      )}

      {step === 'folded' && result && (
        <div className="panel">
          <h2>Payment + FX Compression Complete</h2>
          <TradeGraph obligations={DEMO_OBLIGATIONS} faded />
          <p style={{ textAlign: 'center', color: 'var(--muted)' }}>
            {formatUsd(result.grossObligations)} gross trade → {formatUsd(result.externalLiquidity)} liquidity required
            · {result.tradeMultiplier.toFixed(1)}× Trade Multiplier
          </p>
          <div className="action-row">
            <button className="btn primary" onClick={submitClearingRound}>
              Continue to Residual FX →
            </button>
          </div>
        </div>
      )}

      {step === 'residual' && result && (
        <div className="panel">
          <h2>Residual FX → Circle StableFX (Demo Adapter)</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Internal FX Matched</div>
              <div className="metric-value">{formatUsd(result.internalFxMatched)}</div>
            </div>
            <div className="metric-card highlight">
              <div className="metric-label">Residual FX (StableFX)</div>
              <div className="metric-value">{formatUsd(result.externalFx)}</div>
            </div>
          </div>
          <div className="fx-match-list" style={{ marginTop: '1rem' }}>
            {result.internalMatches.slice(0, 5).map((m, i) => (
              <div key={i} className="fx-match-item">
                <span>
                  {getSmeLabel(m.participantA)} ↔ {getSmeLabel(m.participantB)}
                </span>
                <span>
                  {formatUsd(m.amountA)} {m.currencyA} / {m.currencyB}
                </span>
              </div>
            ))}
            {result.externalFxLegs.map((l, i) => (
              <div key={`ext-${i}`} className="fx-match-item" style={{ borderLeft: '3px solid var(--warning)' }}>
                <span>StableFX Residual</span>
                <span>
                  {formatUsd(l.sellAmount)} {l.sellCurrency} → {l.buyCurrency}
                </span>
              </div>
            ))}
          </div>
          <div className="action-row">
            <button className="btn success" onClick={settleOnArc}>
              SETTLE ROUND on Arc
            </button>
          </div>
        </div>
      )}

      {step === 'settled' && result && (
        <div className="final-banner">
          <h2>{formatUsd(result.externalLiquidity)} MOVED</h2>
          <p style={{ fontSize: '1.25rem', margin: '0 0 1rem' }}>
            {formatUsd(result.grossObligations)} TRADE CLEARED
          </p>
          <p>31 invoices settled · {result.tradeMultiplier.toFixed(1)}× Trade Multiplier</p>
          <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
            Move less money. Exchange less currency. Clear more trade.
          </p>
        </div>
      )}

      {txStatus && <p className={`status-msg ${step === 'settled' ? 'success' : ''}`}>{txStatus}</p>}

      {contractsDeployed && (
        <div className="deploy-info">
          <p>
            Arc Testnet contracts:{' '}
            <a href={`${ARC_TESTNET.explorer}/address/${ARC_TESTNET.obligationRegistry}`} target="_blank" rel="noreferrer">
              ObligationRegistry
            </a>
            {' · '}
            <a href={`${ARC_TESTNET.explorer}/address/${ARC_TESTNET.atomicSettlement}`} target="_blank" rel="noreferrer">
              AtomicSettlement
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
