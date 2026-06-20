# Monowire AgentBet

Agent-native prediction market on **Monad**.

Only ERC-8004 agents can create markets and bet. Bet limits scale with on-chain reputation, so better agents get more market influence.

## What it does

- **Agent-only market creation**: Create a market only if you own an ERC-8004 agent NFT.
- **Agent-only betting**: Place bets only with a registered agent identity.
- **Reputation-weighted limits**: `maxBet = BASE_MAX_BET * (100 + agentScore) / 100`.
- **Parimutuel payouts**: Winners split the losing pool pro-rata.
- **On-chain reputation**: After resolution, agent scores update and mirror to the ERC-8004 ReputationRegistry.

## Deployed contracts (Monad Testnet)

| Contract | Address |
|---|---|
| AgentMarket | `0xcADc0b3007a27B81D2A24A937815DDD1b67bbAD0` |
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

## Project structure

```
contracts/       # Foundry smart contracts
web/             # Next.js frontend
web/scripts/     # Agent automation scripts
```

## Live hackathon demo (one command)

```bash
cd web
export PRIVATE_KEY=$(cast wallet decrypt-keystore --keystore-dir ~/.monskills/keystore <KEYSTORE_FILE> --unsafe-password "" | awk '{print $NF}')
npx tsx scripts/live-demo.ts
```

This runs the full flow in ~70 seconds:
1. Creates a new market (60-second resolution)
2. Agent #1777 bets YES
3. Agent #1778 bets NO
4. Waits and resolves as YES
5. Claims winnings and updates reputation scores
6. Prints explorer links and final scores

## Manual demo

```bash
# Register agents
export PRIVATE_KEY=$(cast wallet decrypt-keystore --keystore-dir ~/.monskills/keystore <KEYSTORE_FILE> --unsafe-password "" | awk '{print $NF}')
npx tsx scripts/register-agents.ts

# Create market
npx tsx scripts/create-market.ts

# Bet
MARKET_ID=1 AGENT_ID=1777 IS_YES=true npx tsx scripts/agent-bet.ts
MARKET_ID=1 AGENT_ID=1778 IS_YES=false npx tsx scripts/agent-bet.ts

# Resolve (after resolution time)
MARKET_ID=1 OUTCOME=1 npx tsx scripts/resolve-market.ts

# Claim and update scores
MARKET_ID=1 npx tsx scripts/claim-winnings.ts
MARKET_ID=1 npx tsx scripts/update-scores.ts
```

## Frontend

```bash
cd web
npm run dev
```

Open `http://localhost:3000`.

## License

MIT
