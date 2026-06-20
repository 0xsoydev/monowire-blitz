import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
  getPrivateKey,
} from "./config";

const AGENT_YES = 1777n;
const AGENT_NO = 1778n;
const BET_AMOUNT = parseEther("0.01");
const RESOLUTION_SECONDS = 60;
const OUTCOME_YES = 1;

const MARKET_EXPLORER = `https://monad-testnet.socialscan.io/address/${AGENT_MARKET_ADDRESS}`;

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

const GAS_LIMITS = {
  createMarket: 500000n,
  bet: 800000n,
  resolveMarket: 300000n,
  claimWinnings: 300000n,
  updateScores: 2000000n,
};

const FAUCET_URL = "https://faucet.monad.xyz";

async function checkBalance(): Promise<void> {
  const [balance, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateFeesPerGas().catch(() => null),
  ]);

  const totalGas =
    GAS_LIMITS.createMarket +
    GAS_LIMITS.bet * 2n +
    GAS_LIMITS.resolveMarket +
    GAS_LIMITS.claimWinnings +
    GAS_LIMITS.updateScores;

  const maxFeePerGas = fees?.maxFeePerGas ?? parseEther("0.00000018"); // fallback ~180 gwei
  const estimatedGasCost = totalGas * maxFeePerGas;
  const betValue = BET_AMOUNT * 2n;
  const required = estimatedGasCost + betValue;
  const buffer = (required * 15n) / 10n; // 1.5x buffer

  console.log(`\n💼 Wallet: ${account.address}`);
  console.log(`   Balance: ${formatEther(balance)} MON`);
  console.log(`   Estimated max gas cost: ${formatEther(estimatedGasCost)} MON`);
  console.log(`   Bet value (2x): ${formatEther(betValue)} MON`);
  console.log(`   Required (with 1.5x buffer): ${formatEther(buffer)} MON`);

  if (balance < buffer) {
    console.log(`\n❌ Insufficient balance to run the full demo.`);
    console.log(`   Send at least ${formatEther(buffer - balance)} MON to ${account.address}`);
    console.log(`   Faucet: ${FAUCET_URL}`);
    throw new Error("Insufficient balance — fund the wallet from the Monad testnet faucet");
  }

  console.log(`   ✅ Balance is sufficient`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readWithRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err?.message?.includes("requests limited") || err?.details?.includes("requests limited");
      if (isRateLimit && i < retries - 1) {
        const delay = 500 * (i + 1);
        console.log(`   ⏳ Rate limited, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("readWithRetry exhausted retries");
}

function formatExplorerTx(hash: string) {
  return `https://monad-testnet.socialscan.io/tx/${hash}`;
}

async function createMarket(): Promise<bigint> {
  const question = "Will an AI agent win a major crypto hackathon before 2027?";
  const resolutionTime = BigInt(Math.floor(Date.now() / 1000) + RESOLUTION_SECONDS);

  console.log(`\n🎯 Creating market: "${question}"`);
  console.log(`   Resolution in ${RESOLUTION_SECONDS} seconds`);

  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "createMarket",
    args: [question, resolutionTime, account.address],
    gas: 500000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  await sleep(200);
  const marketCount = await readWithRetry(() =>
    publicClient.readContract({
      address: AGENT_MARKET_ADDRESS,
      abi: AGENT_MARKET_ABI,
      functionName: "marketCount",
    })
  );
  const marketId = marketCount - 1n;

  console.log(`✅ Market created`);
  console.log(`   Market ID: ${marketId}`);
  console.log(`   Tx: ${formatExplorerTx(receipt.transactionHash)}`);

  return marketId;
}

async function placeBet(marketId: bigint, agentId: bigint, isYes: boolean, label: string) {
  await sleep(200);
  const maxBet = await readWithRetry(() =>
    publicClient.readContract({
      address: AGENT_MARKET_ADDRESS,
      abi: AGENT_MARKET_ABI,
      functionName: "getMaxBet",
      args: [agentId],
    })
  );

  console.log(`\n🤖 Agent #${agentId} (${label})`);
  console.log(`   Max bet: ${formatEther(maxBet)} MON`);
  console.log(`   Betting: ${formatEther(BET_AMOUNT)} MON on ${isYes ? "YES" : "NO"}`);

  if (BET_AMOUNT > maxBet) {
    throw new Error(`Bet amount ${formatEther(BET_AMOUNT)} exceeds max bet ${formatEther(maxBet)}`);
  }

  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "bet",
    args: [marketId, agentId, isYes],
    value: BET_AMOUNT,
    gas: 800000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`✅ Bet placed`);
  console.log(`   Tx: ${formatExplorerTx(receipt.transactionHash)}`);
}

async function waitForResolution(marketId: bigint) {
  await sleep(200);
  const marketInfo = await readWithRetry(() =>
    publicClient.readContract({
      address: AGENT_MARKET_ADDRESS,
      abi: AGENT_MARKET_ABI,
      functionName: "getMarketInfo",
      args: [marketId],
    })
  );
  const resolutionTime = Number(marketInfo[1]);
  const now = Math.floor(Date.now() / 1000);
  const waitSeconds = Math.max(0, resolutionTime - now + 3); // 3s buffer

  if (waitSeconds > 0) {
    console.log(`\n⏳ Waiting ${waitSeconds} seconds for resolution time...`);
    for (let i = waitSeconds; i > 0; i -= 5) {
      process.stdout.write(`   ${i}s remaining...\r`);
      await sleep(Math.min(5000, i * 1000));
    }
    console.log("\n   Time reached!");
  }
}

async function resolveMarket(marketId: bigint) {
  console.log(`\n🏁 Resolving market as YES...`);
  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "resolveMarket",
    args: [marketId, OUTCOME_YES],
    gas: 300000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`✅ Market resolved`);
  console.log(`   Tx: ${formatExplorerTx(receipt.transactionHash)}`);
}

