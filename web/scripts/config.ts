import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { defineChain } from "viem";
import { execSync } from "child_process";

const KEYSTORE_FILE = "e803ff23-8173-4f8d-a5b9-dde7ee76159f";

export function getPrivateKey(): `0x${string}` {
  if (process.env.AGENT_PRIVATE_KEY) {
    return process.env.AGENT_PRIVATE_KEY as `0x${string}`;
  }
  try {
    const result = execSync(
      `cast wallet decrypt-keystore --keystore-dir ~/.monskills/keystore ${KEYSTORE_FILE} --unsafe-password "" | awk '{print $NF}'`,
      { encoding: "utf-8" }
    );
    return result.trim() as `0x${string}`;
  } catch (err) {
    throw new Error(
      "AGENT_PRIVATE_KEY env var is required, or Foundry must be installed to decrypt the monskills keystore."
    );
  }
}

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
    public: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Testnet Socialscan", url: "https://monad-testnet.socialscan.io" },
  },
  contracts: {
    multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
  },
});

export const IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
export const REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713";
export const USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
export const PYTH = "0x2880aB155794e7179c9eE2e38200202908C17B43";
export const PYTH_BETA = "0xad2B52D2af1a9bD5c561894Cdd84f7505e1CD0B5";

export const PYTH_FEED_ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
export const PYTH_FEED_BTC_USD = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
export const PYTH_FEED_MON_USD = "0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1";
export const PYTH_FEED_SOL_USD = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
export const PYTH_FEED_USDC_USD = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
export const PYTH_FEED_USDT_USD = "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b";

export const PYTH_FEED_EXPONENTS: Record<string, number> = {
  [PYTH_FEED_ETH_USD]: -8,
  [PYTH_FEED_BTC_USD]: -8,
  [PYTH_FEED_MON_USD]: -8,
  [PYTH_FEED_SOL_USD]: -8,
  [PYTH_FEED_USDC_USD]: -8,
  [PYTH_FEED_USDT_USD]: -8,
};

export const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "agentURI", type: "string" }],
    name: "register",
    outputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "agentURI", type: "string" },
      { indexed: true, name: "owner", type: "address" },
    ],
    anonymous: false,
  },
] as const;

export const REPUTATION_REGISTRY_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "agentId", type: "uint256" },
      { internalType: "int128", name: "value", type: "int128" },
      { internalType: "uint8", name: "valueDecimals", type: "uint8" },
      { internalType: "string", name: "tag1", type: "string" },
      { internalType: "string", name: "tag2", type: "string" },
      { internalType: "string", name: "endpoint", type: "string" },
      { internalType: "string", name: "feedbackURI", type: "string" },
      { internalType: "bytes32", name: "feedbackHash", type: "bytes32" },
    ],
    name: "giveFeedback",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const AGENT_MARKET_ABI = [
  {
    type: "constructor",
    inputs: [
      { internalType: "address", name: "_identityRegistry", type: "address" },
      { internalType: "address", name: "_reputationRegistry", type: "address" },
    ],
  },
  {
    type: "function",
    name: "BASE_MAX_BET",
    inputs: [],
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "agentScore",
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    outputs: [{ internalType: "int256", name: "", type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bet",
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "uint256", name: "agentId", type: "uint256" },
      { internalType: "bool", name: "isYes", type: "bool" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimWinnings",
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { internalType: "string", name: "question", type: "string" },
      { internalType: "uint256", name: "resolutionTime", type: "uint256" },
      { internalType: "address", name: "oracle", type: "address" },
    ],
    outputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createMarketWithPyth",
    inputs: [
      { internalType: "string", name: "question", type: "string" },
      { internalType: "uint256", name: "resolutionTime", type: "uint256" },
      { internalType: "bytes32", name: "priceFeedId", type: "bytes32" },
      { internalType: "int64", name: "targetPrice", type: "int64" },
      { internalType: "bool", name: "isAbove", type: "bool" },
    ],
    outputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMarketInfo",
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    outputs: [
      { internalType: "string", name: "question", type: "string" },
      { internalType: "uint256", name: "resolutionTime", type: "uint256" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "address", name: "oracle", type: "address" },
      { internalType: "bool", name: "resolved", type: "bool" },
      { internalType: "uint8", name: "outcome", type: "uint8" },
      { internalType: "uint256", name: "totalYes", type: "uint256" },
      { internalType: "uint256", name: "totalNo", type: "uint256" },
      { internalType: "bytes32", name: "priceFeedId", type: "bytes32" },
      { internalType: "int64", name: "targetPrice", type: "int64" },
      { internalType: "bool", name: "isAbove", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMaxBet",
    inputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserBet",
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    outputs: [
      { internalType: "uint256", name: "yes", type: "uint256" },
      { internalType: "uint256", name: "no", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketCount",
    inputs: [],
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "markets",
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    outputs: [
      { internalType: "string", name: "question", type: "string" },
      { internalType: "uint256", name: "resolutionTime", type: "uint256" },
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "address", name: "oracle", type: "address" },
      { internalType: "bool", name: "resolved", type: "bool" },
      { internalType: "uint8", name: "outcome", type: "uint8" },
      { internalType: "uint256", name: "totalYes", type: "uint256" },
      { internalType: "uint256", name: "totalNo", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolveMarket",
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "uint8", name: "outcome", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveMarketWithPyth",
    inputs: [
      { internalType: "uint256", name: "marketId", type: "uint256" },
      { internalType: "bytes[]", name: "priceUpdateData", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "pyth",
    inputs: [],
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PYTH_MAX_PRICE_AGE",
    inputs: [],
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "updateAllAgentScores",
    inputs: [{ internalType: "uint256", name: "marketId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateAgentScore",
    inputs: [
      { internalType: "uint256", name: "agentId", type: "uint256" },
      { internalType: "bool", name: "correct", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const AGENT_MARKET_ADDRESS = (process.env.AGENT_MARKET_ADDRESS || "0x2b24fB2D6FbD79AF6f81101e8Fb673c3194943A1") as `0x${string}`;

export function toPythPrice(humanPrice: number, feedId: string): bigint {
  const expo = PYTH_FEED_EXPONENTS[feedId] ?? -8;
  const multiplier = 10 ** (-expo);
  return BigInt(Math.round(humanPrice * multiplier));
}

export function fromPythPrice(rawPrice: bigint, feedId: string): number {
  const expo = PYTH_FEED_EXPONENTS[feedId] ?? -8;
  const multiplier = 10 ** (-expo);
  return Number(rawPrice) / multiplier;
}

export function createAgentCard(name: string, agentId: number, image: string) {
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description: "Monowire prediction agent",
    image,
    services: [{ name: "web", endpoint: "https://monowire-blitz.vercel.app" }],
    x402Support: false,
    active: true,
    registrations: [{ agentId, agentRegistry: `eip155:10143:${IDENTITY_REGISTRY}` }],
    supportedTrust: ["reputation"],
  };
  const json = JSON.stringify(card);
  const base64 = Buffer.from(json).toString("base64");
  return `data:application/json;base64,${base64}`;
}
