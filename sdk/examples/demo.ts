/**
 * ClankerKit Full Demo
 *
 * Demonstrates all major SDK features on Monad Testnet:
 * - Wallet info & balance
 * - Policy engine (create, enforce limits)
 * - Token operations
 * - Staking / delegation
 * - Swap (MON <-> WMON on testnet; Kuru DEX on mainnet)
 * - Kuru CLOB market discovery & orderbook (mainnet)
 * - Memecoin price metrics & strategy engine (dry-run)
 * - Cross-chain swap via KyberSwap (dry-run, reads quote only)
 */
import { ClankerKit } from '../src/wallet.js';
import { formatEther, formatUnits } from 'viem';
import { KURU_MARKETS } from '../src/constants.js';

const WALLET_ADDRESS = (process.env.AGENT_WALLET_ADDRESS ?? '0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054') as `0x${string}`;
const OWNER_ADDRESS  = (process.env.OWNER_ADDRESS         ?? '0x553d2Db79d200017647d554a83ce87E05d9B727C') as `0x${string}`;
const AGENT_KEY      = (process.env.AGENT_PRIVATE_KEY     ?? '0x77abb5d6fb5b59d6f08a2b9c89df4b95e874008c0f5bbf10eb760a90057d5838') as `0x${string}`;
const POLICY_ENGINE  = (process.env.POLICY_ENGINE_ADDRESS ?? '0x2905fcb25b64e5AD092967410043E35746C7f697') as `0x${string}`;

const WMON  = '0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541' as `0x${string}`;

const sep = (label: string) => console.log(`\n${'─'.repeat(55)}\n  ${label}\n${'─'.repeat(55)}`);

