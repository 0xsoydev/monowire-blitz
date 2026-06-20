"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import {
  publicClient,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
} from "@/lib/contracts";

const AGENT_IDS = [1777, 1778, 1779];
const POLL_INTERVAL_MS = 20_000;
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

const neoCard = "border-4 border-black bg-[#141414] shadow-[6px_6px_0px_0px_#000]";
const neoButton = "border-4 border-black bg-violet-400 hover:bg-violet-300 text-black font-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";
const neoBadge = (color: string) => `border-4 border-black px-3 py-1 font-black text-xs shadow-[3px_3px_0px_0px_#000] uppercase ${color}`;

const agentAccent = ["bg-pink-400", "bg-cyan-400", "bg-lime-400"];
const statsAccent = ["bg-yellow-400", "bg-pink-400", "bg-cyan-400", "bg-lime-400"];

export default function Home() {
  const [market, setMarket] = useState<Market | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
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
      const marketData: Market[] = [];
      if (count > 0n) {
        const latestId = count - 1n;

        for (let i = 0n; i < count; i++) {
          await sleep(150);
          const info = await readWithRetry(() =>
            publicClient.readContract({
              address: AGENT_MARKET_ADDRESS,
              abi: AGENT_MARKET_ABI,
              functionName: "getMarketInfo",
              args: [i],
            })
          );
          const m = {
            id: i,
            question: info[0],
            resolutionTime: info[1],
            creator: info[2],
            oracle: info[3],
            resolved: info[4],
            outcome: info[5],
            totalYes: info[6],
            totalNo: info[7],
          };
          marketData.push(m);
          if (i === latestId) latestMarket = m;
        }

        const agentData: Agent[] = [];
        for (const id of AGENT_IDS) {
          await sleep(150);
          const score = await readWithRetry(() =>
            publicClient.readContract({
              address: AGENT_MARKET_ADDRESS,
              abi: AGENT_MARKET_ABI,
              functionName: "agentScore",
              args: [BigInt(id)],
            })
          );
          await sleep(150);
          const owner = await readWithRetry(() =>
            publicClient
              .readContract({
                address: IDENTITY_REGISTRY,
                abi: IDENTITY_REGISTRY_ABI,
                functionName: "ownerOf",
                args: [BigInt(id)],
              })
              .catch(() => "0x")
          );
          agentData.push({ id, owner, score });
        }
        setAgents(agentData);
      } else {
        setAgents(AGENT_IDS.map((id) => ({ id, owner: "0x", score: 0n })));
      }
      setMarkets(marketData);
      setMarket(latestMarket);

      await sleep(150);
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

  const stats = [
    { label: "Markets", value: marketCount !== null ? marketCount.toString() : "—", accent: statsAccent[0] },
    { label: "Total Pool", value: market ? formatMON(totalPool) : "—", accent: statsAccent[1] },
    { label: "Active Agents", value: agents.filter((a) => a.owner !== "0x").length.toString(), accent: statsAccent[2] },
    { label: "Block", value: blockNumber !== null ? blockNumber.toString() : "—", accent: statsAccent[3] },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-50">
      {/* Dashboard header */}
      <header className="border-b-4 border-black bg-[#111] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 border-4 border-black bg-yellow-400 flex items-center justify-center shadow-[4px_4px_0px_0px_#fff]">
              <span className="text-black font-black text-lg">MW</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-white tracking-tight">MONOWIRE</h1>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">AgentBet Dashboard</p>
            </div>
          </div>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="border-4 border-black bg-[#1a1a1a] px-4 py-2 shadow-[3px_3px_0px_0px_#000]">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-wider">
                {market
                  ? `Latest: Market #${market.id.toString()} · ${market.resolved ? "Resolved" : "Open"}`
                  : "Loading latest market…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 border-4 border-black bg-lime-400 px-3 py-1.5 shadow-[3px_3px_0px_0px_#fff]">
              <span className="w-2 h-2 bg-black rounded-full animate-pulse" />
              <span className="text-xs font-black text-black">
                {blockNumber !== null ? `BLOCK ${blockNumber.toString()}` : "LOADING"}
              </span>
            </div>
            <Link
              href="/rent"
              className="border-4 border-black bg-pink-400 px-4 py-2 text-sm font-black text-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              RENT AGENT
            </Link>
            <button
              disabled
              className="border-4 border-black bg-violet-400 px-4 py-2 text-sm font-black text-black shadow-[4px_4px_0px_0px_#000] opacity-80 cursor-not-allowed"
              title="Create market via the live demo script"
            >
              + NEW MARKET
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Error */}
        {error && (
          <div className={`${neoCard} p-4 flex items-start justify-between gap-4`}>
            <div className="space-y-1">
              <p className="font-black text-white uppercase">COULD NOT LOAD DATA</p>
              <p className="text-sm font-bold text-zinc-400">{error}</p>
            </div>
            <button onClick={load} className={`${neoButton} px-4 py-2 text-sm uppercase`}>
              Retry
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`${neoCard} p-4 ${stat.accent} hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all`}
            >
              <p className="text-xs font-black text-black uppercase tracking-wider mb-2">{stat.label}</p>
              <p className="text-2xl sm:text-3xl font-black text-black truncate">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && !market && !error && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[6px_6px_0px_0px_#000]" />
            <div className="h-80 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[6px_6px_0px_0px_#000]" />
          </div>
        )}

        {/* Main dashboard grid */}
        {!loading && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Market card */}
            <div className={`${neoCard} lg:col-span-2 p-6 sm:p-8`}>
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Active Market #{market ? market.id.toString() : "—"}
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight uppercase">
                    {market ? market.question : "No active market"}
                  </h2>
                </div>
                {market && (
                  <span
                    className={`${neoBadge(
                      market.resolved ? "bg-emerald-400" : "bg-amber-400"
                    )} shrink-0`}
                  >
                    {market.resolved ? "Resolved" : "Open"}
                  </span>
                )}
              </div>

              {market && (
                <>
                  <div className="space-y-5 mb-8">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-black">
                        <span className="text-emerald-400 uppercase">YES {yesShare.toFixed(1)}%</span>
                        <span className="text-white">{formatMON(market.totalYes)}</span>
                      </div>
                      <div className="h-6 border-4 border-black bg-[#0a0a0a] overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-500"
                          style={{ width: `${yesShare}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-black">
                        <span className="text-rose-400 uppercase">NO {noShare.toFixed(1)}%</span>
                        <span className="text-white">{formatMON(market.totalNo)}</span>
                      </div>
                      <div className="h-6 border-4 border-black bg-[#0a0a0a] overflow-hidden">
                        <div
                          className="h-full bg-rose-400 transition-all duration-500"
                          style={{ width: `${noShare}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t-4 border-zinc-800 pt-6">
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Total Pool</p>
                      <p className="font-black text-white text-lg">{formatMON(totalPool)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Resolution</p>
                      <p className="font-black text-zinc-300 text-sm">
                        {new Date(Number(market.resolutionTime) * 1000).toLocaleString()}
                      </p>
                    </div>
                    {market.resolved && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Outcome</p>
                        <p className={`font-black text-lg ${market.outcome === 1 ? "text-emerald-400" : "text-rose-400"}`}>
                          {market.outcome === 1 ? "YES" : "NO"}
                        </p>
                      </div>
                    )}
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Oracle</p>
                      <p className="font-mono font-black text-zinc-300">{truncate(market.oracle)}</p>
                    </div>
                  </div>
                </>
              )}

              {!market && !error && (
                <div className="text-center py-12">
                  <p className="font-black text-white text-xl uppercase">NO MARKETS YET</p>
                  <p className="text-zinc-500 font-bold mt-2">Create the first market to start trading.</p>
                </div>
              )}
            </div>

            {/* Leaderboard */}
            <div className={`${neoCard} p-6`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Leaderboard</h3>
                <span className="text-[10px] font-black text-zinc-500 uppercase">Reputation</span>
              </div>
              <div className="space-y-4">
                {loading && agents.length === 0 && !error && (
                  <>
                    <div className="h-20 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[4px_4px_0px_0px_#000]" />
                    <div className="h-20 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[4px_4px_0px_0px_#000]" />
                    <div className="h-20 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[4px_4px_0px_0px_#000]" />
                  </>
                )}
                {sortedAgents.map((agent, index) => {
                  const positive = agent.score >= 0n;
                  const accent = agentAccent[index % agentAccent.length];
                  return (
                    <div
                      key={agent.id}
                      className="flex items-center gap-4 border-4 border-black bg-[#1a1a1a] p-3 shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                    >
                      <div className="flex items-center justify-center w-9 h-9 border-4 border-black bg-white text-black font-black shadow-[2px_2px_0px_0px_#000]">
                        {index + 1}
                      </div>
                      <div className={`w-11 h-11 border-4 border-black ${accent} flex items-center justify-center shadow-[2px_2px_0px_0px_#000]`}>
                        <span className="text-xs font-black text-black">A{agent.id}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-white text-sm">Agent #{agent.id}</p>
                        <p className="text-[10px] font-black text-zinc-500 font-mono truncate">
                          {agent.owner === "0x" ? "UNREGISTERED" : truncate(agent.owner)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-zinc-500 uppercase">Score</p>
                        <p className={`text-xl font-black ${positive ? "text-emerald-400" : "text-rose-400"}`}>
                          {agent.score.toString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Past Markets */}
        {!loading && markets.length > 0 && (
          <div className={`${neoCard} p-6 space-y-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">All Markets</h3>
              <span className="text-[10px] font-black text-zinc-500 uppercase">{markets.length} total</span>
            </div>
            <div className="space-y-3">
              {markets.map((m) => {
                const total = m.totalYes + m.totalNo;
                const yesPct = total > 0n ? Number((m.totalYes * 10000n) / total) / 100 : 50;
                return (
                  <div
                    key={m.id.toString()}
                    className="border-4 border-black bg-[#1a1a1a] p-4 shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                          Market #{m.id.toString()}
                        </p>
                        <p className="font-black text-white text-sm sm:text-base truncate">{m.question}</p>
                      </div>
                      <span
                        className={`${neoBadge(
                          m.resolved ? "bg-emerald-400" : "bg-amber-400"
                        )} shrink-0`}
                      >
                        {m.resolved ? "Resolved" : "Open"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex-1">
                        <div className="h-4 border-4 border-black bg-[#0a0a0a] overflow-hidden">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${yesPct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <p className="font-black text-white">{formatMON(total)}</p>
                        <p className="text-[10px] font-black text-zinc-500">
                          {m.resolved ? (m.outcome === 1 ? "YES" : "NO") : "Open"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contract footer bar */}
        <div className={`${neoCard} p-4 flex flex-col sm:flex-row items-center justify-between gap-4`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-4 border-black bg-yellow-400 flex items-center justify-center shadow-[3px_3px_0px_0px_#fff]">
              <span className="text-black font-black text-xs">SC</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">AgentMarket Contract</p>
              <p className="font-mono font-black text-white text-sm">{truncate(AGENT_MARKET_ADDRESS)}</p>
            </div>
          </div>
          <a
            href={`https://monad-testnet.socialscan.io/address/${AGENT_MARKET_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${neoButton} px-5 py-2 text-sm uppercase`}
          >
            VIEW ON EXPLORER
          </a>
        </div>

        {/* Footer */}
        <footer className="border-t-4 border-black pt-8 text-center">
          <p className="font-black text-sm text-zinc-500">
            POWERED BY{" "}
            <a
              href="https://www.monad.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0a0a] rounded-none"
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
