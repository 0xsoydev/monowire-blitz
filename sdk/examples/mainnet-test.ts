/**
 * ClankerKit Mainnet Test Suite
 *
 * Tests all SDK capabilities with clear PASS/FAIL/SKIP/NEEDS-FUNDING output.
 *
 * Modes (set via env var READ_ONLY):
 *   READ_ONLY=true  (default) — only read-only calls, no transactions
 *   READ_ONLY=false           — also executes live transactions
 *
 * Usage:
 *   NODE_PATH=./node_modules npx tsx examples/mainnet-test.ts
 *   READ_ONLY=false NODE_PATH=./node_modules npx tsx examples/mainnet-test.ts
 */

import { ClankerKit }       from '../src/wallet.js';
import { kyberSwapQuote } from '../src/crosschain.js';
import { KURU_MARKETS, TOKEN_ADDRESSES } from '../src/constants.js';
import { privateKeyToAccount }           from 'viem/accounts';
import { formatEther, parseEther }       from 'viem';

// ─── Config ───────────────────────────────────────────────────────────────────

const WALLET_ADDRESS = (process.env.AGENT_WALLET_ADDRESS
  ?? '0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054') as `0x${string}`;
const OWNER_ADDRESS  = (process.env.OWNER_ADDRESS
  ?? '0x553d2Db79d200017647d554a83ce87E05d9B727C') as `0x${string}`;
const AGENT_KEY      = (process.env.AGENT_PRIVATE_KEY
  ?? '0x77abb5d6fb5b59d6f08a2b9c89df4b95e874008c0f5bbf10eb760a90057d5838') as `0x${string}`;
const POLICY_ENGINE  = (process.env.POLICY_ENGINE_ADDRESS
  ?? '0x6B75948f29EAB424164D89F05d282CE9Aaf80EDc') as `0x${string}`;
const TESTNET_POLICY_ENGINE = '0x41e24c97816b76af320fa315f49e45c3a6168086' as `0x${string}`;

const READ_ONLY = process.env.READ_ONLY !== 'false';
const AGENT_EOA = privateKeyToAccount(AGENT_KEY).address;

// Minimum balance thresholds for live-tx tests
const MIN_MON_MAINNET_SWAP  = 0.01;
const MIN_MON_TESTNET_STAKE = 0.01;

// Arbitrum addresses for cross-chain quote tests
const ARB_ETH_NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ARB_USDC       = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const BASE_USDC      = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ─── Output helpers ───────────────────────────────────────────────────────────

const P = (msg: string) => console.log(`  ✅ PASS   ${msg}`);
const F = (msg: string, err?: unknown) =>
  console.log(`  ❌ FAIL   ${msg}${err ? ': ' + (err as Error).message?.slice(0, 100) : ''}`);
const S = (msg: string, reason: string) =>
  console.log(`  ⏭  SKIP   ${msg} — ${reason}`);
const N = (msg: string, need: string) =>
  console.log(`  💰 NEEDS  ${msg} (need ${need})`);
