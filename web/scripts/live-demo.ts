import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
  PYTH,
  PYTH_FEED_ETH_USD,
  toPythPrice,
  fromPythPrice,
  getPrivateKey,
} from "./config";

const AGENT_A = 1777n;
const AGENT_B = 1778n;
const RESOLUTION_SECONDS = 60;
const OUTCOME_YES = 1;
const OUTCOME_NO = 2;
const TRADE_ROUNDS = 3;
const MIN_BET = parseEther("0.001");
const MAX_BET = parseEther("0.005");
const PYTH_FEED_ID = PYTH_FEED_ETH_USD;
const PYTH_HERMES = "https://hermes.pyth.network";

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
  createMarket: 600000n,
  bet: 800000n,
  resolveMarket: 500000n,
  claimWinnings: 300000n,
  updateScores: 2000000n,
};

const FAUCET_URL = "https://faucet.monad.xyz";

async function checkBalance(): Promise<void> {
  const [balance, fees] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.estimateFeesPerGas().catch(() => null),
  ]);

  const totalBets = BigInt(TRADE_ROUNDS * 2);
  const totalGas =
    GAS_LIMITS.createMarket +
    GAS_LIMITS.bet * totalBets +
    GAS_LIMITS.resolveMarket +
    GAS_LIMITS.claimWinnings +
    GAS_LIMITS.updateScores;

  const maxFeePerGas = fees?.maxFeePerGas ?? parseEther("0.00000018"); // fallback ~180 gwei
  const estimatedGasCost = totalGas * maxFeePerGas;
  const avgBetValue = (MIN_BET + MAX_BET) / 2n;
  const betValue = avgBetValue * totalBets;
  const pythFeeBuffer = parseEther("0.0001");
  const required = estimatedGasCost + betValue + pythFeeBuffer;
  const buffer = (required * 11n) / 10n; // 1.1x buffer

  console.log(`\n💼 Wallet: ${account.address}`);
  console.log(`   Balance: ${formatEther(balance)} MON`);
  console.log(`   Estimated max gas cost: ${formatEther(estimatedGasCost)} MON`);
  console.log(`   Bet value (${Number(totalBets)} bets): ${formatEther(betValue)} MON`);
  console.log(`   Required (with 1.1x buffer): ${formatEther(buffer)} MON`);

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

function randomBool(): boolean {
  return Math.random() > 0.5;
}

function randomBetAmount(): bigint {
  const min = Number(formatEther(MIN_BET));
  const max = Number(formatEther(MAX_BET));
  const value = min + Math.random() * (max - min);
  return parseEther(value.toFixed(6));
}

async function fetchPythUpdate(feedId: string): Promise<{ updateData: `0x${string}`[]; price: number }> {
  const url = `${PYTH_HERMES}/v2/updates/price/latest?ids[]=${feedId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pyth Hermes failed: ${res.status}`);
  const json = await res.json();
  const updateData: `0x${string}`[] = json.binary.data.map((d: string) => `0x${d}` as `0x${string}`);
  const parsed = json.parsed[0];
  const price = fromPythPrice(BigInt(parsed.price.price), feedId);
  return { updateData, price };
}

function randomOutcome(): number {
  return Math.random() > 0.5 ? OUTCOME_YES : OUTCOME_NO;
}

async function createMarket(): Promise<bigint> {
  const { price } = await fetchPythUpdate(PYTH_FEED_ID);
  const humanPrice = Math.round(price * 100) / 100;
  // target is current price; outcome depends on which side price moves before resolution
  const targetPrice = toPythPrice(price, PYTH_FEED_ID);
  const question = `Will ETH/USD be above $${humanPrice.toFixed(2)} at resolution?`;
  const resolutionTime = BigInt(Math.floor(Date.now() / 1000) + RESOLUTION_SECONDS);

  console.log(`\n🎯 Creating market: "${question}"`);
  console.log(`   Current ETH/USD: $${humanPrice.toFixed(2)}`);
  console.log(`   Resolution in ${RESOLUTION_SECONDS} seconds`);

  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "createMarketWithPyth",
    args: [question, resolutionTime, PYTH_FEED_ID, targetPrice, true],
    gas: 600000n,
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

async function placeBet(marketId: bigint, agentId: bigint, isYes: boolean, amount: bigint) {
  await sleep(200);
  const maxBet = await readWithRetry(() =>
    publicClient.readContract({
      address: AGENT_MARKET_ADDRESS,
      abi: AGENT_MARKET_ABI,
      functionName: "getMaxBet",
      args: [agentId],
    })
  );

  const label = isYes ? "YES" : "NO";
  console.log(`\n🤖 Agent #${agentId}`);
  console.log(`   Max bet: ${formatEther(maxBet)} MON`);
  console.log(`   Betting: ${formatEther(amount)} MON on ${label}`);

  if (amount > maxBet) {
    throw new Error(`Bet amount ${formatEther(amount)} exceeds max bet ${formatEther(maxBet)}`);
  }

  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "bet",
    args: [marketId, agentId, isYes],
    value: amount,
    gas: 800000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`✅ Bet placed`);
  console.log(`   Tx: ${formatExplorerTx(receipt.transactionHash)}`);
}

async function randomTradeRound(marketId: bigint, round: number) {
  console.log(`\n🎲 Trading round ${round}`);
  const agents = [AGENT_A, AGENT_B];
  for (const agentId of agents) {
    const isYes = randomBool();
    const amount = randomBetAmount();
    await placeBet(marketId, agentId, isYes, amount);
  }
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

async function resolveMarketWithPyth(marketId: bigint) {
  console.log(`\n🏁 Fetching Pyth price update and resolving market...`);
  const { updateData, price } = await fetchPythUpdate(PYTH_FEED_ID);
  const humanPrice = Math.round(price * 100) / 100;
  console.log(`   ETH/USD at resolution: $${humanPrice.toFixed(2)}`);

  const fee = await publicClient.readContract({
    address: PYTH,
    abi: [
      {
        type: "function",
        name: "getUpdateFee",
        inputs: [{ type: "bytes[]", name: "updateData" }],
        outputs: [{ type: "uint256", name: "feeAmount" }],
        stateMutability: "view",
      },
    ],
    functionName: "getUpdateFee",
    args: [updateData],
  });

  console.log(`   Pyth update fee: ${formatEther(fee)} MON`);

  const tx = await walletClient.writeContract({
    address: AGENT_MARKET_ADDRESS,
    abi: AGENT_MARKET_ABI,
    functionName: "resolveMarketWithPyth",
    args: [marketId, updateData],
    value: fee,
    gas: 500000n,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

  const marketInfo = await readWithRetry(() =>
    publicClient.readContract({
      address: AGENT_MARKET_ADDRESS,
      abi: AGENT_MARKET_ABI,
      functionName: "getMarketInfo",
      args: [marketId],
    })
  );
  const outcome = marketInfo[5];
  const outcomeLabel = outcome === OUTCOME_YES ? "YES" : "NO";

  console.log(`✅ Market resolved as ${outcomeLabel}`);
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
  for (const agentId of [AGENT_A, AGENT_B, 1779n]) {
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

  for (let round = 1; round <= TRADE_ROUNDS; round++) {
    await randomTradeRound(marketId, round);
  }

  await waitForResolution(marketId);
  await resolveMarketWithPyth(marketId);
  await claimWinnings(marketId);
  await updateScores(marketId);
  await printSummary();

  console.log("\n🎉 Demo complete!");
}

main().catch((err) => {
  console.error("\n❌ Demo failed:", err);
  process.exit(1);
});
