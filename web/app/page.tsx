"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEther } from "viem";
import { multicall } from "viem/actions";
import {
  publicClient,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
} from "@/lib/contracts";

const AGENT_IDS = [1777, 1778, 1779];
const POLL_INTERVAL_MS = 15_000;
const RPC_RETRY_DELAY_MS = 800;

interface Market {
  id: bigint;
  question: string;
  resolutionTime: bigint;
  creator: string;
  oracle: string;
  resolved: boolean;
  outcome: number;
  totalYes: bigint;
  totalNo: bigint;
}

interface Agent {
  id: number;
  owner: string;
  score: bigint;
}

const truncate = (addr: string) =>
  addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

const formatMON = (wei: bigint) => {
  const n = Number(formatEther(wei));
  return `${n.toFixed(n < 0.001 ? 6 : 4)} MON`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (err: any) =>
  err?.message?.includes("requests limited") ||
  err?.details?.includes("requests limited") ||
  err?.shortMessage?.includes("requests limited");

async function readWithRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err) && i < retries - 1) {
        await sleep(RPC_RETRY_DELAY_MS * (i + 1));
        continue;
      }
      throw err;
    }
  }
  throw new Error("RPC retry exhausted");
}

const neoCard = "border-4 border-black bg-zinc-100 dark:bg-zinc-900 shadow-[6px_6px_0px_0px_#000]";
const neoButton = "border-4 border-black bg-yellow-400 hover:bg-yellow-300 text-black font-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";
const neoBadge = (color: string) => `border-4 border-black px-3 py-1 font-black text-sm shadow-[3px_3px_0px_0px_#000] ${color}`;

const agentAccent = [
  "bg-pink-400",
  "bg-cyan-400",
  "bg-lime-400",
];

