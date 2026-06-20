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

export const AGENT_MARKET_ABI = [
  {
    type: "function",
    name: "BASE_MAX_BET",
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
    name: "getMarketInfo",
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
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMaxBet",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "uint256" }],
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
    ],
    stateMutability: "view",
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
