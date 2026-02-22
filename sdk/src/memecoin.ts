/**
 * Memecoin tracking and autonomous trading strategy engine.
 *
 * Uses Kuru CLOB orderbooks to discover prices and execute trades
 * for Monad-native memecoins (DAK, CHOG, YAKI, ...).
 *
 * When the Kuru SDK fails (e.g. overflow on large-integer prices),
 * falls back to Kuru Flow API quotes to derive prices.
 *
 * All prices are in MON (native token).
 * All amounts passed to the strategy are in human-readable float form.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { KuruCLOB } from './kuru.js';
import type {
  TokenMetrics,
  TradeStrategy,
  SmartTradeResult,
  LimitOrderParams,
  MarketOrderParams,
  SwapQuote,
} from './types.js';
import { TOKEN_ADDRESSES, TOKEN_DECIMALS } from './constants.js';

// ─── Well-known memecoin → orderbook mappings ─────────────────────────────────
// Kuru mainnet CLOB orderbook addresses (confirmed Feb 2026 via Kuru API).
// pair format: "BASE/QUOTE" (quote is the pricing asset for the market).
export const MEMECOIN_MARKETS: Record<string, { market: string; pair: string; quoteIsNative?: boolean }> = {
  // CHOG/MON — base: CHOG (0x350035...27777), quote: native MON (0x0000...0000)
  CHOG: { market: '0x5e5166f02b8f91ab80833270435172078f4178ca', pair: 'CHOG/MON', quoteIsNative: true  },
  // DAK/WMON  — base: DAK/dks (0x3a25ce...7777),  quote: WMON (0x3bd359...3A)
  DAK:  { market: '0xab4388eef57a903bbaacd65a13d4dedaa5aded4e', pair: 'DAK/WMON',  quoteIsNative: false },
  // YAKI — no orderbook found on Kuru mainnet yet; keep as placeholder
  YAKI: { market: '0x0000000000000000000000000000000000000000', pair: 'YAKI/MON',  quoteIsNative: true  },
};

/**
 * Optional callback to get a Kuru Flow quote — used as fallback for price
 * discovery when the Kuru SDK CLOB read fails (overflow, etc.).
 *
 * Given a token address, quotes 1 MON → token and returns the amountOut in
 * the token's smallest unit (wei/raw).
 */
export type FlowQuoteFn = (tokenAddress: string) => Promise<SwapQuote | null>;

// ─── Persistence ──────────────────────────────────────────────────────────────

/** Where state is stored on disk. Can be overridden via AGENTKIT_DATA_DIR env. */
function getDataDir(): string {
  return process.env.CLANKERKIT_DATA_DIR || process.env.AGENTKIT_DATA_DIR || join(process.cwd(), '.clankerkit');
}

interface PriceSnapshot {
  price: number;
  timestamp: number;
}

interface PersistentState {
  /** Price history keyed by uppercase symbol → array of snapshots (newest last) */
  priceHistory: Record<string, PriceSnapshot[]>;
  /** Strategy states keyed by "TOKEN:type" → StrategyState */
  strategyStates: Record<string, StrategyState>;
}

const MAX_HISTORY_ENTRIES = 288; // 24h at 5-min intervals, capped
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

let _state: PersistentState | null = null;

function loadState(): PersistentState {
  if (_state) return _state;
  const filePath = join(getDataDir(), 'state.json');
  try {
    if (existsSync(filePath)) {
      _state = JSON.parse(readFileSync(filePath, 'utf-8')) as PersistentState;
      return _state;
    }
  } catch {
    // corrupted file — start fresh
  }
  _state = { priceHistory: {}, strategyStates: {} };
  return _state;
}

function saveState(): void {
  if (!_state) return;
  const dir = getDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, 'state.json');
  writeFileSync(filePath, JSON.stringify(_state, null, 2));
}

/** Record a price snapshot and prune old entries (>24h). */
function recordPrice(symbol: string, price: number): void {
  if (price <= 0) return;
  const state = loadState();
  const key = symbol.toUpperCase();
  if (!state.priceHistory[key]) state.priceHistory[key] = [];
  const now = Date.now();
  state.priceHistory[key].push({ price, timestamp: now });

  // Prune entries older than 24h and cap at MAX_HISTORY_ENTRIES
  const cutoff = now - TWENTY_FOUR_HOURS_MS;
  state.priceHistory[key] = state.priceHistory[key]
    .filter(s => s.timestamp >= cutoff)
    .slice(-MAX_HISTORY_ENTRIES);

  saveState();
}

