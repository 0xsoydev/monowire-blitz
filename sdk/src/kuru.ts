/**
 * Kuru CLOB adapter for ClankerKit.
 *
 * The @kuru-labs/kuru-sdk (v1.0.3) is built on ethers v5. This module bridges
 * from the agent's raw private key to an ethers v5 Wallet so we can use the
 * Kuru SDK directly without touching viem.
 *
 * Order flow:
 *  - Market/limit orders are placed by the **agent EOA** directly (not via
 *    AgentWallet.execute). The agent EOA must hold the tokens to trade.
 *  - Callers are responsible for funding the agent EOA from the AgentWallet
 *    before placing CLOB orders (use ClankerKit.sendToken / send).
 */

import { ethers, BigNumber } from 'ethers';
import {
  IOC,
  GTC,
  OrderCanceler,
  OrderBook,
  CostEstimator,
  ParamFetcher,
} from '@kuru-labs/kuru-sdk';
import type { MarketParams } from '@kuru-labs/kuru-sdk';
import type {
  LimitOrderParams,
  MarketOrderParams,
  KuruOrderResult,
  OrderBookData,
  KuruMarketInfo,
} from './types.js';
import { KURU_MARKETS, TOKEN_ADDRESSES, MONAD_MAINNET } from './constants.js';

export class KuruCLOB {
  private provider: ethers.providers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private rpcUrl: string;

  /** Cache of marketParams per orderbook address */
  private paramsCache = new Map<string, { params: MarketParams; ts: number }>();
  private CACHE_TTL_MS = 60_000;

  constructor(agentPrivateKey: string, rpcUrl?: string) {
    this.rpcUrl = rpcUrl ?? MONAD_MAINNET.rpcUrls.default.http[0];
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    this.signer = new ethers.Wallet(agentPrivateKey, this.provider);
  }

  get signerAddress(): string {
    return this.signer.address;
  }

  // ─── Market params ──────────────────────────────────────────────────────────

  async getMarketParams(marketAddress: string): Promise<MarketParams> {
    const cached = this.paramsCache.get(marketAddress);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL_MS) {
      return cached.params;
    }
    const params = await ParamFetcher.getMarketParams(this.provider, marketAddress);
    this.paramsCache.set(marketAddress, { params, ts: Date.now() });
    return params;
  }

  // ─── Order book ─────────────────────────────────────────────────────────────

  async getOrderBook(marketAddress: string): Promise<OrderBookData> {
    const params = await this.getMarketParams(marketAddress);
    const raw = await OrderBook.getL2OrderBook(this.provider, marketAddress, params);

    const bestAsk = raw.asks.length > 0 ? raw.asks[0][0] : undefined;
    const bestBid = raw.bids.length > 0 ? raw.bids[0][0] : undefined;
    const midPrice =
      bestAsk !== undefined && bestBid !== undefined
        ? (bestAsk + bestBid) / 2
        : undefined;

    return {
      asks: raw.asks,
      bids: raw.bids,
      blockNumber: raw.blockNumber,
      bestAsk,
      bestBid,
      midPrice,
    };
  }

  async getMarketPrice(
    marketAddress: string
  ): Promise<{ bid?: number; ask?: number; mid?: number }> {
    const book = await this.getOrderBook(marketAddress);
    return { bid: book.bestBid, ask: book.bestAsk, mid: book.midPrice };
  }

  // ─── Market order (IOC) ─────────────────────────────────────────────────────

  async marketOrder(params: MarketOrderParams): Promise<KuruOrderResult> {
    const marketParams = await this.getMarketParams(params.marketAddress);

    const receipt = await IOC.placeMarket(this.signer, params.marketAddress, marketParams, {
      approveTokens: true,
      isBuy: params.isBuy,
      size: params.amount,
      minAmountOut: params.minAmountOut ?? 0,
      isMargin: false,
      fillOrKill: false,
    });

    return {
      hash: receipt.transactionHash,
      status: receipt.status === 1 ? 'success' : 'failed',
    };
  }

  /** Estimate output for a market buy (quote tokens in → base tokens out) */
  async estimateMarketBuy(marketAddress: string, quoteAmount: number): Promise<number> {
    const params = await this.getMarketParams(marketAddress);
    return CostEstimator.estimateMarketBuy(this.provider, marketAddress, params, quoteAmount);
  }

  /** Estimate output for a market sell (base tokens in → quote tokens out) */
  async estimateMarketSell(marketAddress: string, baseAmount: number): Promise<number> {
    const params = await this.getMarketParams(marketAddress);
    return CostEstimator.estimateMarketSell(this.provider, marketAddress, params, baseAmount);
  }

  // ─── Limit order (GTC) ──────────────────────────────────────────────────────

  async limitOrder(params: LimitOrderParams): Promise<KuruOrderResult> {
    const marketParams = await this.getMarketParams(params.marketAddress);

    const receipt = await GTC.placeLimit(this.signer, params.marketAddress, marketParams, {
      price: params.price,
      size: params.size,
      isBuy: params.isBuy,
      postOnly: params.postOnly ?? false,
    });

    // Attempt to extract the orderId from event logs (best-effort)
    let orderId: string | undefined;
    try {
      const iface = new ethers.utils.Interface([
        'event OrderCreated(uint256 indexed orderId, address indexed owner, uint256 size, uint256 price, bool isBuy)',
      ]);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          orderId = parsed.args.orderId.toString();
          break;
        } catch {
          // not our event
        }
      }
    } catch {
      // ignore
    }

    return {
      hash: receipt.transactionHash,
      orderId,
      status: receipt.status === 1 ? 'success' : 'failed',
    };
  }

  // ─── Cancel orders ───────────────────────────────────────────────────────────

  async cancelOrders(marketAddress: string, orderIds: string[]): Promise<KuruOrderResult> {
    const ids = orderIds.map((id) => BigNumber.from(id));
    const receipt = await OrderCanceler.cancelOrders(this.signer, marketAddress, ids);

    return {
      hash: receipt.transactionHash,
      status: receipt.status === 1 ? 'success' : 'failed',
    };
  }

  // ─── Market discovery ────────────────────────────────────────────────────────

  /**
   * Returns the known Kuru CLOB markets.
   * In a production build this would query the Kuru Router factory on-chain.
   */
  getKnownMarkets(): KuruMarketInfo[] {
    const markets: KuruMarketInfo[] = [];
    const mainnetTokens = TOKEN_ADDRESSES.mainnet;

    for (const [pair, address] of Object.entries(KURU_MARKETS)) {
      const [base, quote] = pair.split('/');
      markets.push({
        address,
        pair,
        baseToken:  (mainnetTokens as Record<string, string>)[base]  ?? base,
        quoteToken: (mainnetTokens as Record<string, string>)[quote] ?? quote,
      });
    }

    return markets;
  }
}
