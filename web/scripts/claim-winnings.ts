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

  console.log(`Claiming winnings for market ${marketId}...`);
  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "claimWinnings",
    args: [marketId],
    gas: 300000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`Winnings claimed, tx: ${receipt.transactionHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