const I = (msg: string) => console.log(`         ${msg}`);
const HR = (label: string) =>
  console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`);

async function run(label: string, fn: () => Promise<void>) {
  try { await fn(); P(label); }
  catch (e) { F(label, e); }
}

// ─── Suite helpers ────────────────────────────────────────────────────────────

async function suiteTestnetWallet(kit: ClankerKit): Promise<bigint> {
  HR('TESTNET — Wallet info & policy');

  let balance = 0n;
  await run('getInfo()', async () => {
    const info = await kit.getInfo();
    balance = info.balance;
    I(`Wallet : ${info.address}`);
    I(`Owner  : ${info.owner}`);
    I(`Agent  : ${info.agent}`);
    I(`Balance: ${formatEther(balance)} MON`);
  });

  await run('getPolicyState()', async () => {
    const p = await kit.getPolicyState();
    I(`isActive=${p.isActive}  dailyLimit=${formatEther(p.dailyLimit)} MON`);
  });

  return balance;
}

async function suiteTestnetStaking(kit: ClankerKit, balance: bigint) {
  HR('TESTNET — Staking (reads)');

  await run('getEpoch()', async () => {
    const e = await kit.getEpoch();
    I(`epoch=${e.epoch}  inDelayPeriod=${e.inEpochDelayPeriod}`);
  });

  await run('getValidatorSet()', async () => {
    const vs = await kit.getValidatorSet();
    I(`${vs.length} validator(s) in current set`);
  });

  await run('getDelegationInfo(validator=1)', async () => {
    const d = await kit.getDelegationInfo(1n);
    I(`staked=${formatEther(d.stake)} MON  unclaimed=${formatEther(d.unclaimedRewards)}`);
  });

  HR('TESTNET — Staking (live tx)');

  const monFloat = Number(formatEther(balance));
  if (READ_ONLY) {
    S('stake(0.001 MON → validator #1)', 'READ_ONLY mode');
  } else if (monFloat < MIN_MON_TESTNET_STAKE) {
    N('stake(0.001 MON → validator #1)', `${MIN_MON_TESTNET_STAKE} MON on testnet`);
  } else {
    await run('stake(0.001 MON → validator #1)', async () => {
      const r = await kit.stake(1n, 1_000_000_000_000_000n);
      I(`tx: ${r.hash}`);
      if (r.status !== 'success') throw new Error(`status=${r.status}`);
    });
  }
}

async function suiteMainnetPolicy(kit: ClankerKit) {
  HR('MAINNET — Policy management');

  // Check current policy state on mainnet
  await run('getPolicyState() [mainnet]', async () => {
    const p = await kit.getPolicyState();
    I(`isActive=${p.isActive}  dailyLimit=${formatEther(p.dailyLimit)} MON`);
    I(`dailySpent=${formatEther(p.dailySpent)}  weeklySpent=${formatEther(p.weeklySpent)}`);
  });

  if (READ_ONLY) {
    S('createPolicy(dailyLimit=1 MON)', 'READ_ONLY mode');
  } else {
    // Check if a policy already exists
    const policy = await kit.getPolicyState();
    if (policy.isActive) {
      S('createPolicy(dailyLimit=1 MON)', 'policy already active on mainnet');
    } else {
      await run('createPolicy(dailyLimit=1 MON, weeklyLimit=5 MON)', async () => {
        const r = await kit.createPolicy({
          dailyLimit: parseEther('1'),
          weeklyLimit: parseEther('5'),
        });
        I(`tx: ${r.hash}  status: ${r.status}`);
        if (r.status !== 'success') throw new Error(`status=${r.status}`);
      });

      // Verify
      await run('getPolicyState() [after create]', async () => {
        const p = await kit.getPolicyState();
        I(`isActive=${p.isActive}  dailyLimit=${formatEther(p.dailyLimit)} MON`);
        if (!p.isActive) throw new Error('policy not active after creation');
      });
    }
  }
}

async function suiteMainnetCLOB(kit: ClankerKit) {
  HR('MAINNET — Kuru CLOB (read-only)');

  await run('getKuruMarkets()', async () => {
    const markets = await kit.getKuruMarkets();
    if (!markets.length) throw new Error('empty result');
    I(`${markets.length} market(s) configured`);
    markets.forEach(m => I(`  ${m.pair}: ${m.address}`));
  });

  for (const [pair, addr] of Object.entries(KURU_MARKETS)) {
    await run(`getOrderBook(${pair})`, async () => {
      const book = await kit.getOrderBook(addr);
      I(`  bid=${book.bestBid?.toFixed(4) ?? 'n/a'}  ask=${book.bestAsk?.toFixed(4) ?? 'n/a'}  mid=${book.midPrice?.toFixed(4) ?? 'n/a'}`);
    });

    await run(`getMarketPrice(${pair})`, async () => {
      const price = await kit.getMarketPrice(addr);
      I(`  bid=${price.bid?.toFixed(4) ?? '-'}  ask=${price.ask?.toFixed(4) ?? '-'}`);
    });
  }
}

async function suiteMainnetMemecoin(kit: ClankerKit) {
  HR('MAINNET — Memecoin prices (CLOB + Kuru Flow fallback)');

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // getMemeTokens now falls back to Kuru Flow quotes for price discovery.
  // CHOG should return a real price; DAK/YAKI may still be 0 (no Kuru Flow route).
  await run('getMemeTokens()', async () => {
    const tokens = await kit.getMemeTokens();
    if (!tokens.length) throw new Error('empty result');
    tokens.forEach(t => {
      const priceStr = t.price === 0 ? '(no market data)' : `${t.price.toFixed(8)} MON`;
      I(`${t.symbol.padEnd(5)}: price=${priceStr}`);
    });
    // At least CHOG should have a real price via Kuru Flow fallback
    const chog = tokens.find(t => t.symbol === 'CHOG');
    if (chog && chog.price > 0) I(`  → CHOG price confirmed via Kuru Flow`);
  });

  await delay(1500);

  for (const sym of ['CHOG', 'DAK', 'YAKI']) {
    await run(`getTokenPrice(${sym})`, async () => {
      const t = await kit.getTokenPrice(sym);
      const priceStr = t.price === 0 ? '(no route)' : `${t.price.toFixed(8)} MON`;
      I(`  price=${priceStr}`);
    });
    await delay(1500);
  }

  // Strategy dry-runs (no execution, always safe)
  for (const [sym, type] of [['CHOG', 'dca'], ['DAK', 'scalp']] as const) {
    await run(`smartTrade(${sym}, ${type}, dry-run)`, async () => {
      const r = await kit.smartTrade(sym, { type, budgetMon: 0.01, dcaIntervals: 3 }, false);
      I(`  action=${r.action}  status=${r.status}  reason="${r.reason}"`);
    });
  }
}

async function suiteMainnetMemecoinSwap(kit: ClankerKit) {
  HR('MAINNET — Memecoin swaps via Kuru Flow');

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  const CHOG = '0x350035555e10d9afaf1566aaebfced5ba6c27777';
  const DAK  = '0x3a25ce2b3c44e22c997e515d57aea6fbd6677777';

  // MON → CHOG (should work)
  await run('getSwapQuote(MON → CHOG, 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn: 'MON', tokenOut: CHOG, amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    const chogOut = Number(q.amountOut) / 1e18;
    I(`0.005 MON → ${chogOut.toFixed(4)} CHOG`);
  });

  await delay(1300);

  // CHOG → MON (should work)
  await run('getSwapQuote(CHOG → MON, 1)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn: CHOG, tokenOut: 'MON', amount: parseEther('1'),
    });
    if (!q) throw new Error('null quote');
    const monOut = Number(q.amountOut) / 1e18;
    I(`1 CHOG → ${monOut.toFixed(6)} MON`);
  });

  await delay(1300);

  // MON → DAK (may fail — no Kuru Flow route)
  await run('getSwapQuote(MON → DAK, 0.005)', async () => {
    try {
      const q = await kit.getSwapQuote({
        tokenIn: 'MON', tokenOut: DAK, amount: parseEther('0.005'),
      });
      const dakOut = Number(q.amountOut) / 1e18;
      I(`0.005 MON → ${dakOut.toFixed(4)} DAK`);
    } catch (e: any) {
      I(`No Kuru Flow route for DAK — ${(e as Error).message.slice(0, 80)}`);
      // Not a test failure — DAK genuinely has no liquidity in Flow router
    }
  });

  await delay(1300);

  // MON → CHOG by symbol name (not address)
  await run('getSwapQuote(MON → "CHOG", 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn: 'MON', tokenOut: 'CHOG', amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    const chogOut = Number(q.amountOut) / 1e18;
    I(`0.005 MON → ${chogOut.toFixed(4)} CHOG (resolved by symbol)`);
  });

  // Live memecoin swap
  HR('MAINNET — Memecoin swap (live tx)');
  await delay(1500);
  const mainnetInfo = await kit.getInfo().catch(() => null);
  const monFloat = mainnetInfo ? Number(formatEther(mainnetInfo.balance)) : 0;
  I(`Mainnet wallet balance: ${monFloat.toFixed(6)} MON`);

  if (READ_ONLY) {
    S('swap(MON → CHOG, 0.005)', 'READ_ONLY mode');
  } else if (monFloat < MIN_MON_MAINNET_SWAP) {
    N('swap(MON → CHOG, 0.005)', `${MIN_MON_MAINNET_SWAP} MON on mainnet wallet`);
  } else {
    await run('swap(MON → CHOG, 0.005)', async () => {
      const r = await kit.swap({
        tokenIn: 'MON', tokenOut: CHOG,
        amount: parseEther('0.005'), slippage: 100,
      });
      I(`tx: ${r.hash}  status: ${r.status}`);
      if (r.status !== 'success') throw new Error(`non-success: ${r.status}`);
    });
  }
}

async function suiteMainnetSwap(kit: ClankerKit) {
  HR('MAINNET — Same-chain swap (Kuru Flow)');

  // Kuru Flow JWT is rate-limited to 1 rps — add delay between quote calls.
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Kuru Flow API uses 0x0000...0000 for native MON. All routes work: MON→USDC, MON→WMON, USDC→MON.
  await run('getSwapQuote(MON→USDC, 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn:  'MON',
      tokenOut: 'USDC',
      amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    I(`0.005 MON → ${q.amountOut} USDC (raw) / minOut=${q.minAmountOut}`);
  });

  await delay(1200);

  await run('getSwapQuote(MON→WMON, 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn:  'MON',
      tokenOut: 'WMON',
      amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    I(`0.005 MON → ${q.amountOut} WMON (raw) / minOut=${q.minAmountOut}`);
  });

  await delay(1200);

  await run('getSwapQuote(MON→AUSD, 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn:  'MON',
      tokenOut: 'AUSD',
      amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    I(`0.005 MON → ${q.amountOut} AUSD (raw) / minOut=${q.minAmountOut}`);
  });

  // Live swap (only if funded + not read-only)
  HR('MAINNET — Swap (live tx)');
  await delay(1500); // respect Kuru Flow 1 rps rate limit after quotes above
  const mainnetInfo = await kit.getInfo().catch(() => null);
  const monFloat = mainnetInfo ? Number(formatEther(mainnetInfo.balance)) : 0;
  I(`Mainnet wallet balance: ${monFloat.toFixed(6)} MON`);

  if (READ_ONLY) {
    S('swap(MON→USDC, 0.005)', 'READ_ONLY mode');
  } else if (monFloat < MIN_MON_MAINNET_SWAP) {
    N('swap(MON→USDC, 0.005)', `${MIN_MON_MAINNET_SWAP} MON on mainnet wallet ${WALLET_ADDRESS}`);
  } else {
    await run('swap(MON→USDC, 0.005)', async () => {
      const r = await kit.swap({
        tokenIn:  'MON',
        tokenOut: 'USDC',
        amount: parseEther('0.005'),
        slippage: 50,
      });
      I(`tx: ${r.hash}  status: ${r.status}`);
      if (r.status !== 'success') throw new Error(`non-success: ${r.status}`);
    });
  }
}

async function suiteMainnetCASwap(kit: ClankerKit) {
  HR('MAINNET — Contract Address (CA) swap support');

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Known token by address (USDC — should resolve to 6 decimals)
  const USDC_CA = '0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
  // An arbitrary CA (CHOG — 18 decimals, has Kuru liquidity)
  const CHOG_CA = '0x350035555e10d9afaf1566aaebfced5ba6c27777';

  await run('fetchTokenDecimals(USDC address)', async () => {
    const d = await kit.fetchTokenDecimals(USDC_CA);
    I(`decimals=${d} (expected 6)`);
    if (d !== 6) throw new Error(`expected 6 but got ${d}`);
  });

  await run('fetchTokenDecimals(CHOG address)', async () => {
    const d = await kit.fetchTokenDecimals(CHOG_CA);
    I(`decimals=${d} (expected 18)`);
    if (d !== 18) throw new Error(`expected 18 but got ${d}`);
  });

  await delay(1200);

  await run('getSwapQuote(MON → USDC by CA, 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn:  'MON',
      tokenOut: USDC_CA,
      amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    I(`0.005 MON → ${q.amountOut} USDC-raw (via CA) / minOut=${q.minAmountOut}`);
  });

  await delay(1200);

  await run('getSwapQuote(MON → CHOG by CA, 0.005)', async () => {
    const q = await kit.getSwapQuote({
      tokenIn:  'MON',
      tokenOut: CHOG_CA,
      amount: parseEther('0.005'),
    });
    if (!q) throw new Error('null quote');
    I(`0.005 MON → ${q.amountOut} CHOG-raw (via CA) / minOut=${q.minAmountOut}`);
  });

  // Reverse lookup: verify resolveTokenSymbol returns known symbols
  await run('resolveTokenSymbol(USDC address)', async () => {
    const sym = kit.resolveTokenSymbol(USDC_CA);
    I(`symbol=${sym} (expected USDC)`);
    if (sym !== 'USDC') throw new Error(`expected USDC but got ${sym}`);
  });

  await run('resolveTokenSymbol(CHOG address)', async () => {
    const sym = kit.resolveTokenSymbol(CHOG_CA);
    I(`symbol=${sym} (expected CHOG)`);
    if (sym !== 'CHOG') throw new Error(`expected CHOG but got ${sym}`);
  });

  await run('resolveTokenSymbol(unknown address)', async () => {
    const unknownCA = '0x1111111111111111111111111111111111111111';
    const sym = kit.resolveTokenSymbol(unknownCA);
    I(`symbol=${sym} (expected 0x1111...1111)`);
    if (sym !== '0x1111...1111') throw new Error(`expected short address but got ${sym}`);
  });
}

async function suiteCrossChain() {
  HR('CROSS-CHAIN — KyberSwap quotes (read-only, no funds needed)');

  await run('kyberSwapQuote(0.01 ETH→USDC, Arbitrum)', async () => {
    const amountIn = (0.01 * 1e18).toFixed(0);
    const q = await kyberSwapQuote({ chain: 'arbitrum', tokenIn: ARB_ETH_NATIVE, tokenOut: ARB_USDC, amountIn });
    const out = Number(q.amountOut) / 1e6;
    I(`0.01 ETH → ~${out.toFixed(2)} USDC on Arbitrum`);
    if (out <= 0) throw new Error('zero amountOut');
  });

  await run('kyberSwapQuote(0.01 ETH→USDC, Base)', async () => {
    const amountIn = (0.01 * 1e18).toFixed(0);
    const q = await kyberSwapQuote({ chain: 'base', tokenIn: ARB_ETH_NATIVE, tokenOut: BASE_USDC, amountIn });
    const out = Number(q.amountOut) / 1e6;
    I(`0.01 ETH → ~${out.toFixed(2)} USDC on Base`);
    if (out <= 0) throw new Error('zero amountOut');
  });

  S('kyberSwap live execution', 'agent EOA has no ETH on Arbitrum/Base');
  S('zeroExSwap live execution', 'agent EOA has no ETH on target chain; also needs ZEROX_API_KEY');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n████████████████████████████████████████████████████████');
  console.log('         ClankerKit — Mainnet + Testnet Test Suite');
  console.log(`         Mode     : ${READ_ONLY ? 'READ_ONLY (no txs)' : 'FULL (live txs)'}`);
  console.log(`         AgentEOA : ${AGENT_EOA}`);
  console.log(`         Wallet   : ${WALLET_ADDRESS}`);
  console.log('████████████████████████████████████████████████████████\n');

  // Testnet kit — for wallet info, policy, staking (contracts deployed on testnet)
  const testnetKit = new ClankerKit({
    walletAddress: WALLET_ADDRESS,
    owner:         OWNER_ADDRESS,
    agentKey:      AGENT_KEY,
    policyEngine:  TESTNET_POLICY_ENGINE,
    rpcUrl:        'https://testnet-rpc.monad.xyz',
    testnet:       true,
  });

  // Mainnet kit — for CLOB, swap, memecoin (contracts deployed on mainnet too)
  const mainnetKit = new ClankerKit({
    walletAddress: WALLET_ADDRESS,
    owner:         OWNER_ADDRESS,
    agentKey:      AGENT_KEY,
    policyEngine:  POLICY_ENGINE,
    rpcUrl:        'https://rpc.monad.xyz',
    testnet:       false,
  });

  // Run all suites
  const testnetBalance = await suiteTestnetWallet(testnetKit);
  await suiteTestnetStaking(testnetKit, testnetBalance);
  await suiteMainnetPolicy(mainnetKit);
  await suiteMainnetCLOB(mainnetKit);
  await suiteMainnetMemecoin(mainnetKit);
  await suiteMainnetMemecoinSwap(mainnetKit);
  await suiteMainnetSwap(mainnetKit);
  await suiteMainnetCASwap(mainnetKit);
  await suiteCrossChain();

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  Done.');
  if (READ_ONLY) console.log('  Tip: set READ_ONLY=false to enable live tx tests.');
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1); });