/**
 * Compute 24h price change as a fraction.
 * Returns 0 if no historical data is available.
 */
function getPriceChange24h(symbol: string, currentPrice: number): number {
  if (currentPrice <= 0) return 0;
  const state = loadState();
  const history = state.priceHistory[symbol.toUpperCase()];
  if (!history || history.length < 2) return 0;

  // Find the oldest entry (closest to 24h ago)
  const oldest = history[0];
  if (oldest.price <= 0) return 0;
  return (currentPrice - oldest.price) / oldest.price;
}

// ─── Price / metrics ──────────────────────────────────────────────────────────

/**
 * Fetch live price metrics for a token.
 *
 * Tries the Kuru CLOB SDK first. If that fails (SDK overflow, empty book),
 * falls back to Kuru Flow quote (1 MON → token) to derive a price.
 */
export async function getTokenMetrics(
  symbol: string,
  clob: KuruCLOB,
  isTestnet: boolean,
  flowQuote?: FlowQuoteFn,
): Promise<TokenMetrics> {
  const entry = MEMECOIN_MARKETS[symbol.toUpperCase()];
  const tokenAddresses = isTestnet ? TOKEN_ADDRESSES.testnet : TOKEN_ADDRESSES.mainnet;
  const address = (tokenAddresses as Record<string, string>)[symbol.toUpperCase()] ?? '0x0000000000000000000000000000000000000000';

  const ZERO_METRICS: TokenMetrics = {
    address,
    symbol: symbol.toUpperCase(),
    price: 0,
    priceChange24h: 0,
    volume24h: 0,
    timestamp: Date.now(),
  };

  const sym = symbol.toUpperCase();

  // ── Try CLOB SDK first ─────────────────────────────────────────────────────
  if (entry && entry.market !== '0x0000000000000000000000000000000000000000') {
    try {
      const price = await clob.getMarketPrice(entry.market);
      if (price.mid && price.mid > 0) {
        recordPrice(sym, price.mid);
        return {
          address,
          symbol: sym,
          price: price.mid,
          priceChange24h: getPriceChange24h(sym, price.mid),
          volume24h: 0,
          bid: price.bid,
          ask: price.ask,
          timestamp: Date.now(),
        };
      }
    } catch {
      // CLOB SDK failed — fall through to Kuru Flow fallback
    }
  }

  // ── Fallback: Kuru Flow quote (1 MON → token) ─────────────────────────────
  if (flowQuote && address !== '0x0000000000000000000000000000000000000000') {
    try {
      const quote = await flowQuote(address);
      if (quote && quote.amountOut > 0n) {
        // quote.amountOut = how many token-units you get for 1 MON (1e18 wei)
        // Use actual token decimals instead of assuming 18
        const decimals = TOKEN_DECIMALS[sym] ?? 18;
        const tokensPerMon = Number(quote.amountOut) / 10 ** decimals;
        const monPerToken = tokensPerMon > 0 ? 1 / tokensPerMon : 0;
        recordPrice(sym, monPerToken);
        return {
          address,
          symbol: sym,
          price: monPerToken,        // price in MON per token
          priceChange24h: getPriceChange24h(sym, monPerToken),
          volume24h: 0,
          timestamp: Date.now(),
        };
      }
    } catch {
      // Flow quote also failed
    }
  }

  return ZERO_METRICS;
}

/**
 * Fetch metrics for all known memecoins.
 */
export async function getMemeTokenMetrics(
  clob: KuruCLOB,
  isTestnet: boolean,
  flowQuote?: FlowQuoteFn,
): Promise<TokenMetrics[]> {
  const symbols = Object.keys(MEMECOIN_MARKETS);
  // Run sequentially to respect Kuru Flow 1 rps rate limit
  const results: TokenMetrics[] = [];
  for (const s of symbols) {
    try {
      const m = await getTokenMetrics(s, clob, isTestnet, flowQuote);
      results.push(m);
    } catch {
      // skip failures
    }
  }
  return results;
}

// ─── Strategy engine ──────────────────────────────────────────────────────────

interface StrategyState {
  entryPrice: number;
  totalSpent: number;
  dcaRemaining: number;
}

/** Load strategy state from persistent storage. */
function getStrategyState(stateKey: string, defaults: StrategyState): StrategyState {
  const state = loadState();
  return state.strategyStates[stateKey] ?? { ...defaults };
}

/** Save strategy state to persistent storage. */
function setStrategyState(stateKey: string, value: StrategyState): void {
  const state = loadState();
  state.strategyStates[stateKey] = value;
  saveState();
}

