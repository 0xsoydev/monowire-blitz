# ClankerKit

**Autonomous wallet SDK for AI agents on Monad**

An agent-agnostic SDK that gives any AI agent (OpenClaw, LangChain, CrewAI, custom) autonomous financial capabilities with built-in guardrails — staking, swaps, transfers, and policy enforcement.

## Deployed Contracts

Contracts are deployed on both networks. AgentWallet is at the same deterministic address; both networks now have the patched PolicyEngine with `recordExecution()` access control.

### Monad Mainnet (Chain 143)

| Contract | Address |
|---|---|
| AgentWallet | `0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054` |
| PolicyEngine | `0x6B75948f29EAB424164D89F05d282CE9Aaf80EDc` |

### Monad Testnet (Chain 10143)

| Contract | Address |
|---|---|
| AgentWallet | `0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054` |
| PolicyEngine | `0x41e24c97816b76af320fa315f49e45c3a6168086` |

## Live Transactions (On-Chain Proof)

| Network | Action | TX Hash |
|---|---|---|
| Testnet | stake() 0.001 MON → validator #1 | `0x8d2999ce42c5f7e2e8e4e1f80e1b9bb687e2ff42594b7843a387bb1b26b57c64` |
| Testnet | swap() MON→WMON (0.005) | `0xda7e43319c67a03f437c676d07b423bd89449cba21a8f09aac76f215d00b5534` |
| Testnet | createPolicy() 0.1 MON daily limit | `0x33e07223923684c9636ecbb6b9ce148f32ae1d003eab88e6f08e6fe4d1561b3b` |
| Testnet | sendToken() 0.001 WMON | `0x912ca129e8d365903dcdb05c5b9d4abc727dbafd78fd51aeeb1126c4130a8cda` |
| Testnet | Deploy patched PolicyEngine | `0xb18af400d5e1ec32c7c6a1bd29a8f3fe739a0d6519d344784422041b8c596d6f` |
| Testnet | setPolicyEngine (patched) | `0xf4dd1e61eb7e308de76d709206dd70462e8545ef195efd6edb3e20d5fd661363` |
| Testnet | createPolicy (0.1 daily / 0.7 weekly) | `0xc9ef3ca2c07cf31fc154722adea6f5c5412bac8be2dffc7e639d9fe79bae6f8e` |
| Mainnet | createPolicy() 1 MON daily / 5 MON weekly | `0x2371a0410841b05bd3f75ac85212d7022f3f8142be63d880545fdbb8a9e862b9` |
| Mainnet | swap() MON→CHOG (0.005) via Kuru Flow | `0x5500d8795f091f417cc642bb4750cb55637c46ee83a929c3e6c79d8ed67b980e` |
| Mainnet | swap() MON→USDC (0.005) via Kuru Flow | `0x8ab58df2e53f369f44a60ac8fa000961328bd02e9b0f60d4c019cceb577f9738` |
| Mainnet | Deploy patched PolicyEngine | `0x5d2d5ba765868ab70a0d8db249620ec928b1537560230a3d179c8c83766f2ee6` |
| Mainnet | setPolicyEngine (patched) | `0xd5d7867ef8d1d2e6890ebcb55d0fcbbece2c6f40be03ebcb8a256f2088d6d9c9` |
| Mainnet | createPolicy (1 daily / 5 weekly) | `0xdde7daabb25a4dabd71df06573f8d125a205ba420fbf0ee1af21b7276dbf4901` |
| Mainnet | ensureGas() EOA top-up | `0x8760962ed79afc558da0ceca74dd505e834747bd63f470e96af89bccada333a9` |

## Features

