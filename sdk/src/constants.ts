import { type Address } from 'viem';

export const MONAD_CHAIN = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' },
  },
} as const;

export const MONAD_MAINNET = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: 'https://monadvision.com' },
  },
} as const;

export const NATIVE_MON = '0x0000000000000000000000000000000000000000' as Address;

export const TOKEN_ADDRESSES = {
  testnet: {
    WMON: '0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541' as Address,
    USDC: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea' as Address,
    USDT: '0x88b8E2161DEDC77EF4ab7585569D2415a1C1055D' as Address,
    DAK: '0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714' as Address,
    CHOG: '0xE0590015A873bF326bd645c3E1266d4db41C4E6B' as Address,
    YAKI: '0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50' as Address,
    kUSDC: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea' as Address,
  },
  mainnet: {
    WMON:  '0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A' as Address,
    USDC:  '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as Address,
    AUSD:  '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a' as Address,
    USDT0: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D' as Address,
    WETH:  '0xEE8c0E9f1BFFb4Eb878d8f15f368A02a35481242' as Address,
    WBTC:  '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c' as Address,
    // Monad-native memecoins (mainnet addresses confirmed via Kuru market data)
    CHOG:  '0x350035555e10d9afaf1566aaebfced5ba6c27777' as Address,
    DAK:   '0x3a25ce2b3c44e22c997e515d57aea6fbd6677777' as Address,  // ticker "dks"/"daks" on Kuru
  },
} as const;

export const TOKEN_DECIMALS: Record<string, number> = {
  MON: 18,
  WMON: 18,
  USDC: 6,
  USDT: 6,
  DAK: 18,
  CHOG: 18,
  YAKI: 18,
  AUSD: 6,
  WETH: 18,
  WBTC: 8,
};

export const KURU_FLOW_API = 'https://ws.kuru.io';

// KuruFlowEntrypoint on mainnet (aggregator)
export const KURU_FLOW_ENTRYPOINT_MAINNET = '0xb3e6778480b2E488385E8205eA05E20060B813cb' as Address;

// ─── Kuru CLOB contracts (Monad Mainnet) ────────────────────────────────────
export const KURU_CONTRACTS = {
  KuruFlowRouter: '0x0d3a1BE29E9dEd63c7a5678b31e847D68F71FFa2' as Address,
  MarginAccount:  '0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5' as Address,
  Router:         '0xd651346d7c789536ebf06dc72aE3C8502cd695CC' as Address,
} as const;

/** Known Kuru CLOB orderbook addresses on Monad Mainnet */
export const KURU_MARKETS = {
  'MON/AUSD': '0x131a2e70a5b31a517a74b8c567149bc294470da9' as Address,
  // Kuru SDK v1.0.3 L2-book parsing overflows on large-integer prices
  // (BigNumber.from converts to JS number, exceeding 2^53 safe integer).
  // MON/USDC, CHOG/MON, DAK/WMON all trigger this — disabled until SDK fix.
  // 'MON/USDC': '0x065C9d28E428A0db40191a54d33d5b7c71a9C394',
  // 'CHOG/MON': '0x5e5166f02b8f91ab80833270435172078f4178ca',
  // 'DAK/WMON':  '0xab4388eef57a903bbaacd65a13d4dedaa5aded4e',
} as const;

// ─── KyberSwap Aggregator ─────────────────────────────────────────────────────
export const KYBERSWAP_API = 'https://aggregator-api.kyberswap.com';

/** KyberSwap chain slug per EVM chain */
export const KYBERSWAP_CHAIN_SLUGS: Record<string, string> = {
  ethereum:  'ethereum',
  polygon:   'polygon',
  arbitrum:  'arbitrum',
  optimism:  'optimism',
  base:      'base',
  bsc:       'bsc',
  avalanche: 'avalanche',
};

// ─── 0x Swap API v2 ──────────────────────────────────────────────────────────
export const ZEROX_API = 'https://api.0x.org';

/** 0x chain IDs */
export const ZEROX_CHAIN_IDS: Record<string, number> = {
  ethereum:  1,
  polygon:   137,
  arbitrum:  42161,
  optimism:  10,
  base:      8453,
  bsc:       56,
  avalanche: 43114,
};

