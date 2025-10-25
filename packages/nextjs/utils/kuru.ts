/**
 * Kuru DEX Integration
 * Handles token swaps via Kuru's on-chain order book
 */

import { PoolFetcher, PathFinder } from "@kuru-labs/kuru-sdk";
import { formatUnits, parseUnits } from "viem";

// Kuru API endpoint for Monad
const KURU_API_URL = "https://api.kuru.io"; // TODO: Verify actual endpoint

// Common base tokens for routing on Monad
const BASE_TOKENS = [
  {
    symbol: "MON",
    address: "0x760AFe86e5d5Fa0EE542F7B713713E1c0dd59701", // WMON
  },
  {
    symbol: "USDC",
    address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
  },
];

/**
 * Get quote for swapping any token to USDC
 */
export async function getKuruSwapQuote(
  tokenInAddress: string,
  amountOut: bigint, // Amount of USDC needed
  provider: any
): Promise<{
  amountIn: bigint;
  path: any;
  priceImpact: number;
} | null> {
  try {
    const poolFetcher = new PoolFetcher(KURU_API_URL);
    
    // Get all available pools for this token pair
    const pools = await poolFetcher.getAllPools(
      tokenInAddress,
      BASE_TOKENS[1].address, // USDC
      BASE_TOKENS
    );

    if (!pools || pools.length === 0) {
      console.log("No Kuru pools found for this token pair");
      return null;
    }

    // Find the best path
    const amountOutNumber = Number(formatUnits(amountOut, 6)); // USDC has 6 decimals
    
    const bestPath = await PathFinder.findBestPath(
      provider,
      tokenInAddress,
      BASE_TOKENS[1].address, // USDC
      amountOutNumber,
      "amountOut", // We want exact output (invoice amount)
      poolFetcher,
      pools
    );

    if (!bestPath) {
      console.log("No valid path found");
      return null;
    }

    // Calculate amount in from the path
    const amountInNumber = (bestPath as any).amountIn || 0;
    const decimals = 18; // Assuming 18 decimals for most tokens
    const amountIn = parseUnits(amountInNumber.toString(), decimals);

    return {
      amountIn,
      path: bestPath,
      priceImpact: bestPath.priceImpact || 0,
    };
  } catch (error) {
    console.error("Kuru quote error:", error);
    return null;
  }
}

/**
 * Estimate MON needed for USDC output (simplified)
 * Assumes ~$5 per MON for testnet demo
 */
export function estimateMONForUSDC(usdcAmount: bigint): bigint {
  // 1 MON ≈ $5, so divide USDC by 5
  // USDC has 6 decimals, MON has 18
  // Convert: (USDC * 10^18) / (5 * 10^6) = USDC * 10^12 / 5
  return (usdcAmount * 10n ** 12n) / 5n;
}

/**
 * Check if Kuru has liquidity for a token pair
 */
export async function hasKuruLiquidity(
  tokenInAddress: string,
  tokenOutAddress: string
): Promise<boolean> {
  try {
    const poolFetcher = new PoolFetcher(KURU_API_URL);
    const pools = await poolFetcher.getAllPools(
      tokenInAddress,
      tokenOutAddress,
      BASE_TOKENS
    );
    return pools && pools.length > 0;
  } catch (error) {
    console.error("Error checking Kuru liquidity:", error);
    return false;
  }
}

