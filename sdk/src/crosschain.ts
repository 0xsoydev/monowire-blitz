/**
 * Cross-chain swap adapter for ClankerKit.
 *
 * Supports two aggregators:
 *  1. KyberSwap — free, no API key needed, 7+ EVM chains
 *  2. 0x Swap API v2 — needs ZEROX_API_KEY env var, 8+ EVM chains
 *
 * These integrations operate on chains OTHER than Monad (Ethereum, Polygon,
 * Arbitrum, Optimism, Base, BSC, Avalanche).  The agent EOA must already hold
 * the source tokens on the target chain.
 */

import {
  KYBERSWAP_API,
  KYBERSWAP_CHAIN_SLUGS,
  ZEROX_API,
  ZEROX_CHAIN_IDS,
} from './constants.js';
import type { CrossChain, CrossChainSwapParams, CrossChainSwapResult } from './types.js';

// ─── KyberSwap ────────────────────────────────────────────────────────────────

interface KyberRouteResponse {
  code: number;
  message: string;
  data: {
    routeSummary: Record<string, unknown>;
    routerAddress: string;
    amountOut?: string;
  };
}

interface KyberBuildResponse {
  code: number;
  message: string;
  data: {
    amountOut: string;
    data: string;         // calldata
    to: string;           // router address
    value: string;
    gas: string;
  };
}

export async function kyberSwapQuote(
  params: CrossChainSwapParams
): Promise<{ amountOut: string; routeSummary: Record<string, unknown>; routerAddress: string }> {
  const slug = KYBERSWAP_CHAIN_SLUGS[params.chain];
  if (!slug) throw new Error(`KyberSwap: unsupported chain "${params.chain}"`);

  const url = new URL(`${KYBERSWAP_API}/${slug}/api/v1/routes`);
  url.searchParams.set('tokenIn',   params.tokenIn);
  url.searchParams.set('tokenOut',  params.tokenOut);
  url.searchParams.set('amountIn',  params.amountIn);

  const res = await fetch(url.toString(), {
    headers: { 'x-client-id': 'clankerkit-monad' },
  });

  if (!res.ok) {
    throw new Error(`KyberSwap route failed: ${res.status} ${await res.text()}`);
  }

  const json: KyberRouteResponse = await res.json();
  if (json.code !== 0) throw new Error(`KyberSwap: ${json.message}`);

  return {
    amountOut:     json.data.routeSummary?.amountOut as string ?? '0',
    routeSummary:  json.data.routeSummary,
    routerAddress: json.data.routerAddress,
  };
}

/** ERC-20 native sentinel addresses (no approval needed for native tokens). */
const NATIVE_SENTINELS = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000',
]);

function isNative(address: string): boolean {
  return NATIVE_SENTINELS.has(address.toLowerCase());
}

export async function kyberSwap(
  params: CrossChainSwapParams,
  senderAddress: string,
  sendTransaction: (to: string, value: bigint, data: `0x${string}`) => Promise<{ hash: string; status: string }>,
  approveToken?: (tokenAddress: string, spender: string, amount: string) => Promise<void>
): Promise<CrossChainSwapResult> {
  const slug = KYBERSWAP_CHAIN_SLUGS[params.chain];
  if (!slug) throw new Error(`KyberSwap: unsupported chain "${params.chain}"`);

  const { routeSummary, amountOut, routerAddress } = await kyberSwapQuote(params);

  // Approve the KyberSwap router to spend tokenIn if it is an ERC-20.
  if (approveToken && !isNative(params.tokenIn)) {
    await approveToken(params.tokenIn, routerAddress, params.amountIn);
  }

  const slippage = params.slippageBps ?? 50;

  const buildRes = await fetch(`${KYBERSWAP_API}/${slug}/api/v1/route/build`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': 'clankerkit-monad',
    },
    body: JSON.stringify({
      routeSummary,
      sender:            senderAddress,
      recipient:         params.recipient ?? senderAddress,
      slippageTolerance: slippage,
    }),
  });

  if (!buildRes.ok) {
    throw new Error(`KyberSwap build failed: ${buildRes.status} ${await buildRes.text()}`);
  }

  const build: KyberBuildResponse = await buildRes.json();
  if (build.code !== 0) throw new Error(`KyberSwap build: ${build.message}`);

  const tx = await sendTransaction(
    build.data.to,
    BigInt(build.data.value || '0'),
    build.data.data as `0x${string}`
  );

  return {
    chain:     params.chain,
    tokenIn:   params.tokenIn,
    tokenOut:  params.tokenOut,
    amountIn:  params.amountIn,
    amountOut: build.data.amountOut ?? amountOut,
    hash:      tx.hash,
    status:    tx.status as CrossChainSwapResult['status'],
  };
}

// ─── 0x Swap API v2 ──────────────────────────────────────────────────────────

interface ZeroXQuoteResponse {
  buyAmount:       string;
  sellAmount:      string;
  to:              string;
  data:            string;
  value:           string;
  estimatedGas:    string;
  allowanceTarget: string;
  transaction?: {
    to:    string;
    data:  string;
    value: string;
    gas:   string;
  };
}

export async function zeroExSwapQuote(
  params: CrossChainSwapParams,
  apiKey: string
): Promise<{ amountOut: string; to: string; data: string; value: string; allowanceTarget: string }> {
  const chainId = ZEROX_CHAIN_IDS[params.chain];
  if (!chainId) throw new Error(`0x: unsupported chain "${params.chain}"`);

  const url = new URL(`${ZEROX_API}/swap/allowance-holder/quote`);
  url.searchParams.set('chainId',          String(chainId));
  url.searchParams.set('sellToken',        params.tokenIn);
  url.searchParams.set('buyToken',         params.tokenOut);
  url.searchParams.set('sellAmount',       params.amountIn);
  url.searchParams.set('slippageBps',      String(params.slippageBps ?? 50));
  if (params.recipient) url.searchParams.set('taker', params.recipient);

  const res = await fetch(url.toString(), {
    headers: {
      '0x-api-key':     apiKey,
      '0x-version':     'v2',
    },
  });

  if (!res.ok) {
    throw new Error(`0x quote failed: ${res.status} ${await res.text()}`);
  }

  const json: ZeroXQuoteResponse = await res.json();
  const tx = json.transaction ?? json;

  return {
    amountOut:       json.buyAmount,
    to:              (tx as ZeroXQuoteResponse).to ?? json.to,
    data:            (tx as ZeroXQuoteResponse).data ?? json.data,
    value:           (tx as ZeroXQuoteResponse).value ?? json.value,
    allowanceTarget: json.allowanceTarget,
  };
}

export async function zeroExSwap(
  params: CrossChainSwapParams,
  senderAddress: string,
  apiKey: string,
  sendTransaction: (to: string, value: bigint, data: `0x${string}`) => Promise<{ hash: string; status: string }>,
  approveToken?: (tokenAddress: string, spender: string, amount: string) => Promise<void>
): Promise<CrossChainSwapResult> {
  const quote = await zeroExSwapQuote(params, apiKey);

  // Approve the 0x allowance holder to spend tokenIn if it is an ERC-20.
  if (approveToken && !isNative(params.tokenIn) && quote.allowanceTarget) {
    await approveToken(params.tokenIn, quote.allowanceTarget, params.amountIn);
  }

  const tx = await sendTransaction(
    quote.to,
    BigInt(quote.value || '0'),
    quote.data as `0x${string}`
  );

  return {
    chain:    params.chain,
    tokenIn:  params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    amountOut: quote.amountOut,
    hash:     tx.hash,
    status:   tx.status as CrossChainSwapResult['status'],
  };
}
