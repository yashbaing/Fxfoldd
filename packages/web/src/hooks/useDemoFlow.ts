import { useReducer } from "react";

export type Stage = "network" | "sme" | "join" | "fold" | "fx" | "fund" | "done";

export type DemoFlowState = {
  stage: Stage;
  folding: boolean;
  joined: boolean;
  readyCount: number;
  txHash: `0x${string}` | undefined;
  joinTxHash: `0x${string}` | undefined;
  error: string;
  settledUi: boolean;
  statusNote: string;
};

export type DemoFlowAction =
  | { type: "setStage"; stage: Stage }
  | { type: "setFolding"; folding: boolean }
  | { type: "setJoined"; joined: boolean; readyCount?: number }
  | { type: "setReadyCount"; readyCount: number }
  | { type: "setTxHash"; txHash: `0x${string}` | undefined }
  | { type: "setJoinTxHash"; joinTxHash: `0x${string}` | undefined }
  | { type: "setError"; error: string }
  | { type: "setStatusNote"; statusNote: string }
  | { type: "setSettledUi"; settledUi: boolean }
  | { type: "markJoinedReady" }
  | { type: "markSettled" }
  | { type: "reset"; joinedOnChain: boolean };

export const initialDemoFlowState: DemoFlowState = {
  stage: "network",
  folding: false,
  joined: false,
  readyCount: 7,
  txHash: undefined,
  joinTxHash: undefined,
  error: "",
  settledUi: false,
  statusNote: "",
};

export function demoFlowReducer(state: DemoFlowState, action: DemoFlowAction): DemoFlowState {
  switch (action.type) {
    case "setStage":
      return { ...state, stage: action.stage };
    case "setFolding":
      return { ...state, folding: action.folding };
    case "setJoined":
      return {
        ...state,
        joined: action.joined,
        readyCount: action.readyCount ?? state.readyCount,
      };
    case "setReadyCount":
      return { ...state, readyCount: action.readyCount };
    case "setTxHash":
      return { ...state, txHash: action.txHash };
    case "setJoinTxHash":
      return { ...state, joinTxHash: action.joinTxHash };
    case "setError":
      return { ...state, error: action.error };
    case "setStatusNote":
      return { ...state, statusNote: action.statusNote };
    case "setSettledUi":
      return { ...state, settledUi: action.settledUi };
    case "markJoinedReady":
      return { ...state, joined: true, readyCount: 8 };
    case "markSettled":
      return { ...state, settledUi: true, joined: true, readyCount: 8 };
    case "reset":
      return {
        ...initialDemoFlowState,
        joined: action.joinedOnChain,
        readyCount: action.joinedOnChain ? 8 : 7,
      };
    default:
      return state;
  }
}

export function useDemoFlow() {
  return useReducer(demoFlowReducer, initialDemoFlowState);
}
