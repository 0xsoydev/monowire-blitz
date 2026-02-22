/**
 * Cross-chain swap quote test — exercises KyberSwap and 0x across multiple chains.
 * Read-only (quotes only, no live txs).
 */
import { kyberSwapQuote, zeroExSwapQuote } from '../src/crosschain.js';

const ETH_NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// USDC addresses per chain
const USDC: Record<string, string> = {
  arbitrum:  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  base:      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  optimism:  '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  polygon:   '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  ethereum:  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  bsc:       '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
};

const P = (msg: string) => console.log(`  ✅ PASS   ${msg}`);
const F = (msg: string, err?: unknown) =>
  console.log(`  ❌ FAIL   ${msg}${err ? ': ' + (err as Error).message?.slice(0, 120) : ''}`);
const I = (msg: string) => console.log(`         ${msg}`);
const HR = (label: string) =>
  console.log(`\n${'─'.repeat(60)}\n  ${label}\n${'─'.repeat(60)}`);

async function run(label: string, fn: () => Promise<void>) {
  try { await fn(); P(label); }
  catch (e) { F(label, e); }
}

async function main() {
  HR('KyberSwap Quotes — Multiple Chains');

  const kyberChains = ['arbitrum', 'base', 'optimism', 'polygon', 'ethereum'] as const;

  for (const chain of kyberChains) {
    const amountIn = (0.01 * 1e18).toFixed(0); // 0.01 ETH (or native on polygon = MATIC)
    const usdc = USDC[chain];
    if (!usdc) continue;

    await run(`kyberSwapQuote(0.01 native → USDC, ${chain})`, async () => {
      const q = await kyberSwapQuote({
        chain,
        tokenIn: ETH_NATIVE,
        tokenOut: usdc,
        amountIn,
      });
      const out = Number(q.amountOut) / 1e6;
      I(`~${out.toFixed(2)} USDC on ${chain}`);
      if (out <= 0) throw new Error('zero amountOut');
    });
  }

  // Test USDC → ETH reverse on Arbitrum
  HR('KyberSwap — Reverse Routes');

  await run('kyberSwapQuote(10 USDC → ETH, arbitrum)', async () => {
    const amountIn = (10 * 1e6).toFixed(0); // 10 USDC
    const q = await kyberSwapQuote({
      chain: 'arbitrum',
      tokenIn: USDC.arbitrum,
      tokenOut: ETH_NATIVE,
      amountIn,
    });
    const out = Number(q.amountOut) / 1e18;
    I(`10 USDC → ~${out.toFixed(6)} ETH on Arbitrum`);
    if (out <= 0) throw new Error('zero amountOut');
  });

  // Token-to-token (USDC → WBTC on Arbitrum)
  const ARB_WBTC = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
  await run('kyberSwapQuote(10 USDC → WBTC, arbitrum)', async () => {
    const amountIn = (10 * 1e6).toFixed(0);
    const q = await kyberSwapQuote({
      chain: 'arbitrum',
      tokenIn: USDC.arbitrum,
      tokenOut: ARB_WBTC,
      amountIn,
    });
    const out = Number(q.amountOut) / 1e8;
    I(`10 USDC → ~${out.toFixed(8)} WBTC on Arbitrum`);
    if (out <= 0) throw new Error('zero amountOut');
  });

  // 0x API (needs key — will skip if not set)
  HR('0x Swap API v2 Quotes');
  const apiKey = process.env.ZEROX_API_KEY ?? '';
  if (!apiKey) {
    console.log('  ⏭  SKIP   0x quotes — ZEROX_API_KEY not set');
  } else {
    for (const chain of ['arbitrum', 'base'] as const) {
      const usdc = USDC[chain];
      await run(`zeroExSwapQuote(0.01 ETH → USDC, ${chain})`, async () => {
        const q = await zeroExSwapQuote({
          chain,
          tokenIn: ETH_NATIVE,
          tokenOut: usdc,
          amountIn: (0.01 * 1e18).toFixed(0),
        }, apiKey);
        const out = Number(q.amountOut) / 1e6;
        I(`~${out.toFixed(2)} USDC on ${chain}`);
        if (out <= 0) throw new Error('zero amountOut');
      });
    }
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  Cross-chain test done.');
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
