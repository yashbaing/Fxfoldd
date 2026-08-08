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
    name: "isFullyApproved",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const atomicSettlementAbi = [
  {
    type: "function",
    name: "joinRound",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundNetPosition",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "fundingStatus",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "peers", type: "bool" },
      { name: "funded", type: "bool" },
      { name: "settled", type: "bool" },
      { name: "usdcRequired", type: "uint256" },
      { name: "eurcRequired", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "joinedWallet",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "settledRounds",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "requiredUsdc",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;
