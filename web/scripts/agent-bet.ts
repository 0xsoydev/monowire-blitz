import { createPublicClient, createWalletClient, http, parseEther } from "viem";
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
  const agentId = BigInt(process.env.AGENT_ID || "1777");
  const isYes = process.env.IS_YES === "false" ? false : true;
  const betAmount = process.env.BET_AMOUNT || "0.01";
  const value = parseEther(betAmount);

  const maxBet = await publicClient.readContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "getMaxBet",
    args: [agentId],
  });

  console.log(`Agent ${agentId} max bet: ${maxBet} wei`);
  if (value > maxBet) {
    throw new Error(`Bet ${value} exceeds max ${maxBet}`);
  }

  console.log(`Betting ${betAmount} MON as agent ${agentId} on ${isYes ? "YES" : "NO"} for market ${marketId}...`);
  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "bet",
    args: [marketId, agentId, isYes],
    value,
    gas: 800000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`Bet placed, tx: ${receipt.transactionHash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