| Feature | Testnet | Mainnet |
|---------|---------|---------|
| Send MON / ERC20 | Yes | Yes |
| Policy enforcement (daily/weekly limits) | Yes | Yes |
| Staking / delegation (native Monad precompile) | Yes | Yes |
| Swap MON <-> WMON (wrap/unwrap) | Yes | -- |
| Swap via Kuru Flow DEX (full routing) | -- | Yes |
| Kuru CLOB orderbook (getOrderBook / getMarketPrice) | -- | Yes |
| Memecoin price feeds (CHOG, DAK, YAKI) | -- | Yes |
| Memecoin strategy engine (DCA / scalp / hodl) | -- | Yes |
| Cross-chain swaps (KyberSwap — Arbitrum, Base, etc.) | -- | Yes |
| Cross-chain swaps (0x Protocol) | -- | Yes |
| Execute arbitrary contract calls | Yes | Yes |
| x402 gasless micropayments | Yes | Yes |
| ensureGas() — auto-fund EOA from wallet | Yes | Yes |
| Deploy new wallets + policy engines via SDK | Yes | Yes |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ANY AI AGENT                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │OpenClaw  │  │LangChain │  │ CrewAI   │  │ Custom   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        └─────────────┴─────────────┴─────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLANKERKIT SDK                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Wallet API  │  │ Policy SDK  │  │    Staking API      │ │
│  │ send()      │  │ createPolicy│  │    stake()          │ │
│  │ swap()      │  │ dailyLimits │  │    unstake()        │ │
│  │ execute()   │  │ allowlists  │  │    claimRewards()   │ │
│  │ ensureGas() │  │             │  │    compoundRewards()│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 SMART CONTRACTS (Monad)                     │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │ AgentWallet     │  │ PolicyEngine                    │  │
│  │ - Agent as owner│  │ - Spending limits               │  │
│  │ - Execute calls │  │ - Token allowlists              │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Monad Staking Precompile (0x1000)                   │   │
│  │ - delegate() / undelegate() / claimRewards()        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Install SDK

```bash
npm install @clankerkit/monad
```

### Basic Usage

```typescript
import { ClankerKit } from '@clankerkit/monad';

const agent = new ClankerKit({
  walletAddress: '0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054',
  owner: '0xYourAddress',
  agentKey: '0xAgentPrivateKey',
  policyEngine: '0x6B75948f29EAB424164D89F05d282CE9Aaf80EDc',
  testnet: false, // mainnet
});

// Ensure the agent has gas (auto-funds EOA from wallet)
await agent.ensureGas();

// Wallet info
const info = await agent.getInfo();
console.log(info.balance, info.policies?.dailyLimit);

// Send MON
await agent.send('0xRecipient', 10000000000000000n); // 0.01 MON

// Swap MON → USDC (mainnet via Kuru Flow)
await agent.swap({ tokenIn: 'MON', tokenOut: 'USDC', amount: 5000000000000000n });

// Stake with validator
await agent.stake(1n, 10000000000000000n); // 0.01 MON, validator #1

// Claim staking rewards
await agent.claimStakingRewards(1n);
```

### Policy Engine

```typescript
// Create policy with limits
await agent.createPolicy({
  dailyLimit: 100000000000000000n,   // 0.1 MON/day
  weeklyLimit: 500000000000000000n,  // 0.5 MON/week
  allowedTokens: [],
  allowedContracts: [],
  requireApprovalAbove: 50000000000000000n, // > 0.05 MON needs approval
});

// Check remaining budget
const state = await agent.getPolicyState();
const remaining = state.dailyLimit - state.dailySpent;
```

### Staking

```typescript
// Get epoch info
const epoch = await agent.getEpoch();
console.log('Epoch:', epoch.epoch);

// Stake
await agent.stake(1n, 10000000000000000n);

// Check delegation
const del = await agent.getDelegationInfo(1n);
console.log('Active:', del.stake, 'Pending:', del.deltaStake);

// Unstake & withdraw
await agent.unstake(1n, 10000000000000000n);
await agent.withdrawStake(1n);

// Compound rewards automatically
await agent.compoundRewards(1n);
```

### Deploy New Wallet

```typescript
import { deployAgentWallet } from '@clankerkit/monad';

// Deploys both PolicyEngine + AgentWallet in sequence
const { walletAddress, policyEngineAddress, hash } = await deployAgentWallet(
  '0xYourPrivateKey',
  '0xOwnerAddress',
  '0xAgentAddress',
  { testnet: false }
);
console.log('Wallet:', walletAddress);
```

## Development

### Run the full test suite

```bash
cd sdk
npm install
npm run build

# Read-only (no transactions, no funds needed)
NODE_PATH=./node_modules npx tsx examples/mainnet-test.ts

# Live transactions (requires funded mainnet wallet)
READ_ONLY=false NODE_PATH=./node_modules npx tsx examples/mainnet-test.ts
```

### Deploy contracts via Foundry

```bash
cd contracts
cp .env.example .env  # add PRIVATE_KEY and RPC_URL
forge build
forge script script/Deploy.s.sol:DeployAgentKit --rpc-url https://testnet-rpc.monad.xyz --broadcast
# For mainnet:
forge script script/Deploy.s.sol:DeployAgentKit --rpc-url https://rpc.monad.xyz --broadcast --chain-id 143
```

## License

MIT