async function claimWinnings(marketId: bigint) {
  console.log(`\n💰 Claiming winnings...`);
  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "claimWinnings",
    args: [marketId],
    gas: 300000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`✅ Winnings claimed`);
  console.log(`   Tx: ${formatExplorerTx(receipt.transactionHash)}`);
}

async function updateScores(marketId: bigint) {
  console.log(`\n📊 Updating agent scores...`);
  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "updateAllAgentScores",
    args: [marketId],
    gas: 2000000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`✅ Scores updated`);
  console.log(`   Tx: ${formatExplorerTx(receipt.transactionHash)}`);
}

async function printSummary() {
  console.log(`\n🏆 Final Agent Scores`);
  for (const agentId of [AGENT_YES, AGENT_NO, 1779n]) {
    await sleep(300);
    const score = await readWithRetry(() =>
      publicClient.readContract({
        address: AGENT_MARKET_ADDRESS,
        abi: AGENT_MARKET_ABI,
        functionName: "agentScore",
        args: [agentId],
      })
    );
    await sleep(300);
    const owner = await readWithRetry(() =>
      publicClient.readContract({
        address: IDENTITY_REGISTRY,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [agentId],
      }).catch(() => "unknown")
    );
    console.log(`   Agent #${agentId}: ${score.toString()} (owner: ${owner})`);
  }

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`\n💼 Wallet balance: ${formatEther(balance)} MON`);
  console.log(`\n🔗 Links`);
  console.log(`   Contract: ${MARKET_EXPLORER}`);
  console.log(`   Identity Registry: https://monad-testnet.socialscan.io/address/${IDENTITY_REGISTRY}`);
}

async function main() {
  console.log("\n🚀 Monowire AgentBet — Live Hackathon Demo");
  await checkBalance();

  const marketId = await createMarket();
  await placeBet(marketId, AGENT_YES, true, "YES");
  await placeBet(marketId, AGENT_NO, false, "NO");
  await waitForResolution(marketId);
  await resolveMarket(marketId);
  await claimWinnings(marketId);
  await updateScores(marketId);
  await printSummary();

  console.log("\n🎉 Demo complete!");
}

main().catch((err) => {
  console.error("\n❌ Demo failed:", err);
  process.exit(1);
});
