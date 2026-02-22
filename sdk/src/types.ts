import type { Address, Hash } from 'viem';

export interface ClankerKitConfig {
  owner: Address;
  agentKey: `0x${string}`;
  name?: string;
  policies?: PolicyConfig;
}

export interface PolicyConfig {
  dailyLimit?: bigint;
  weeklyLimit?: bigint;
  allowedTokens?: Address[];
  allowedContracts?: Address[];
  requireApprovalAbove?: bigint;
}

export interface WalletInfo {
  address: Address;
  owner: Address;
  agent: Address;
  balance: bigint;
  policies?: PolicyState;
}

export interface PolicyState {
  isActive: boolean;
  dailyLimit: bigint;
  weeklyLimit: bigint;
  dailySpent: bigint;
  weeklySpent: bigint;
  requireApprovalAbove: bigint;
}

export interface TransactionResult {
  hash: Hash;
  status: 'success' | 'pending' | 'failed';
}

export interface PaymentResult {
  success: boolean;
  transactionHash?: Hash;
  error?: string;
}

export type Chain = 'monad' | 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amount: bigint;
  slippage?: number;
}

export interface SwapQuote {
  amountOut: bigint;
  minAmountOut: bigint;
  transaction: {
    to: Address;
    calldata: `0x${string}`;
    value: bigint;
  };
}

export interface StakingInfo {
  validatorId: bigint;
  authAddress: Address;
  stake: bigint;
  commission: bigint;
  unclaimedRewards: bigint;
  consensusStake: bigint;
}

export interface DelegationInfo {
  stake: bigint;
  accRewardPerToken: bigint;
  unclaimedRewards: bigint;
  deltaStake: bigint;
  nextDeltaStake: bigint;
  deltaEpoch: bigint;
  nextDeltaEpoch: bigint;
}

export interface EpochInfo {
  epoch: bigint;
  inEpochDelayPeriod: boolean;
}

export interface KuruFlowQuoteResponse {
  type: string;
  status: 'success' | 'error';
  error?: string;
  output: string;
  minOut: string;
  transaction: {
    to: string;
    calldata: string;
    value: string;
  };
  gasPrices?: {
    slow: string;
    standard: string;
    fast: string;
    rapid: string;
    extreme: string;
  };
  message?: string;
}

export interface KuruFlowTokenResponse {
  token: string;
  expires_at: number;
  rate_limit: {
    rps: number;
    burst: number;
  };
}

// ─── Kuru CLOB ───────────────────────────────────────────────────────────────

export interface KuruMarketInfo {
  /** Orderbook contract address */
  address: string;
  /** Human-readable pair label, e.g. "MON/USDC" */
  pair: string;
  baseToken: string;
  quoteToken: string;
}

export interface OrderBookData {
  /** [price, size][] sorted ascending */
  asks: number[][];
  /** [price, size][] sorted descending */
  bids: number[][];
  blockNumber: number;
  /** Best ask price */
  bestAsk?: number;
  /** Best bid price */
  bestBid?: number;
  /** Mid-point price */
  midPrice?: number;
}

export interface LimitOrderParams {
  /** Orderbook contract address */
  marketAddress: string;
  /** Price in quote asset units (human-readable float) */
  price: number;
  /** Size in base asset units (human-readable float) */
  size: number;
  isBuy: boolean;
  /** If true, order is rejected rather than crossing the spread */
  postOnly?: boolean;
}

export interface MarketOrderParams {
  /** Orderbook contract address */
  marketAddress: string;
  /** Amount to spend / receive in human-readable units (quote for buy, base for sell) */
  amount: number;
  isBuy: boolean;
  /** Minimum acceptable output (0 = no min) */
  minAmountOut?: number;
  slippageBps?: number;
}

export interface KuruOrderResult {
  hash: string;
  /** Order ID returned by the on-chain event (if available) */
  orderId?: string;
  status: 'success' | 'pending' | 'failed';
}

// ─── Cross-chain (KyberSwap / 0x) ───────────────────────────────────────────

export type CrossChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'bsc' | 'avalanche';

export interface CrossChainSwapParams {
  /** Target EVM chain */
  chain: CrossChain;
  tokenIn: string;
  tokenOut: string;
  /** Human-readable amount of tokenIn */
  amountIn: string;
  /** Slippage in bps (default 50 = 0.5%) */
  slippageBps?: number;
  /** Recipient address; defaults to the agent EOA */
  recipient?: string;
}

export interface CrossChainSwapResult {
  chain: CrossChain;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  hash: string;
  status: 'success' | 'pending' | 'failed';
}

// ─── Memecoin / Strategy Engine ──────────────────────────────────────────────

export interface TokenMetrics {
  address: string;
  symbol: string;
  price: number;
  /** 24-h price change as a fraction (0.05 = +5%) */
  priceChange24h: number;
  /** 24-h volume in USD */
  volume24h: number;
  /** Estimated market cap in USD */
  marketCap?: number;
  /** Best bid / ask from live orderbook */
  bid?: number;
  ask?: number;
  timestamp: number;
}

export type TradeStrategyType = 'dca' | 'momentum' | 'scalp' | 'hodl';

export interface TradeStrategy {
  type: TradeStrategyType;
  /** Maximum total budget in MON (native) */
  budgetMon: number;
  /** Stop-loss trigger as a fraction below entry (e.g. 0.1 = -10%) */
  stopLoss?: number;
  /** Take-profit trigger as a fraction above entry (e.g. 0.3 = +30%) */
  takeProfit?: number;
  /** For DCA: number of equal-sized purchases */
  dcaIntervals?: number;
  /** For momentum: minimum % price rise before buying */
  momentumThreshold?: number;
}

export interface SmartTradeResult {
  strategy: TradeStrategyType;
  token: string;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
  price: number;
  hash?: string;
  status: 'executed' | 'skipped' | 'failed';
  reason: string;
}