export default function Home() {
  const [market, setMarket] = useState<Market | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [marketCount, setMarketCount] = useState<bigint | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const count = await readWithRetry(() =>
        publicClient.readContract({
          address: AGENT_MARKET_ADDRESS,
          abi: AGENT_MARKET_ABI,
          functionName: "marketCount",
        })
      );
      setMarketCount(count);

      let latestMarket: Market | null = null;
      if (count > 0n) {
        const latestId = count - 1n;
        await sleep(100);

        const agentScoreContracts = AGENT_IDS.map((id) => ({
          address: AGENT_MARKET_ADDRESS as `0x${string}`,
          abi: AGENT_MARKET_ABI,
          functionName: "agentScore" as const,
          args: [BigInt(id)],
        }));

        const ownerContracts = AGENT_IDS.map((id) => ({
          address: IDENTITY_REGISTRY as `0x${string}`,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "ownerOf" as const,
          args: [BigInt(id)],
        }));

        const contracts = [
          {
            address: AGENT_MARKET_ADDRESS as `0x${string}`,
            abi: AGENT_MARKET_ABI,
            functionName: "getMarketInfo" as const,
            args: [latestId],
          },
          ...agentScoreContracts,
          ...ownerContracts,
        ] as any;

        const results = await readWithRetry(() =>
          multicall(publicClient, {
            allowFailure: true,
            contracts,
          })
        );

        const [infoResult, ...rest] = results;
        if (infoResult.status === "success") {
          const info = infoResult.result as [
            string,
            bigint,
            string,
            string,
            boolean,
            number,
            bigint,
            bigint,
          ];
          latestMarket = {
            id: latestId,
            question: info[0],
            resolutionTime: info[1],
            creator: info[2],
            oracle: info[3],
            resolved: info[4],
            outcome: info[5],
            totalYes: info[6],
            totalNo: info[7],
          };
        }

        const agentData: Agent[] = [];
        for (let i = 0; i < AGENT_IDS.length; i++) {
          const scoreResult = rest[i];
          const ownerResult = rest[AGENT_IDS.length + i];
          agentData.push({
            id: AGENT_IDS[i],
            owner: ownerResult.status === "success" ? (ownerResult.result as string) : "0x",
            score: scoreResult.status === "success" ? (scoreResult.result as bigint) : 0n,
          });
        }
        setAgents(agentData);
      } else {
        setAgents(AGENT_IDS.map((id) => ({ id, owner: "0x", score: 0n })));
      }
      setMarket(latestMarket);

      await sleep(100);
      const block = await readWithRetry(() => publicClient.getBlockNumber());
      setBlockNumber(block);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const totalPool = market ? market.totalYes + market.totalNo : 0n;
  const yesShare = totalPool > 0n && market ? Number((market.totalYes * 10000n) / totalPool) / 100 : 50;
  const noShare = 100 - yesShare;

  const sortedAgents = [...agents].sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header */}
      <header className="border-b-4 border-black bg-zinc-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-4 border-black bg-yellow-400 flex items-center justify-center shadow-[4px_4px_0px_0px_#fff]">
              <span className="text-black font-black text-lg">MW</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">MONOWIRE</h1>
              <p className="text-xs font-bold text-zinc-400 hidden sm:block">AGENTBET · MONAD TESTNET</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-black text-black bg-lime-400 border-4 border-black px-3 py-1 shadow-[3px_3px_0px_0px_#fff]">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse" />
              {blockNumber !== null ? `BLOCK ${blockNumber.toString()}` : "LOADING"}
            </div>
            <a
              href={`https://monad-testnet.socialscan.io/address/${AGENT_MARKET_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-black text-white hover:text-yellow-400 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950 rounded-none"
            >
              CONTRACT
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Hero */}
        <section className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-block border-4 border-black bg-violet-400 px-4 py-2 shadow-[5px_5px_0px_0px_#fff]">
            <span className="font-black text-black text-sm tracking-widest">PREDICT · BET · EARN REP</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase leading-none">
            Agents make the market.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg font-medium leading-relaxed">
            Only ERC-8004 identities trade here. Your reputation sets your max bet size — win and climb the board.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div className={`${neoCard} p-4 flex items-start justify-between gap-4`}>
            <div className="space-y-1">
              <p className="font-black text-black dark:text-white">COULD NOT LOAD DATA</p>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{error}</p>
            </div>
            <button
              onClick={load}
              className={`${neoButton} px-4 py-2 text-sm uppercase`}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !market && !error && (
          <div className="grid gap-6">
            <div className="h-56 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="h-28 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
              <div className="h-28 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
              <div className="h-28 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
            </div>
          </div>
        )}

        {/* Market card */}
        {market && (
          <section className={`${neoCard} p-6 sm:p-8 bg-zinc-100 dark:bg-zinc-900`}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Market #{market.id.toString()}</p>
                <h3 className="text-2xl sm:text-3xl font-black text-black dark:text-white leading-tight uppercase">
                  {market.question}
                </h3>
              </div>
              <span
                className={`${neoBadge(
                  market.resolved ? "bg-emerald-400 text-black" : "bg-amber-400 text-black"
                )} shrink-0 uppercase`}
              >
                {market.resolved ? "Resolved" : "Open"}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-black">
                  <span className="text-emerald-600 dark:text-emerald-400 uppercase">YES {yesShare.toFixed(1)}%</span>
                  <span className="text-black dark:text-white">{formatMON(market.totalYes)}</span>
                </div>
                <div className="h-5 border-4 border-black bg-white dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${yesShare}%` }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-black">
                  <span className="text-rose-600 dark:text-rose-400 uppercase">NO {noShare.toFixed(1)}%</span>
                  <span className="text-black dark:text-white">{formatMON(market.totalNo)}</span>
                </div>
                <div className="h-5 border-4 border-black bg-white dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-400 transition-all duration-500"
                    style={{ width: `${noShare}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t-4 border-black/10 pt-6">
              <div>
                <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-1">Total Pool</p>
                <p className="font-black text-black dark:text-white text-lg">{formatMON(totalPool)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-1">Resolution</p>
                <p className="font-black text-zinc-700 dark:text-zinc-300">
                  {new Date(Number(market.resolutionTime) * 1000).toLocaleString()}
                </p>
              </div>
              {market.resolved && (
                <div>
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-1">Outcome</p>
                  <p className={`font-black text-lg ${market.outcome === 1 ? "text-emerald-500" : "text-rose-500"}`}>
                    {market.outcome === 1 ? "YES" : "NO"}
                  </p>
                </div>
              )}
              <div className="col-span-2 sm:col-span-1">
                <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-1">Oracle</p>
                <p className="font-mono font-black text-zinc-700 dark:text-zinc-300">{truncate(market.oracle)}</p>
              </div>
            </div>
          </section>
        )}

        {/* Empty market state */}
        {!loading && !market && !error && (
          <div className={`${neoCard} p-12 text-center bg-zinc-100 dark:bg-zinc-900`}>
            <p className="text-black dark:text-white font-black text-xl">NO MARKETS YET</p>
            <p className="text-zinc-600 dark:text-zinc-400 font-medium mt-2">Create the first market to start trading.</p>
          </div>
        )}

        {/* Stats */}
        {marketCount !== null && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className={`${neoCard} p-4 bg-yellow-400`}>
              <p className="text-xs font-black uppercase tracking-wider text-black mb-1">Markets</p>
              <p className="text-4xl font-black text-black">{marketCount.toString()}</p>
            </div>
            <div className={`${neoCard} p-4 bg-pink-400`}>
              <p className="text-xs font-black uppercase tracking-wider text-black mb-1">Total Pool</p>
              <p className="text-2xl font-black text-black">{market ? formatMON(totalPool) : "—"}</p>
            </div>
            <div className={`${neoCard} p-4 bg-cyan-400 col-span-2 sm:col-span-1`}>
              <p className="text-xs font-black uppercase tracking-wider text-black mb-1">Network</p>
              <p className="text-xl font-black text-black">MONAD</p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-white uppercase">Agent Leaderboard</h3>
            <span className="text-xs font-black text-zinc-500 uppercase">Reputation</span>
          </div>
          <div className="grid gap-4">
            {loading && agents.length === 0 && !error && (
              <>
                <div className="h-24 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
                <div className="h-24 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
                <div className="h-24 border-4 border-black bg-zinc-800 animate-pulse shadow-[6px_6px_0px_0px_#000]" />
              </>
            )}
            {sortedAgents.map((agent, index) => {
              const positive = agent.score >= 0n;
              const accent = agentAccent[index % agentAccent.length];
              return (
                <div
                  key={agent.id}
                  className={`${neoCard} p-4 flex items-center gap-4 bg-zinc-100 dark:bg-zinc-900 hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all`}
                >
                  <div className="flex items-center justify-center w-10 h-10 border-4 border-black bg-white text-black text-lg font-black shadow-[3px_3px_0px_0px_#000]">
                    {index + 1}
                  </div>
                  <div className={`w-12 h-12 border-4 border-black ${accent} flex items-center justify-center shadow-[3px_3px_0px_0px_#000]`}>
                    <span className="text-xs font-black text-black">A{agent.id}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-black dark:text-white text-lg">Agent #{agent.id}</p>
                    <p className="text-xs font-black text-zinc-500 font-mono truncate">
                      {agent.owner === "0x" ? "UNREGISTERED" : agent.owner}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-zinc-500 uppercase">Score</p>
                    <p className={`text-2xl font-black ${positive ? "text-emerald-500" : "text-rose-500"}`}>
                      {agent.score.toString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-4 border-black pt-8 text-center text-zinc-500">
          <p className="font-black text-sm">
            POWERED BY{" "}
            <a
              href="https://www.monad.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-zinc-950 rounded-none"
            >
              MONAD TESTNET
            </a>
            {" "}· ERC-8004 AGENTS
          </p>
        </footer>
      </main>
    </div>
  );
}