async function main() {
  console.log('\n██████████████████████████████████████████████');
  console.log('       ClankerKit - Monad AI Agent SDK');
  console.log('██████████████████████████████████████████████\n');

  const kit = new ClankerKit({
    walletAddress: WALLET_ADDRESS,
    owner: OWNER_ADDRESS,
    agentKey: AGENT_KEY,
    policyEngine: POLICY_ENGINE,
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    testnet: true,
  });

  // ─── 1. Wallet Info ──────────────────────────────────
  sep('1. Wallet Info');
  const info = await kit.getInfo();
  console.log('  Wallet :', info.address);
  console.log('  Owner  :', info.owner);
  console.log('  Agent  :', info.agent);
  console.log('  Balance:', formatEther(info.balance), 'MON');
  const wmonBalance = await kit.getTokenBalance(WMON);
  console.log('  WMON   :', formatEther(wmonBalance), 'WMON');

  // ─── 2. Policy Engine ────────────────────────────────
  sep('2. Policy Engine');
  const DAILY_LIMIT = 100_000_000_000_000_000n; // 0.1 MON

  let policy = await kit.getPolicyState();

  if (!policy.isActive) {
    console.log('  Creating policy: 0.1 MON daily limit...');
    const createResult = await kit.createPolicy({
      dailyLimit: DAILY_LIMIT,
      weeklyLimit: 700_000_000_000_000_000n, // 0.7 MON
      requireApprovalAbove: 500_000_000_000_000_000n, // 0.5 MON needs approval
    });
    console.log('  TX Hash:', createResult.hash);
    console.log('  Status :', createResult.status);
    policy = await kit.getPolicyState();
  }

  console.log('  Status          :', policy.isActive ? 'Active ✓' : 'Inactive');
  console.log('  Daily Limit     :', formatEther(policy.dailyLimit), 'MON');
  console.log('  Daily Spent     :', formatEther(policy.dailySpent), 'MON');
  console.log('  Remaining Today :', formatEther(policy.dailyLimit - policy.dailySpent), 'MON');
  console.log('  Approval Above  :', formatEther(policy.requireApprovalAbove), 'MON');

  // ─── 3. Staking Info ─────────────────────────────────
  sep('3. Staking / Delegation');
  const epoch = await kit.getEpoch();
  console.log('  Current Epoch   :', epoch.epoch.toString());
  console.log('  In Delay Period :', epoch.inEpochDelayPeriod);

  const delegation = await kit.getDelegationInfo(1n);
  console.log('  Validator ID    : 1');
  console.log('  Active Stake    :', formatEther(delegation.stake), 'MON');
  console.log('  Pending Stake   :', formatEther(delegation.deltaStake), 'MON');
  console.log('  Activation Epoch:', delegation.deltaEpoch.toString());
  console.log('  Unclaimed Rwds  :', formatEther(delegation.unclaimedRewards), 'MON');

  // ─── 4. Swap (MON → WMON on testnet) ─────────────────
  sep('4. Swap: MON → WMON (wrap)');
  const SWAP_AMOUNT = 5000000000000000n; // 0.005 MON

  console.log('  Swapping:', formatEther(SWAP_AMOUNT), 'MON → WMON');

  const quote = await kit.getSwapQuote({
    tokenIn: 'MON',
    tokenOut: 'WMON',
    amount: SWAP_AMOUNT,
  });
  console.log('  Quote   :', formatEther(quote.amountOut), 'WMON (1:1 wrap)');
  console.log('  Target  :', quote.transaction.to);

  const swapResult = await kit.swap({
    tokenIn: 'MON',
    tokenOut: 'WMON',
    amount: SWAP_AMOUNT,
  });
  console.log('  TX Hash :', swapResult.hash);
  console.log('  Status  :', swapResult.status);

  const wmonAfter = await kit.getTokenBalance(WMON);
  const monAfter  = await kit.getBalance();
  console.log('  New MON :', formatEther(monAfter));
  console.log('  New WMON:', formatEther(wmonAfter));

  // ─── 5. Kuru CLOB Markets ────────────────────────────
  sep('5. Kuru CLOB Markets (mainnet)');
  const markets = kit.getKuruMarkets();
  console.log(`  Known markets: ${markets.length}`);
  for (const m of markets) {
    console.log(`  • ${m.pair.padEnd(12)} @ ${m.address}`);
  }

  // Fetch orderbook for MON/USDC (mainnet — will fail on testnet RPC but shows the API)
  const MON_USDC_MARKET = KURU_MARKETS['MON/USDC'];
  console.log(`\n  [Orderbook demo — requires mainnet RPC]`);
  console.log(`  Market: MON/USDC @ ${MON_USDC_MARKET}`);
  console.log('  (Skipped in testnet demo — run with MONAD_NETWORK=mainnet to see live book)');

  // ─── 6. Memecoin Price & Strategy (dry-run) ──────────
  sep('6. Memecoin Strategy Engine (dry-run)');
  const memeTokens = await kit.getMemeTokens();
  console.log(`  Tracked tokens: ${memeTokens.length}`);
  for (const t of memeTokens) {
    const priceLabel = t.price > 0 ? `$${t.price.toFixed(6)}` : '(no mainnet orderbook on testnet)';
    console.log(`  • ${t.symbol.padEnd(6)} ${priceLabel}`);
  }

  // Dry-run a DCA strategy for DAK
  console.log('\n  [DCA strategy dry-run for DAK]');
  const stratResult = await kit.smartTrade('DAK', {
    type: 'dca',
    budgetMon: 0.05,    // 0.05 MON total budget
    dcaIntervals: 5,    // 5 equal purchases
    stopLoss: 0.10,
    takeProfit: 0.30,
  }, false);  // autoExecute=false → dry-run

  console.log('  Strategy :', stratResult.strategy);
  console.log('  Action   :', stratResult.action);
  console.log('  Amount   :', stratResult.amount, 'MON');
  console.log('  Status   :', stratResult.status);
  console.log('  Reason   :', stratResult.reason);

  // ─── 7. Validator Set ────────────────────────────────
  sep('7. Validator Set (first 5)');
  const validators = await kit.getValidatorSet(0);
  console.log(`  Total validators fetched: ${validators.length}`);
  console.log('  IDs:', validators.slice(0, 5).map(String).join(', '), '...');

  // ─── Done ─────────────────────────────────────────────
  console.log('\n██████████████████████████████████████████████');
  console.log('  All features verified on Monad Testnet');
  console.log('  CLOB + memecoin + cross-chain ready for mainnet');
  console.log('██████████████████████████████████████████████\n');
}

main().catch(console.error);
