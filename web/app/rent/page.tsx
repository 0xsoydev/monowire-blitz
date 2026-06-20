"use client";

import { useEffect, useState, useCallback } from "react";
import { formatEther } from "viem";
import { createWalletClient, custom } from "viem";
import Link from "next/link";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";
import {
  publicClient,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
  monadTestnet,
} from "@/lib/contracts";

const AGENT_IDS = [1777, 1778, 1779];
const POLL_INTERVAL_MS = 20_000;
const RPC_RETRY_DELAY_MS = 800;

const MONAD_USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";

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
const neoBadge = (color: string) => `border-4 border-black px-3 py-1 font-black text-xs shadow-[3px_3px_0px_0px_#000] uppercase ${color}`;

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

function truncate(addr: string) {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export default function RentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [rented, setRented] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

  const load = useCallback(async () => {
    try {
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

      const block = await readWithRetry(() => publicClient.getBlockNumber());
      setBlockNumber(block);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const connectWallet = async () => {
    try {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No wallet found. Install MetaMask or another EVM wallet.");
      }
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom((window as any).ethereum),
      });
      const [address] = await walletClient.requestAddresses();
      setWalletAddress(address);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  };

  const handleRent = async (agent: Agent) => {
    setSelectedAgent(agent);
    setPaying(true);
    setPayError(null);
    setRented(false);

    try {
      if (!walletAddress) {
        throw new Error("Connect your wallet first");
      }
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No wallet found");
      }

      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom((window as any).ethereum),
      });

      const evmSigner = {
        address: walletAddress as `0x${string}`,
        signTypedData: async (message: {
          domain: Record<string, unknown>;
          types: Record<string, unknown>;
          primaryType: string;
          message: Record<string, unknown>;
        }) => {
          return walletClient.signTypedData({
            account: walletAddress as `0x${string}`,
            domain: message.domain as any,
            types: message.types as any,
            primaryType: message.primaryType,
            message: message.message as any,
          });
        },
      };

      const exactScheme = new ExactEvmScheme(evmSigner);
      const client = new x402Client().register("eip155:10143", exactScheme);
      const paymentFetch = wrapFetchWithPayment(fetch, client);

      const response = await paymentFetch(`/api/rent?agentId=${agent.id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Payment failed: ${response.status}`);
      }

      const data = await response.json();
      if (data.rented) {
        setRented(true);
      } else {
        throw new Error("Rental not confirmed");
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const sortedAgents = [...agents].sort((a, b) => b.winRate - a.winRate);

  const stats = [
    { label: "Agents", value: agents.length.toString(), accent: statsAccent[0] },
    { label: "Avg Win Rate", value: agents.length ? `${Math.round(agents.reduce((a, b) => a + b.winRate, 0) / agents.length)}%` : "—", accent: statsAccent[1] },
    { label: "Best Agent", value: sortedAgents[0] ? `#${sortedAgents[0].id}` : "—", accent: statsAccent[2] },
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
                x402 · Monad Testnet · USDC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {walletAddress ? (
              <div className="border-4 border-black bg-lime-400 px-3 py-1.5 shadow-[3px_3px_0px_0px_#fff]">
                <span className="text-xs font-black text-black">{truncate(walletAddress)}</span>
              </div>
            ) : (
              <button onClick={connectWallet} className={`${neoButton} px-4 py-2 text-sm uppercase`}>
                CONNECT WALLET
              </button>
            )}
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
            <span className="font-black text-black text-sm tracking-widest">X402 · RENT · PROFIT</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight uppercase leading-none">
            Rent a winning agent.
          </h2>
          <p className="text-zinc-400 text-base sm:text-lg font-medium leading-relaxed">
            Lease an ERC-8004 prediction agent. Pay USDC via x402. Keep the upside when it wins.
          </p>
        </section>

        {/* Error */}
        {error && (
          <div className={`${neoCard} p-4 flex items-start justify-between gap-4`}>
            <div className="space-y-1">
              <p className="font-black text-white uppercase">COULD NOT LOAD AGENTS</p>
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
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-96 border-4 border-black bg-[#1a1a1a] animate-pulse shadow-[6px_6px_0px_0px_#000]" />
            ))}
          </div>
        )}

        {/* Agent grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedAgents.map((agent, index) => {
            const accent = agentAccent[index % agentAccent.length];
            const chartColor = agent.score >= 0n ? "#34d399" : "#fb7185";
            const profitable = agent.score >= 0n;
            return (
              <div key={agent.id} className={`${neoCard} p-5 flex flex-col gap-5`}>
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
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-1">Score</p>
                    <p className={`text-2xl font-black ${profitable ? "text-emerald-400" : "text-rose-400"}`}>
                      {agent.score.toString()}
                    </p>
                  </div>
                </div>

                <div className="border-4 border-black bg-[#1a1a1a] p-3">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mb-2">Trade History</p>
                  <LineChart data={agent.history} color={chartColor} />
                </div>

                <div className="flex items-center justify-between border-t-4 border-zinc-800 pt-4 mt-auto">
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Rent Price</p>
                    <p className="text-xl font-black text-white">{agent.price} USDC</p>
                  </div>
                  <button
                    onClick={() => handleRent(agent)}
                    disabled={paying}
                    className={`${neoButton} px-5 py-2.5 text-sm uppercase ${paying ? "opacity-75 cursor-wait" : ""}`}
                  >
                    RENT
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Payment Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className={`${neoCard} w-full max-w-md p-6 relative`}>
            <button
              onClick={() => setSelectedAgent(null)}
              className="absolute top-3 right-3 w-8 h-8 border-4 border-black bg-rose-400 text-black font-black flex items-center justify-center shadow-[2px_2px_0px_0px_#fff]"
            >
              ×
            </button>

            {rented ? (
              <div className="text-center space-y-4">
                <div className="border-4 border-black bg-emerald-400 p-4">
                  <p className="font-black text-black text-lg uppercase">AGENT RENTED</p>
                  <p className="text-sm font-black text-black mt-1">Agent #{selectedAgent.id} is unlocked for 1 hour.</p>
                </div>
                <button onClick={() => setSelectedAgent(null)} className={`${neoButton} w-full py-3 text-lg uppercase`}>
                  CLOSE
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-black text-white uppercase mb-4">Rent Agent #{selectedAgent.id}</h3>

                <div className="space-y-4 mb-6">
                  <div className="border-4 border-black bg-[#1a1a1a] p-3">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">x402 Payment Request</p>
                    <p className="text-sm font-bold text-zinc-300">
                      Pay {selectedAgent.price} USDC on Monad Testnet to rent Agent {selectedAgent.id} for 1 hour.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border-4 border-black bg-[#1a1a1a] p-3">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Amount</p>
                      <p className="font-black text-white text-lg">{selectedAgent.price} USDC</p>
                    </div>
                    <div className="border-4 border-black bg-[#1a1a1a] p-3">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Win Rate</p>
                      <p className="font-black text-emerald-400 text-lg">{selectedAgent.winRate}%</p>
                    </div>
                  </div>
                </div>

                {!walletAddress && (
                  <div className="border-4 border-black bg-amber-400 p-3 mb-4">
                    <p className="text-sm font-black text-black">Connect your wallet first to sign the x402 payment.</p>
                  </div>
                )}

                {payError && (
                  <div className="border-4 border-black bg-rose-950 p-3 mb-4">
                    <p className="text-sm font-black text-rose-200">{payError}</p>
                  </div>
                )}

                <button
                  onClick={() => handleRent(selectedAgent)}
                  disabled={paying || !walletAddress}
                  className={`${neoButton} w-full py-3 text-lg uppercase ${paying || !walletAddress ? "opacity-75 cursor-not-allowed" : ""}`}
                >
                  {paying ? "PROCESSING X402…" : "PAY WITH X402"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
