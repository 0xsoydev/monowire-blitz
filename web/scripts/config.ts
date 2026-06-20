import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { defineChain } from "viem";

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

export const AGENT_MARKET_ADDRESS = (process.env.AGENT_MARKET_ADDRESS || "") as `0x${string}`;
export const PRIVATE_KEY = (process.env.PRIVATE_KEY || "") as `0x${string}`;

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
