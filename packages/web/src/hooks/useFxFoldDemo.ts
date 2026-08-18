import { useEffect, useMemo } from "react";
import {
  DEMO_COMPANIES,
  DEMO_OBLIGATIONS,
  DEFAULT_RATES,
  DEMO_FUND_USDC,
  YOU_SME_ID,
  buildSmeView,
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
import { CONTRACTS, ROUND_ID, USDC } from "../lib/wagmi";
import { atomicSettlementAbi, erc20Abi } from "../lib/abis";
import { useDemoFlow } from "./useDemoFlow";
import { shortError, wait } from "../lib/demoHelpers";

export function useFxFoldDemo(reducedMotion: boolean) {
  const result = useMemo(
    () => solveFxFold(DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES),
    []
  );
  const sme = useMemo(
    () => buildSmeView(DEMO_COMPANIES, DEMO_OBLIGATIONS, result, YOU_SME_ID),
    [result]
  );
  const [flow, dispatch] = useDemoFlow();

  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const config = useConfig();

  const { data: fundingStatus, refetch: refetchFunding } = useReadContract({
    address: CONTRACTS.atomicSettlement,
    abi: atomicSettlementAbi,
    functionName: "fundingStatus",
    args: [ROUND_ID],
    query: { enabled: Boolean(CONTRACTS.atomicSettlement), refetchInterval: 8_000 },
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: flow.txHash,
  });

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const onArc = chainId === arcTestnet.id;
  const joinedOnChain = Boolean(
    fundingStatus?.[0] && fundingStatus[0] !== "0x0000000000000000000000000000000000000000"
  );
  const peersReady = fundingStatus?.[1] ?? true;
  const alreadyFunded = fundingStatus?.[2] ?? false;
  const alreadySettled = fundingStatus?.[3] ?? false;
  const requiredUsdcOnChain = fundingStatus?.[4] ?? parseUnits(String(DEMO_FUND_USDC), 6);
  const activeStage = flow.settledUi || alreadySettled ? "done" : flow.stage;

  useEffect(() => {
    if (joinedOnChain) dispatch({ type: "markJoinedReady" });
  }, [joinedOnChain, dispatch]);

  useEffect(() => {
    if (alreadySettled) dispatch({ type: "markSettled" });
  }, [alreadySettled, dispatch]);

  useEffect(() => {
    if (isConfirmed && flow.txHash) {
      dispatch({ type: "setSettledUi", settledUi: true });
      void refetchFunding();
    }
  }, [isConfirmed, flow.txHash, refetchFunding, dispatch]);

  const ensureWallet = async () => {
    if (!isConnected) {
      connect({ connector: connectors[0] });
      return false;
    }
    if (!onArc) {
      try {
        await switchChain({ chainId: arcTestnet.id });
      } catch {
        dispatch({ type: "setError", error: "Switch your wallet to Arc Testnet (chain 5042002)." });
        return false;
      }
    }
    return true;
  };

  const onConnectAsSme = async () => {
    dispatch({ type: "setError", error: "" });
    if (!isConnected) {
      connect({ connector: connectors[0] });
      return;
    }
    if (!onArc) await switchChain({ chainId: arcTestnet.id });
    dispatch({ type: "setStage", stage: "sme" });
  };

  const onJoinRound = async () => {
    dispatch({ type: "setError", error: "" });
    dispatch({ type: "setStatusNote", statusNote: "" });
    const ready = await ensureWallet();
    if (!ready) return;

    try {
      if (CONTRACTS.atomicSettlement) {
        dispatch({ type: "setStatusNote", statusNote: "Confirm Join Round in your wallet…" });
        const hash = await writeContractAsync({
          address: CONTRACTS.atomicSettlement,
          abi: atomicSettlementAbi,
          functionName: "joinRound",
          args: [ROUND_ID],
        });
        dispatch({ type: "setJoinTxHash", joinTxHash: hash });
        await waitForTransactionReceipt(config, { hash });
        dispatch({ type: "setStatusNote", statusNote: "" });
      }
      dispatch({ type: "markJoinedReady" });
      dispatch({ type: "setStage", stage: "join" });
      void refetchFunding();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.toLowerCase().includes("already") ||
        msg.includes("AlreadyJoined") ||
        msg.includes("0x")
      ) {
        dispatch({ type: "markJoinedReady" });
        dispatch({ type: "setStage", stage: "join" });
        dispatch({ type: "setStatusNote", statusNote: "" });
        return;
      }
      if (msg.includes("User rejected") || msg.includes("denied")) {
        dispatch({ type: "setError", error: "Wallet rejected Join Round." });
        dispatch({ type: "setStatusNote", statusNote: "" });
        return;
      }
      dispatch({ type: "setError", error: shortError(msg) });
      dispatch({ type: "setStatusNote", statusNote: "" });
    }
  };

  const onFold = async () => {
    dispatch({ type: "setFolding", folding: true });
    dispatch({ type: "setStage", stage: "fold" });
    await wait(reducedMotion ? 200 : 1300);
    dispatch({ type: "setFolding", folding: false });
  };

  const onFund = async () => {
    dispatch({ type: "setError", error: "" });
    dispatch({ type: "setStatusNote", statusNote: "" });
    try {
      const ready = await ensureWallet();
      if (!ready) {
        dispatch({ type: "setError", error: "Connect your wallet as this SME first." });
        return;
      }
      if (!CONTRACTS.atomicSettlement) {
        dispatch({ type: "setError", error: "Settlement contract not configured." });
        return;
      }

      if (!joinedOnChain) {
        dispatch({ type: "setStatusNote", statusNote: "Joining round on Arc…" });
        try {
          const joinHash = await writeContractAsync({
            address: CONTRACTS.atomicSettlement,
            abi: atomicSettlementAbi,
            functionName: "joinRound",
            args: [ROUND_ID],
          });
          await waitForTransactionReceipt(config, { hash: joinHash });
          dispatch({ type: "markJoinedReady" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.toLowerCase().includes("already") && !msg.includes("AlreadyJoined")) throw e;
        }
      }

      const amount =
        requiredUsdcOnChain > 0n ? requiredUsdcOnChain : parseUnits(String(DEMO_FUND_USDC), 6);
      dispatch({ type: "setStage", stage: "fund" });
      dispatch({ type: "setStatusNote", statusNote: "Approve USDC, then fund your net position…" });

      const approveHash = await writeContractAsync({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACTS.atomicSettlement, amount],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });

      dispatch({
        type: "setStatusNote",
        statusNote: "Confirm Fund Net Position in your wallet…",
      });
      const fundHash = await writeContractAsync({
        address: CONTRACTS.atomicSettlement,
        abi: atomicSettlementAbi,
        functionName: "fundNetPosition",
        args: [ROUND_ID],
      });
      dispatch({ type: "setTxHash", txHash: fundHash });
      dispatch({ type: "setStatusNote", statusNote: "Waiting for Arc confirmation…" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch({ type: "setError", error: shortError(msg) });
      dispatch({ type: "setStatusNote", statusNote: "" });
    }
  };

  return {
    result,
    sme,
    metrics: result.metrics,
    flow,
    dispatch,
    address,
    isConnected,
    isPending,
    isWriting,
    isConfirming,
    short,
    onArc,
    joinedOnChain,
    peersReady,
    alreadyFunded,
    alreadySettled,
    activeStage,
    onConnectAsSme,
    onJoinRound,
    onFold,
    onFund,
    connect,
    connectors,
    disconnect,
    switchChain,
  };
}
