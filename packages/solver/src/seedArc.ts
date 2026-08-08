/**
 * Seed demo obligations + propose a clearing round on Arc Testnet.
 * Requires PRIVATE_KEY funded with Arc Testnet USDC.
 */
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  encodePacked,
  keccak256,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES } from "./demoData.js";
import { solveFxFold } from "./solver.js";

function loadEnv() {
  const candidates = [
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.secrets/deployer.env"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

const RPC = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
const pk = process.env.PRIVATE_KEY as Hex | undefined;

const deploymentPath = resolve(process.cwd(), "../../contracts/deployments/arc-testnet.json");

async function main() {
  if (!pk) throw new Error("PRIVATE_KEY required");
  if (!existsSync(deploymentPath)) throw new Error("Missing contracts/deployments/arc-testnet.json — deploy first");

  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as {
    obligationRegistry: Address;
    clearingRound: Address;
    atomicSettlement: Address;
  };

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC) });
  const wallet = createWalletClient({ account, chain: arcTestnet, transport: http(RPC) });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Deployer", account.address, "native balance", balance.toString());
  if (balance === 0n) throw new Error("Fund deployer with Arc Testnet USDC at https://faucet.circle.com");

  const registryAbi = parseAbi([
    "function proposeObligation(bytes32 invoiceId,address debtor,address creditor,uint128 amount,bytes32 invoiceCurrency,bytes32 settlementCurrency,uint64 dueDate) returns (uint256)",
    "function invoiceToId(bytes32) view returns (uint256)",
    "function markIncluded(uint256[] ids)",
  ]);

  const clearingAbi = parseAbi([
    "function proposeRound(bytes32 roundHash,address[] participants,uint256[] obligationIds,(address participant,int128 usdcDelta,int128 eurcDelta,uint128 depositUsdc,uint128 depositEurc)[] netPositions,(address seller,address buyer,bytes32 fromCurrency,bytes32 toCurrency,uint128 fromAmount,uint128 toAmount,bool externalLeg)[] fxLegs,uint128 externalLiquidityUsd,uint128 externalFxUsd,uint128 grossTradeUsd,uint128 grossFxUsd) returns (uint256)",
    "function operatorApproveAll(uint256 roundId)",
  ]);

  const toBytes32 = (s: string) => keccak256(encodePacked(["string"], [s]));
  const toUnits = (n: number) => BigInt(Math.round(n * 1e6));

  const result = solveFxFold(DEMO_COMPANIES, DEMO_OBLIGATIONS, DEFAULT_RATES);
  const companyAddr = Object.fromEntries(DEMO_COMPANIES.map((c) => [c.id, c.address]));

  const obligationIds: bigint[] = [];
  for (const o of DEMO_OBLIGATIONS) {
    const invoiceId = toBytes32(o.invoiceId);
    const existing = await publicClient.readContract({
      address: deployment.obligationRegistry,
      abi: registryAbi,
      functionName: "invoiceToId",
      args: [invoiceId],
    });
    if (existing !== 0n) {
      obligationIds.push(existing);
      continue;
    }
    const hash = await wallet.writeContract({
      address: deployment.obligationRegistry,
      abi: registryAbi,
      functionName: "proposeObligation",
      args: [
        invoiceId,
        companyAddr[o.debtorId] as Address,
        companyAddr[o.creditorId] as Address,
        toUnits(o.amount),
        toBytes32(o.invoiceCurrency),
        toBytes32(o.settlementCurrency),
        BigInt(Math.floor(Date.now() / 1000) + 86400 * 30),
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    // decode id from sequential nextId approximation via invoiceToId
    const id = await publicClient.readContract({
      address: deployment.obligationRegistry,
      abi: registryAbi,
      functionName: "invoiceToId",
      args: [invoiceId],
    });
    obligationIds.push(id);
    console.log("Proposed", o.invoiceId, "id", id.toString(), "tx", receipt.transactionHash);
  }

  const includeHash = await wallet.writeContract({
    address: deployment.obligationRegistry,
    abi: registryAbi,
    functionName: "markIncluded",
    args: [obligationIds],
  });
  await publicClient.waitForTransactionReceipt({ hash: includeHash });

  const participants = DEMO_COMPANIES.map((c) => c.address as Address);
  const netPositions = result.netPositions.map((n) => ({
    participant: companyAddr[n.companyId] as Address,
    usdcDelta: BigInt(Math.round(n.usdc * 1e6)),
    eurcDelta: BigInt(Math.round(n.eurc * 1e6)),
    depositUsdc: 0n,
    depositEurc: 0n,
  }));

  const fxLegs = [
    ...result.fxMatches.map((f) => ({
      seller: (companyAddr[f.fromCompanyId] ?? account.address) as Address,
      buyer: (companyAddr[f.toCompanyId] ?? account.address) as Address,
      fromCurrency: toBytes32(f.fromCurrency),
      toCurrency: toBytes32(f.toCurrency),
      fromAmount: toUnits(f.fromAmount),
      toAmount: toUnits(f.toAmount),
      externalLeg: false,
    })),
    ...result.residualFx.map((f) => ({
      seller: account.address,
      buyer: account.address,
      fromCurrency: toBytes32(f.fromCurrency),
      toCurrency: toBytes32(f.toCurrency),
      fromAmount: toUnits(f.fromAmount),
      toAmount: toUnits(f.toAmount),
      externalLeg: true,
    })),
  ];

  const roundHash = keccak256(
    encodePacked(
      ["string", "uint256"],
      ["fxfold-demo", BigInt(Math.floor(Date.now() / 1000))]
    )
  );

  const proposeTx = await wallet.writeContract({
    address: deployment.clearingRound,
    abi: clearingAbi,
    functionName: "proposeRound",
    args: [
      roundHash,
      participants,
      obligationIds,
      netPositions,
      fxLegs,
      toUnits(result.metrics.externalLiquidityUsd),
      toUnits(result.metrics.externalFxUsd),
      toUnits(result.metrics.grossTradeUsd),
      toUnits(result.metrics.grossFxDemandUsd),
    ],
  });
  const proposeReceipt = await publicClient.waitForTransactionReceipt({ hash: proposeTx });
  console.log("Round proposed", proposeReceipt.transactionHash);

  // Approve all demo participants via operator
  // We need roundId — read nextRoundId - 1 via eth_getLogs simplification: assume 1 for first seed
  const approveTx = await wallet.writeContract({
    address: deployment.clearingRound,
    abi: clearingAbi,
    functionName: "operatorApproveAll",
    args: [1n],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });
  console.log("Round 1 fully approved by operator");
  console.log("Metrics", result.metrics);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
