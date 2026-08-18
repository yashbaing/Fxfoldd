import type { Stage } from "../hooks/useDemoFlow";

export function stageOrder(s: Stage | string): number {
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

export function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function shortError(msg: string): string {
  if (msg.includes("User rejected") || msg.includes("denied")) {
    return "Wallet rejected the transaction.";
  }
  if (msg.toLowerCase().includes("insufficient")) {
    return "Insufficient USDC — get Arc Testnet USDC from faucet.circle.com";
  }
  if (msg.includes("AlreadyFunded") || msg.includes("already funded")) {
    return "This round was already funded. Redeploy/seed a fresh round for another live demo.";
  }
  if (msg.includes("AlreadySettled")) {
    return "Round already settled on Arc.";
  }
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}
