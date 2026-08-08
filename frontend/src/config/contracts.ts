// Arc Testnet deployed addresses — updated after deployment
export const ARC_TESTNET = {
  chainId: 5042002,
  name: 'Arc Testnet',
  rpcUrl: 'https://rpc.testnet.arc.io',
  explorer: 'https://testnet.arcscan.app',
  usdc: '0x3600000000000000000000000000000000000000' as const,
  eurc: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a' as const,
  obligationRegistry: '0x3d72617B8ef426fEFD1EA0765684A51862304b78' as const,
  clearingRound: '0x538c36747F043a3AbFb765ed49E379A19A85F776' as const,
  atomicSettlement: '0x7e61732c43b94C91988b95d122D34b55719F66d8' as const,
  stableFxAdapter: '0x7c24eA0e04DAe74284129738f8cD35ae4C95E24d' as const,
};

export const OBLIGATION_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'createObligation',
    inputs: [
      { name: 'invoiceId', type: 'bytes32' },
      { name: 'debtor', type: 'address' },
      { name: 'creditor', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'invoiceCurrency', type: 'uint8' },
      { name: 'settlementCurrency', type: 'uint8' },
      { name: 'dueDate', type: 'uint256' },
    ],
    outputs: [{ name: 'obligationId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptObligation',
    inputs: [
      { name: 'obligationId', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'obligationCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const CLEARING_ROUND_ABI = [
  {
    type: 'function',
    name: 'createRound',
    inputs: [
      {
        name: 'input',
        type: 'tuple',
        components: [
          { name: 'roundHash', type: 'bytes32' },
          { name: 'participants', type: 'address[]' },
          { name: 'obligationIds', type: 'bytes32[]' },
          {
            name: 'netPositions',
            type: 'tuple[]',
            components: [
              { name: 'participant', type: 'address' },
              { name: 'currency', type: 'uint8' },
              { name: 'amount', type: 'int256' },
            ],
          },
          {
            name: 'internalMatches',
            type: 'tuple[]',
            components: [
              { name: 'participantA', type: 'address' },
              { name: 'participantB', type: 'address' },
              { name: 'currencyA', type: 'uint8' },
              { name: 'currencyB', type: 'uint8' },
              { name: 'amountA', type: 'uint256' },
              { name: 'amountB', type: 'uint256' },
            ],
          },
          {
            name: 'externalFx',
            type: 'tuple[]',
            components: [
              { name: 'sellCurrency', type: 'uint8' },
              { name: 'buyCurrency', type: 'uint8' },
              { name: 'sellAmount', type: 'uint256' },
              { name: 'buyAmount', type: 'uint256' },
            ],
          },
          { name: 'externalLiquidity', type: 'uint256' },
          { name: 'grossObligations', type: 'uint256' },
          { name: 'grossFxDemand', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'roundId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveRound',
    inputs: [
      { name: 'roundId', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'roundCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const ATOMIC_SETTLEMENT_ABI = [
  {
    type: 'function',
    name: 'settleRound',
    inputs: [{ name: 'roundId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
