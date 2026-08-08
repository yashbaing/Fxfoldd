export const clearingRoundAbi = [
  {
    type: "function",
    name: "nextRoundId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rounds",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      { name: "roundHash", type: "bytes32" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint64" },
      { name: "approvedCount", type: "uint64" },
      { name: "participantCount", type: "uint64" },
      { name: "externalLiquidityUsd", type: "uint128" },
      { name: "externalFxUsd", type: "uint128" },
      { name: "grossTradeUsd", type: "uint128" },
      { name: "grossFxUsd", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "operatorApproveAll",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
] as const;

export const atomicSettlementAbi = [
  {
    type: "function",
    name: "settledRounds",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const obligationRegistryAbi = [
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;
