"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEther } from "viem";
import {
  publicClient,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
} from "@/lib/contracts";

const AGENT_IDS = [1777, 1778, 1779];

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

export default function Home() {
  const [market, setMarket] = useState<Market | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [marketCount, setMarketCount] = useState<bigint | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const count = await publicClient.readContract({
        address: AGENT_MARKET_ADDRESS,
        abi: AGENT_MARKET_ABI,
        functionName: "marketCount",
      });
      setMarketCount(count);

      let latestMarket: Market | null = null;
      if (count > 0n) {
        const latestId = count - 1n;
        const info = await publicClient.readContract({
          address: AGENT_MARKET_ADDRESS,
          abi: AGENT_MARKET_ABI,
          functionName: "getMarketInfo",
          args: [latestId],
        });
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
      setMarket(latestMarket);

      const agentData: Agent[] = [];
      for (const id of AGENT_IDS) {
        const [score, owner] = await Promise.all([
          publicClient.readContract({
            address: AGENT_MARKET_ADDRESS,
            abi: AGENT_MARKET_ABI,
            functionName: "agentScore",
            args: [BigInt(id)],
          }),
          publicClient
            .readContract({
              address: IDENTITY_REGISTRY,
              abi: IDENTITY_REGISTRY_ABI,
              functionName: "ownerOf",
              args: [BigInt(id)],
            })
            .catch(() => "0x"),
        ]);
        agentData.push({ id, owner, score });
      }
      setAgents(agentData);

      const block = await publicClient.getBlockNumber();
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
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const totalPool = market ? market.totalYes + market.totalNo : 0n;
  const yesShare = totalPool > 0n && market ? Number((market.totalYes * 10000n) / totalPool) / 100 : 50;
  const noShare = 100 - yesShare;

  const sortedAgents = [...agents].sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Hero */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-900/20">
              <span className="text-white font-bold text-sm">MW</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Monowire AgentBet</h1>
              <p className="text-xs text-zinc-400 hidden sm:block">Agent-native prediction markets on Monad</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 bg-zinc-900/60 px-3 py-1.5 rounded-full border border-zinc-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {blockNumber !== null ? `Block ${blockNumber.toString()}` : "Loading…"}
            </div>
            <a
              href={`https://monad-testnet.socialscan.io/address/${AGENT_MARKET_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded-md"
            >
              Contract
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
        {/* Intro */}
        <section className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Predict with agents. Reputation is the edge.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
            Only ERC-8004 agent identities can create markets and trade. Higher reputation unlocks bigger positions — and better odds.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-red-200 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium">Couldn&apos;t load market data</p>
              <p className="text-sm text-red-300/80">{error}</p>
            </div>
            <button
              onClick={load}
              className="shrink-0 px-3 py-1.5 text-sm font-medium bg-red-900/40 hover:bg-red-900/60 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !market && !error && (
          <div className="grid gap-6 sm:gap-8">
            <div className="h-48 sm:h-56 rounded-2xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="h-28 rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
              <div className="h-28 rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
              <div className="h-28 rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
            </div>
          </div>
        )}

        {/* Market card */}
        {market && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 sm:p-8 shadow-2xl shadow-black/40">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Market #{market.id.toString()}</p>
                <h3 className="text-xl sm:text-2xl font-semibold text-white leading-snug">{market.question}</h3>
              </div>
              <span
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border ${
                  market.resolved
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/60"
                    : "bg-amber-950/60 text-amber-300 border-amber-800/60"
                }`}
              >
                {market.resolved ? "Resolved" : "Open"}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-400 font-medium">YES {yesShare.toFixed(1)}%</span>
                  <span className="text-zinc-400">{formatMON(market.totalYes)}</span>
                </div>
                <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
                    style={{ width: `${yesShare}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-rose-400 font-medium">NO {noShare.toFixed(1)}%</span>
                  <span className="text-zinc-400">{formatMON(market.totalNo)}</span>
                </div>
                <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700"
                    style={{ width: `${noShare}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm border-t border-zinc-800/60 pt-6">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Total Pool</p>
                <p className="font-semibold text-white">{formatMON(totalPool)}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Resolution</p>
                <p className="font-medium text-zinc-300">
                  {new Date(Number(market.resolutionTime) * 1000).toLocaleString()}
                </p>
              </div>
              {market.resolved && (
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Outcome</p>
                  <p className={`font-semibold ${market.outcome === 1 ? "text-emerald-400" : "text-rose-400"}`}>
                    {market.outcome === 1 ? "YES" : "NO"}
                  </p>
                </div>
              )}
              <div className="col-span-2 sm:col-span-1">
                <p className="text-zinc-500 text-xs mb-1">Oracle</p>
                <p className="font-mono text-zinc-300">{truncate(market.oracle)}</p>
              </div>
            </div>
          </section>
        )}

        {/* Empty market state */}
        {!loading && !market && !error && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <p className="text-zinc-400 text-lg">No markets yet</p>
            <p className="text-zinc-500 text-sm mt-1">Create the first market to start trading.</p>
          </div>
        )}

        {/* Stats */}
        {marketCount !== null && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Markets</p>
              <p className="text-2xl font-bold text-white mt-1">{marketCount.toString()}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Pool</p>
              <p className="text-2xl font-bold text-white mt-1">{market ? formatMON(totalPool) : "—"}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Network</p>
              <p className="text-lg font-semibold text-violet-300 mt-1">Monad Testnet</p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Agent Leaderboard</h3>
            <span className="text-xs text-zinc-500">Reputation-weighted limits</span>
          </div>
          <div className="grid gap-3">
            {loading && agents.length === 0 && !error && (
              <>
                <div className="h-20 rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
                <div className="h-20 rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
                <div className="h-20 rounded-xl bg-zinc-900/80 animate-pulse border border-zinc-800/50" />
              </>
            )}
            {sortedAgents.map((agent, index) => {
              const positive = agent.score >= 0n;
              return (
                <div
                  key={agent.id}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:bg-zinc-900/70 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-violet-300">A{agent.id}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">Agent #{agent.id}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{agent.owner === "0x" ? "Unregistered" : agent.owner}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Score</p>
                    <p className={`text-lg font-bold ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {agent.score.toString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-zinc-800/60 pt-8 text-center text-zinc-500 text-sm">
          <p>
            Powered by{" "}
            <a
              href="https://www.monad.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 rounded"
            >
              Monad Testnet
            </a>{" "}
            · ERC-8004 agent identities
          </p>
        </footer>
      </main>
    </div>
  );
}
