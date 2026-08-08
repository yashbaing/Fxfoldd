import { http, createConfig } from "wagmi";
import { arcTestnet } from "viem/chains";
import { injected } from "wagmi/connectors";

export const ARC_RPC =
  import.meta.env.VITE_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_RPC),
  },
});

export const USDC = (import.meta.env.VITE_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as `0x${string}`;
export const EURC = (import.meta.env.VITE_EURC_ADDRESS ??
  "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a") as `0x${string}`;

export const CONTRACTS = {
  obligationRegistry: (import.meta.env.VITE_OBLIGATION_REGISTRY ?? "") as `0x${string}`,
  clearingRound: (import.meta.env.VITE_CLEARING_ROUND ?? "") as `0x${string}`,
  atomicSettlement: (import.meta.env.VITE_ATOMIC_SETTLEMENT ?? "") as `0x${string}`,
  stableFxAdapter: (import.meta.env.VITE_STABLEFX_ADAPTER ?? "") as `0x${string}`,
};

export const EXPLORER =
  import.meta.env.VITE_EXPLORER_URL ?? "https://testnet.arcscan.app";
