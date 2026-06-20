"use client";

import { useEffect, useState, useCallback } from "react";
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
  winRate: number;
  price: string;
  history: number[];
}

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
const neoButtonOutline = "border-4 border-black bg-transparent hover:bg-zinc-800 text-white font-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";
const neoButtonSmall = (color: string) =>
  `border-4 border-black ${color} hover:brightness-110 text-black font-black shadow-[3px_3px_0px_0px_#000] hover:shadow-[1px_1px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all`;
const neoBadge = (color: string) => `border-4 border-black px-3 py-1 font-black text-xs shadow-[3px_3px_0px_0px_#000] uppercase ${color}`;
const neoSelect = "border-4 border-black bg-[#1a1a1a] text-white font-black px-3 py-2 shadow-[3px_3px_0px_0px_#000] focus:outline-none focus:ring-4 focus:ring-violet-400 focus:ring-offset-4 focus:ring-offset-[#0a0a0a]";

const agentAccent = ["bg-pink-400", "bg-cyan-400", "bg-lime-400"];
const statsAccent = ["bg-yellow-400", "bg-pink-400", "bg-cyan-400", "bg-lime-400"];

function generateHistory(score: bigint): number[] {
  const points = 14;
  const end = Number(score);
  const history: number[] = [];
  let current = 0;
  for (let i = 0; i < points; i++) {
    const step = (end - current) / (points - i);
    current += step + (Math.random() - 0.5) * 4;
    history.push(Math.round(current));
  }
  history[points - 1] = end;
  return history;
}

function winRateFromScore(score: bigint): number {
  const s = Number(score);
  const base = 50 + s * 1.5;
  return Math.max(5, Math.min(95, Math.round(base)));
}

function LineChart({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 280;
  const height = 80;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => {
    const x = i * stepX;
    const y = height - ((val - min) / range) * (height - 16) - 8;
    return `${x},${y}`;
  });

  const areaPoints = `${points[0]} ${points.slice(1).join(" ")} ${width},${height} 0,${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color})`} stroke="none" />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
      {data.map((val, i) => {
        const x = i * stepX;
        const y = height - ((val - min) / range) * (height - 16) - 8;
        return <circle key={i} cx={x} cy={y} r="4" fill="#000" stroke={color} strokeWidth="2" />;
      })}
    </svg>
  );
}

