import { createPublicClient, http } from "viem";

export const monadTestnet = {
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
} as const;

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

export const AGENT_MARKET_ADDRESS = process.env.NEXT_PUBLIC_AGENT_MARKET_ADDRESS as `0x${string}`;
export const IDENTITY_REGISTRY = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY as `0x${string}`;
export const REPUTATION_REGISTRY = process.env.NEXT_PUBLIC_REPUTATION_REGISTRY as `0x${string}`;
export const PYTH = (process.env.NEXT_PUBLIC_PYTH || "0x2880aB155794e7179c9eE2e38200202908C17B43") as `0x${string}`;

export const AGENT_MARKET_ABI = [
  {
    type: "constructor",
    inputs: [
      { type: "address", name: "_identityRegistry" },
      { type: "address", name: "_reputationRegistry" },
      { type: "address", name: "_pyth" },
    ],
  },
  {
    type: "function",
    name: "BASE_MAX_BET",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PYTH_MAX_PRICE_AGE",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "agentScore",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bet",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "uint256", name: "agentId" },
      { type: "bool", name: "isYes" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "claimWinnings",
    inputs: [{ type: "uint256", name: "marketId" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { type: "string", name: "question" },
      { type: "uint256", name: "resolutionTime" },
      { type: "address", name: "oracle" },
    ],
    outputs: [{ type: "uint256", name: "marketId" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createMarketWithPyth",
    inputs: [
      { type: "string", name: "question" },
      { type: "uint256", name: "resolutionTime" },
      { type: "bytes32", name: "priceFeedId" },
      { type: "int64", name: "targetPrice" },
      { type: "bool", name: "isAbove" },
    ],
    outputs: [{ type: "uint256", name: "marketId" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMarketInfo",
    inputs: [{ type: "uint256", name: "marketId" }],
    outputs: [
      { type: "string", name: "question" },
      { type: "uint256", name: "resolutionTime" },
      { type: "address", name: "creator" },
      { type: "address", name: "oracle" },
      { type: "bool", name: "resolved" },
      { type: "uint8", name: "outcome" },
      { type: "uint256", name: "totalYes" },
      { type: "uint256", name: "totalNo" },
      { type: "bytes32", name: "priceFeedId" },
      { type: "int64", name: "targetPrice" },
      { type: "bool", name: "isAbove" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMaxBet",
    inputs: [{ type: "uint256", name: "agentId" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUserBet",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "address", name: "user" },
    ],
    outputs: [
      { type: "uint256", name: "yes" },
      { type: "uint256", name: "no" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "markets",
    inputs: [{ type: "uint256" }],
    outputs: [
      { type: "string" },
      { type: "uint256" },
      { type: "address" },
      { type: "address" },
      { type: "bool" },
      { type: "uint8" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "int64" },
      { type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pyth",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolveMarket",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "uint8", name: "outcome" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveMarketWithPyth",
    inputs: [
      { type: "uint256", name: "marketId" },
      { type: "bytes[]", name: "priceUpdateData" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "updateAllAgentScores",
    inputs: [{ type: "uint256", name: "marketId" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
] as const;

export const PYTH_ABI = [
  {
    type: "function",
    name: "getPriceNoOlderThan",
    inputs: [
      { type: "bytes32", name: "id" },
      { type: "uint256", name: "age" },
    ],
    outputs: [
      { type: "int64", name: "price" },
      { type: "uint64", name: "conf" },
      { type: "int32", name: "expo" },
      { type: "uint256", name: "publishTime" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUpdateFee",
    inputs: [{ type: "bytes[]", name: "updateData" }],
    outputs: [{ type: "uint256", name: "feeAmount" }],
    stateMutability: "view",
  },
] as const;
