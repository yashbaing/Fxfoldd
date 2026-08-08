/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARC_RPC_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_USDC_ADDRESS?: string;
  readonly VITE_EURC_ADDRESS?: string;
  readonly VITE_OBLIGATION_REGISTRY?: string;
  readonly VITE_CLEARING_ROUND?: string;
  readonly VITE_ATOMIC_SETTLEMENT?: string;
  readonly VITE_STABLEFX_ADAPTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