/**
 * Evaluate and optionally execute a trade strategy for a given token.
 *
 * The `execute` callback is called when the strategy decides to place a trade.
 * It should call the appropriate CLOB method and return the result.
 */
export async function evaluateStrategy(
  token: string,
  strategy: TradeStrategy,
  clob: KuruCLOB,
  isTestnet: boolean,
  execute?: (order: MarketOrderParams | LimitOrderParams, type: 'market' | 'limit') => Promise<{ hash: string }>,
  flowQuote?: FlowQuoteFn,
): Promise<SmartTradeResult> {
  const metrics = await getTokenMetrics(token, clob, isTestnet, flowQuote);
  const entry = MEMECOIN_MARKETS[token.toUpperCase()];

  if (!entry || entry.market === '0x0000000000000000000000000000000000000000') {
    return {
      strategy: strategy.type,
      token,
      action: 'hold',
      amount: 0,
      price: 0,
      status: 'skipped',
      reason: `No live orderbook for ${token} — mainnet only`,
    };
  }

  const stateKey = `${token}:${strategy.type}`;
  const state = getStrategyState(stateKey, {
    entryPrice: 0,
    totalSpent: 0,
    dcaRemaining: strategy.dcaIntervals ?? 1,
  });

  const currentPrice = metrics.price;
  const perTrade = strategy.budgetMon / (strategy.dcaIntervals ?? 1);

  // ── Stop-loss / take-profit checks ──────────────────────────────────────────
  if (state.entryPrice > 0 && strategy.stopLoss != null) {
    const loss = (state.entryPrice - currentPrice) / state.entryPrice;
    if (loss >= strategy.stopLoss) {
      return {
        strategy: strategy.type,
        token,
        action: 'sell',
        amount: perTrade,
        price: currentPrice,
        status: 'skipped',
        reason: `Stop-loss triggered: ${(loss * 100).toFixed(1)}% drop below entry`,
      };
    }
  }

  if (state.entryPrice > 0 && strategy.takeProfit != null) {
    const gain = (currentPrice - state.entryPrice) / state.entryPrice;
    if (gain >= strategy.takeProfit) {
      return {
        strategy: strategy.type,
        token,
        action: 'sell',
        amount: perTrade,
        price: currentPrice,
        status: 'skipped',
        reason: `Take-profit triggered: +${(gain * 100).toFixed(1)}% above entry`,
      };
    }
  }

  // ── DCA ─────────────────────────────────────────────────────────────────────
  if (strategy.type === 'dca') {
    if (state.dcaRemaining <= 0 || state.totalSpent >= strategy.budgetMon) {
      return {
        strategy: 'dca',
        token,
        action: 'hold',
        amount: 0,
        price: currentPrice,
        status: 'skipped',
        reason: 'DCA budget fully deployed',
      };
    }

    const order: MarketOrderParams = {
      marketAddress: entry.market,
      amount: perTrade,
      isBuy: true,
      slippageBps: 100,
    };

    if (execute) {
      try {
        const result = await execute(order, 'market');
        state.entryPrice = state.entryPrice === 0 ? currentPrice
          : (state.entryPrice * state.totalSpent + currentPrice * perTrade) / (state.totalSpent + perTrade);
        state.totalSpent += perTrade;
        state.dcaRemaining -= 1;
        setStrategyState(stateKey, state);
        return {
          strategy: 'dca',
          token,
          action: 'buy',
          amount: perTrade,
          price: currentPrice,
          hash: result.hash,
          status: 'executed',
          reason: `DCA interval ${strategy.dcaIntervals! - state.dcaRemaining} of ${strategy.dcaIntervals}`,
        };
      } catch (err) {
        return {
          strategy: 'dca',
          token,
          action: 'buy',
          amount: perTrade,
          price: currentPrice,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      strategy: 'dca',
      token,
      action: 'buy',
      amount: perTrade,
      price: currentPrice,
      status: 'skipped',
      reason: 'Dry-run: no execute callback provided',
    };
  }

  // ── Momentum ─────────────────────────────────────────────────────────────────
  if (strategy.type === 'momentum') {
    const threshold = strategy.momentumThreshold ?? 0.05;
    const change = metrics.priceChange24h;

    if (change < threshold) {
      return {
        strategy: 'momentum',
        token,
        action: 'hold',
        amount: 0,
        price: currentPrice,
        status: 'skipped',
        reason: `Price change ${(change * 100).toFixed(2)}% below momentum threshold ${(threshold * 100).toFixed(2)}%`,
      };
    }

    const order: MarketOrderParams = {
      marketAddress: entry.market,
      amount: strategy.budgetMon,
      isBuy: true,
      slippageBps: 150,
    };

    if (execute) {
      try {
        const result = await execute(order, 'market');
        state.entryPrice = currentPrice;
        state.totalSpent += strategy.budgetMon;
        setStrategyState(stateKey, state);
        return {
          strategy: 'momentum',
          token,
          action: 'buy',
          amount: strategy.budgetMon,
          price: currentPrice,
          hash: result.hash,
          status: 'executed',
          reason: `Momentum signal: +${(change * 100).toFixed(2)}%`,
        };
      } catch (err) {
        return {
          strategy: 'momentum',
          token,
          action: 'buy',
          amount: strategy.budgetMon,
          price: currentPrice,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      strategy: 'momentum',
      token,
      action: 'buy',
      amount: strategy.budgetMon,
      price: currentPrice,
      status: 'skipped',
      reason: 'Dry-run: no execute callback provided',
    };
  }

  // ── Scalp ────────────────────────────────────────────────────────────────────
  if (strategy.type === 'scalp') {
    // Place a limit buy slightly below mid and a limit sell slightly above mid
    let book: Awaited<ReturnType<typeof clob.getOrderBook>>;
    try {
      book = await clob.getOrderBook(entry.market);
    } catch {
      return {
        strategy: 'scalp',
        token,
        action: 'hold',
        amount: 0,
        price: currentPrice,
        status: 'skipped',
        reason: 'Orderbook unavailable — SDK overflow or market unreachable',
      };
    }
    if (!book.bestBid || !book.bestAsk) {
      return {
        strategy: 'scalp',
        token,
        action: 'hold',
        amount: 0,
        price: currentPrice,
        status: 'skipped',
        reason: 'Empty orderbook — cannot scalp',
      };
    }

    const buyPrice  = book.bestBid * 0.999;   // 0.1% below best bid → post-only maker
    const sellPrice = book.bestAsk * 1.001;   // 0.1% above best ask → post-only maker
    const size = strategy.budgetMon / buyPrice;

    const limitBuy: LimitOrderParams = {
      marketAddress: entry.market,
      price: buyPrice,
      size,
      isBuy: true,
      postOnly: true,
    };

    if (execute) {
      try {
        const result = await execute(limitBuy, 'limit');
        return {
          strategy: 'scalp',
          token,
          action: 'buy',
          amount: size,
          price: buyPrice,
          hash: result.hash,
          status: 'executed',
          reason: `Scalp limit buy @ ${buyPrice.toFixed(6)}, sell target @ ${sellPrice.toFixed(6)}`,
        };
      } catch (err) {
        return {
          strategy: 'scalp',
          token,
          action: 'buy',
          amount: size,
          price: buyPrice,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      strategy: 'scalp',
      token,
      action: 'buy',
      amount: size,
      price: buyPrice,
      status: 'skipped',
      reason: 'Dry-run: no execute callback provided',
    };
  }

  // ── HODL ─────────────────────────────────────────────────────────────────────
  // Just buy once and hold; stop-loss handled above.
  if (strategy.type === 'hodl') {
    if (state.totalSpent >= strategy.budgetMon) {
      return {
        strategy: 'hodl',
        token,
        action: 'hold',
        amount: 0,
        price: currentPrice,
        status: 'skipped',
        reason: 'HODL position already open',
      };
    }

    const order: MarketOrderParams = {
      marketAddress: entry.market,
      amount: strategy.budgetMon,
      isBuy: true,
      slippageBps: 100,
    };

    if (execute) {
      try {
        const result = await execute(order, 'market');
        state.entryPrice = currentPrice;
        state.totalSpent = strategy.budgetMon;
        setStrategyState(stateKey, state);
        return {
          strategy: 'hodl',
          token,
          action: 'buy',
          amount: strategy.budgetMon,
          price: currentPrice,
          hash: result.hash,
          status: 'executed',
          reason: `HODL entry @ ${currentPrice}`,
        };
      } catch (err) {
        return {
          strategy: 'hodl',
          token,
          action: 'buy',
          amount: strategy.budgetMon,
          price: currentPrice,
          status: 'failed',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      strategy: 'hodl',
      token,
      action: 'buy',
      amount: strategy.budgetMon,
      price: currentPrice,
      status: 'skipped',
      reason: 'Dry-run: no execute callback provided',
    };
  }

  return {
    strategy: strategy.type,
    token,
    action: 'hold',
    amount: 0,
    price: currentPrice,
    status: 'skipped',
    reason: `Unknown strategy type: ${strategy.type}`,
  };
}