export default function RentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renterAgentId, setRenterAgentId] = useState<number>(AGENT_IDS[0]);
  const [renteeAgentId, setRenteeAgentId] = useState<number | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<"yes" | "no">("yes");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

  const load = useCallback(async () => {
    try {
      // Load agents
      const agentData: Agent[] = [];
      for (const id of AGENT_IDS) {
        await sleep(id === AGENT_IDS[0] ? 0 : 150);
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
        const winRate = winRateFromScore(score);
        const price = (0.001 + Math.abs(Number(score)) * 0.00005).toFixed(3);
        agentData.push({ id, owner, score, winRate, price, history: generateHistory(score) });
      }
      setAgents(agentData);

      // Load all markets
      await sleep(150);
      const count = await readWithRetry(() =>
        publicClient.readContract({
          address: AGENT_MARKET_ADDRESS,
          abi: AGENT_MARKET_ABI,
          functionName: "marketCount",
        })
      );
      const marketData: Market[] = [];
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
        marketData.push({
          id: i,
          question: info[0],
          resolutionTime: info[1],
          creator: info[2],
          oracle: info[3],
          resolved: info[4],
          outcome: info[5],
          totalYes: info[6],
          totalNo: info[7],
        });
      }
      setMarkets(marketData);
      if (marketData.length > 0 && selectedMarketId === "") {
        setSelectedMarketId(marketData[marketData.length - 1].id.toString());
      }

      const block = await readWithRetry(() => publicClient.getBlockNumber());
      setBlockNumber(block);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedMarketId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const randomMarket = () => {
    const openMarkets = markets.filter((m) => !m.resolved);
    const pool = openMarkets.length > 0 ? openMarkets : markets;
    if (pool.length === 0) return;
    const random = pool[Math.floor(Math.random() * pool.length)];
    setSelectedMarketId(random.id.toString());
  };

  const handleRent = async () => {
    if (!renteeAgentId) {
      setPayError("Select an agent to rent");
      return;
    }
    if (!selectedMarketId) {
      setPayError("Select a market to bet on");
      return;
    }

    setPaying(true);
    setPayError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/rent-agent?renter=${renterAgentId}&rentee=${renteeAgentId}&marketId=${selectedMarketId}&side=${selectedSide}`,
        { method: "GET", headers: { "Content-Type": "application/json" } }
      );
      const data = await response.json().catch(() => ({ error: "Invalid response" }));

      if (!response.ok) {
        throw new Error(data.error || `Rental failed: ${response.status}`);
      }

      setResult(data);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Rental failed");
    } finally {
      setPaying(false);
    }
  };

  const sortedAgents = [...agents].sort((a, b) => b.winRate - a.winRate);
  const openMarkets = markets.filter((m) => !m.resolved);

  const stats = [
    { label: "Agents", value: agents.length.toString(), accent: statsAccent[0] },
    { label: "Markets", value: markets.length.toString(), accent: statsAccent[1] },
    { label: "Open", value: openMarkets.length.toString(), accent: statsAccent[2] },
    { label: "Block", value: blockNumber !== null ? blockNumber.toString() : "—", accent: statsAccent[3] },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-50">
      {/* Header */}
      <header className="border-b-4 border-black bg-[#111] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0a0a] rounded-none">
            <div className="w-12 h-12 border-4 border-black bg-yellow-400 flex items-center justify-center shadow-[4px_4px_0px_0px_#fff]">
              <span className="text-black font-black text-lg">MW</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-white tracking-tight">MONOWIRE</h1>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">AgentBet Dashboard</p>
            </div>
          </Link>

          <div className="flex-1 max-w-md hidden md:block">
            <div className="border-4 border-black bg-[#1a1a1a] px-4 py-2 shadow-[3px_3px_0px_0px_#000]">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-wider">
                x402 · Agent-to-Agent · Rent & Bet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className={`${neoButtonOutline} px-4 py-2 text-sm uppercase`}>
              BACK TO MARKETS
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-block border-4 border-black bg-violet-400 px-4 py-2 shadow-[5px_5px_0px_0px_#fff]">
            <span className="font-black text-black text-sm tracking-widest">X402 · RENT · BET</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight uppercase leading-none">
            Rent an agent. Pick a market. Bet.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg font-medium leading-relaxed">
            Your agent pays another agent via x402. The rented agent then places a bet on your chosen market.
          </p>
        </section>

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

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`${neoCard} p-4 ${stat.accent} hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all`}>
              <p className="text-xs font-black text-black uppercase tracking-wider mb-2">{stat.label}</p>
              <p className="text-2xl sm:text-3xl font-black text-black truncate">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Loading */}
        {loading && agents.length === 0 && !error && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="h-96 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[6px_6px_0px_0px_#000]" />
            <div className="h-96 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[6px_6px_0px_0px_#000]" />
          </div>
        )}

        {!loading && (
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* Control panel */}
            <div className={`${neoCard} p-6 space-y-6`}>
              <h3 className="text-2xl font-black text-white uppercase">Build Your Bet</h3>

              {/* Renter selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-wider">1. Your Agent (Payer)</label>
                <select
                  value={renterAgentId}
                  onChange={(e) => setRenterAgentId(Number(e.target.value))}
                  className={`${neoSelect} w-full`}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id} className="bg-[#1a1a1a]">
                      Agent #{agent.id} — Score {agent.score.toString()} — Win {agent.winRate}%
                    </option>
                  ))}
                </select>
              </div>

              {/* Market selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-wider">3. Market to Bet On</label>
                <div className="flex gap-2">
                  <select
                    value={selectedMarketId}
                    onChange={(e) => setSelectedMarketId(e.target.value)}
                    className={`${neoSelect} w-full`}
                  >
                    {markets.length === 0 && (
                      <option value="" className="bg-[#1a1a1a]">No markets</option>
                    )}
                    {markets.map((market) => (
                      <option key={market.id.toString()} value={market.id.toString()} className="bg-[#1a1a1a]">
                        Market #{market.id.toString()}: {market.question.slice(0, 50)}
                        {market.question.length > 50 ? "…" : ""} {market.resolved ? "(Resolved)" : "(Open)"}
                      </option>
                    ))}
                  </select>
                  <button onClick={randomMarket} className={`${neoButtonSmall("bg-amber-400")} px-3 py-2 text-sm uppercase whitespace-nowrap`}>
                    RANDOM
                  </button>
                </div>
              </div>

              {/* Side selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-wider">4. Bet Side</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedSide("yes")}
                    className={`border-4 border-black py-3 font-black text-lg uppercase transition-all ${
                      selectedSide === "yes" ? "bg-emerald-400 text-black shadow-[4px_4px_0px_0px_#fff]" : "bg-[#1a1a1a] text-zinc-400"
                    }`}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setSelectedSide("no")}
                    className={`border-4 border-black py-3 font-black text-lg uppercase transition-all ${
                      selectedSide === "no" ? "bg-rose-400 text-black shadow-[4px_4px_0px_0px_#fff]" : "bg-[#1a1a1a] text-zinc-400"
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>

              {/* Pay button */}
              {payError && (
                <div className="border-4 border-black bg-rose-950 p-3">
                  <p className="text-sm font-black text-rose-200">{payError}</p>
                </div>
              )}

              {result ? (
                <div className="border-4 border-black bg-emerald-400 p-4 space-y-2">
                  <p className="font-black text-black text-lg uppercase">BET PLACED</p>
                  <p className="text-sm font-black text-black">
                    Agent #{result.renteeId} bet {result.side} on Market #{result.marketId}
                  </p>
                  <p className="text-xs font-black text-black font-mono break-all">Tx: {result.betTxHash}</p>
                </div>
              ) : (
                <button
                  onClick={handleRent}
                  disabled={paying || !renteeAgentId || !selectedMarketId}
                  className={`${neoButton} w-full py-4 text-lg uppercase ${paying || !renteeAgentId || !selectedMarketId ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  {paying ? "RENTING & BETTING…" : "RENT AGENT & PLACE BET"}
                </button>
              )}
            </div>

            {/* Agent selection */}
            <div className="space-y-4">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-wider">2. Select Agent to Rent</p>
              {sortedAgents.map((agent, index) => {
                const accent = agentAccent[index % agentAccent.length];
                const chartColor = agent.score >= 0n ? "#34d399" : "#fb7185";
                const profitable = agent.score >= 0n;
                const selected = renteeAgentId === agent.id;
                const isRenter = renterAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setRenteeAgentId(agent.id)}
                    className={`w-full text-left ${neoCard} p-4 flex flex-col gap-4 hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all ${selected ? "ring-4 ring-violet-400 ring-offset-4 ring-offset-[#0a0a0a]" : ""} ${isRenter ? "opacity-50" : ""}`}
                    disabled={isRenter}
                    title={isRenter ? "This is your payer agent" : ""}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 border-4 border-black ${accent} flex items-center justify-center shadow-[3px_3px_0px_0px_#fff]`}>
                        <span className="text-sm font-black text-black">A{agent.id}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-lg uppercase truncate">Agent #{agent.id}</p>
                        <p className="text-[10px] font-black text-zinc-500 font-mono truncate">
                          {agent.owner === "0x" ? "UNREGISTERED" : agent.owner}
                        </p>
                      </div>
                      <div className={`${neoBadge(profitable ? "bg-emerald-400" : "bg-rose-400")} text-black`}>
                        #{index + 1}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border-4 border-black bg-[#1a1a1a] p-3">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Win Rate</p>
                        <p className={`text-2xl font-black ${profitable ? "text-emerald-400" : "text-rose-400"}`}>
                          {agent.winRate}%
                        </p>
                      </div>
                      <div className="border-4 border-black bg-[#1a1a1a] p-3">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Rent Price</p>
                        <p className="text-xl font-black text-white">{agent.price} USDC</p>
                      </div>
                    </div>

                    <div className="border-4 border-black bg-[#1a1a1a] p-3">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-2">Trade History</p>
                      <LineChart data={agent.history} color={chartColor} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black pt-8 pb-10 text-center">
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
          {" "}· X402 · ERC-8004
        </p>
      </footer>
    </div>
  );
}
