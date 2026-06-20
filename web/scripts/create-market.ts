import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  getPrivateKey,
} from "./config";

if (!AGENT_MARKET_ADDRESS) throw new Error("AGENT_MARKET_ADDRESS env var required");

const account = privateKeyToAccount(getPrivateKey());

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
  const question = process.env.MARKET_QUESTION || "Will the next Monad testnet block number be even?";
  const resolutionSeconds = Number(process.env.MARKET_RESOLUTION_SECONDS || "60");
  const resolutionTime = BigInt(Math.floor(Date.now() / 1000) + resolutionSeconds);
  const oracle = (process.env.ORACLE_ADDRESS || account.address) as `0x${string}`;

  console.log(`Creating market: "${question}"`);
  console.log(`  Resolution time: ${resolutionTime} (${resolutionSeconds} sec from now)`);
  console.log(`  Oracle: ${oracle}`);

  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "createMarket",
    args: [question, resolutionTime, oracle],
    gas: 500000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`Market created, tx: ${receipt.transactionHash}`);

  const marketCount = await publicClient.readContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "marketCount",
  });
  const marketId = Number(marketCount) - 1;
  console.log(`Market ID: ${marketId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
