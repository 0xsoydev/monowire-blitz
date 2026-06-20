import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  PRIVATE_KEY,
} from "./config";

if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY env var required");
if (!AGENT_MARKET_ADDRESS) throw new Error("AGENT_MARKET_ADDRESS env var required");

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});

async function main() {
  const marketId = BigInt(process.env.MARKET_ID || "0");
  const outcome = Number(process.env.OUTCOME || "1"); // 1 = YES, 2 = NO

  if (outcome !== 1 && outcome !== 2) {
    throw new Error("OUTCOME must be 1 (YES) or 2 (NO)");
  }

  console.log(`Resolving market ${marketId} as ${outcome === 1 ? "YES" : "NO"}...`);
  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "resolveMarket",
    args: [marketId, outcome],
    gas: 300000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`Market resolved, tx: ${receipt.transactionHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