export const WMON_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wad', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const ERC_8004_ADDRESSES = {
  testnet: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address,
  },
  mainnet: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address,
  },
} as const;

export const X402_FACILITATOR = 'https://x402-facilitator.molandak.org';

export const STAKING_PRECOMPILE = '0x0000000000000000000000000000000000001000' as Address;

export const DEFAULT_VALIDATOR_ID = 1n;

export const LAYERZERO = {
  testnet: {
    endpoint: '0x6C7Ab2202C98C4227C5c46f1417D81144DA716Ff' as Address,
    eid: 40204,
  },
} as const;

export const AGENT_WHEEL_ABI = [
  {
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'execute',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transferToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'agent',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const POLICY_ENGINE_ABI = [
  {
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'weeklyLimit', type: 'uint256' },
      { name: 'allowedTokens', type: 'address[]' },
      { name: 'allowedContracts', type: 'address[]' },
      { name: 'requireApprovalAbove', type: 'uint256' },
    ],
    name: 'createPolicy',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'getPolicy',
    outputs: [
      { name: 'isActive', type: 'bool' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'weeklyLimit', type: 'uint256' },
      { name: 'dailySpent', type: 'uint256' },
      { name: 'weeklySpent', type: 'uint256' },
      { name: 'requireApprovalAbove', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'newLimit', type: 'uint256' },
    ],
    name: 'updateDailyLimit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'wallet', type: 'address' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    name: 'canExecute',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'wallet', type: 'address' }],
    name: 'getRemainingLimits',
    outputs: [
      { name: 'dailyRemaining', type: 'uint256' },
      { name: 'weeklyRemaining', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const STAKING_ABI = [
  {
    inputs: [{ name: 'validatorId', type: 'uint64' }],
    name: 'delegate',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'validatorId', type: 'uint64' },
      { name: 'amount', type: 'uint256' },
      { name: 'withdrawId', type: 'uint8' },
    ],
    name: 'undelegate',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'validatorId', type: 'uint64' },
      { name: 'withdrawId', type: 'uint8' },
    ],
    name: 'withdraw',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'validatorId', type: 'uint64' }],
    name: 'claimRewards',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'validatorId', type: 'uint64' }],
    name: 'compound',
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'validatorId', type: 'uint64' }],
    name: 'getValidator',
    outputs: [
      { name: 'authAddress', type: 'address' },
      { name: 'flags', type: 'uint64' },
      { name: 'stake', type: 'uint256' },
      { name: 'accRewardPerToken', type: 'uint256' },
      { name: 'commission', type: 'uint256' },
      { name: 'unclaimedRewards', type: 'uint256' },
      { name: 'consensusStake', type: 'uint256' },
      { name: 'consensusCommission', type: 'uint256' },
      { name: 'snapshotStake', type: 'uint256' },
      { name: 'snapshotCommission', type: 'uint256' },
      { name: 'secpPubkey', type: 'bytes' },
      { name: 'blsPubkey', type: 'bytes' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'validatorId', type: 'uint64' },
      { name: 'delegator', type: 'address' },
    ],
    name: 'getDelegator',
    outputs: [
      { name: 'stake', type: 'uint256' },
      { name: 'accRewardPerToken', type: 'uint256' },
      { name: 'unclaimedRewards', type: 'uint256' },
      { name: 'deltaStake', type: 'uint256' },
      { name: 'nextDeltaStake', type: 'uint256' },
      { name: 'deltaEpoch', type: 'uint64' },
      { name: 'nextDeltaEpoch', type: 'uint64' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEpoch',
    outputs: [
      { name: 'epoch', type: 'uint64' },
      { name: 'inEpochDelayPeriod', type: 'bool' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'startIndex', type: 'uint32' }],
    name: 'getExecutionValidatorSet',
    outputs: [
      { name: 'isDone', type: 'bool' },
      { name: 'nextIndex', type: 'uint32' },
      { name: 'valIds', type: 'uint64[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
