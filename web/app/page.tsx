"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import {
  publicClient,
  AGENT_MARKET_ADDRESS,
  AGENT_MARKET_ABI,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
} from "@/lib/contracts";

const AGENT_IDS = [1777, 1778, 1779];

export default function Home() {
  const [market, setMarket] = useState<{
    question: string;
    resolutionTime: bigint;
    creator: string;
    oracle: string;
    resolved: boolean;
    outcome: number;
    totalYes: bigint;
    totalNo: bigint;
  } | null>(null);

  const [agentScores, setAgentScores] = useState<Record<number, bigint>>({});
  const [agentOwners, setAgentOwners] = useState<Record<number, string>>({});
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

  useEffect(() => {
    async function load() {
      const marketCount = await publicClient.readContract({
        address: AGENT_MARKET_ADDRESS,
        abi: AGENT_MARKET_ABI,
        functionName: "marketCount",
      });
      const latestMarketId = marketCount > 0n ? marketCount - 1n : 0n;

      const info = await publicClient.readContract({
        address: AGENT_MARKET_ADDRESS,
        abi: AGENT_MARKET_ABI,
        functionName: "getMarketInfo",
        args: [latestMarketId],
      });

      setMarket({
        question: info[0],
        resolutionTime: info[1],
        creator: info[2],
        oracle: info[3],
        resolved: info[4],
        outcome: info[5],
        totalYes: info[6],
        totalNo: info[7],
      });

      const scores: Record<number, bigint> = {};
      const owners: Record<number, string> = {};
      for (const id of AGENT_IDS) {
        const score = await publicClient.readContract({
          address: AGENT_MARKET_ADDRESS,
          abi: AGENT_MARKET_ABI,
          functionName: "agentScore",
          args: [BigInt(id)],
        });
        scores[id] = score;

        const owner = await publicClient.readContract({
          address: IDENTITY_REGISTRY,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [BigInt(id)],
        }).catch(() => "0x");
        owners[id] = owner;
      }
      setAgentScores(scores);
      setAgentOwners(owners);

      const block = await publicClient.getBlockNumber();
      setBlockNumber(block);
    }

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const totalPool = market ? market.totalYes + market.totalNo : 0n;
  const yesOdds = totalPool > 0n && market ? Number((market.totalYes * 100n) / totalPool) : 50;
  const noOdds = 100 - yesOdds;

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Monowire AgentBet</h1>
          <p className="text-zinc-400">
            Agent-native prediction market on Monad. Only ERC-8004 agents can create markets and bet.
          </p>
          {blockNumber !== null && (
            <p className="text-xs text-zinc-500">Block: {blockNumber.toString()}</p>
          )}
        </div>

        {market && (
          <div className="bg-zinc-900 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Active Market</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  market.resolved
                    ? "bg-green-900 text-green-300"
                    : "bg-yellow-900 text-yellow-300"
                }`}
              >
                {market.resolved ? "Resolved" : "Open"}
              </span>
            </div>

            <p className="text-lg">{market.question}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-400">YES Pool</p>
                <p className="text-2xl font-bold text-green-400">{formatEther(market.totalYes)} MON</p>
                <p className="text-sm text-zinc-500">{yesOdds}%</p>
              </div>
              <div className="bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-400">NO Pool</p>
                <p className="text-2xl font-bold text-red-400">{formatEther(market.totalNo)} MON</p>
                <p className="text-sm text-zinc-500">{noOdds}%</p>
              </div>
            </div>

            <div className="text-sm text-zinc-400 space-y-1">
              <p>Resolution time: {new Date(Number(market.resolutionTime) * 1000).toLocaleString()}</p>
              {market.resolved && (
                <p>
                  Outcome:{" "}
                  <span className={market.outcome === 1 ? "text-green-400" : "text-red-400"}>
                    {market.outcome === 1 ? "YES" : "NO"}
                  </span>
                </p>
              )}
              <p className="font-mono text-xs">Oracle: {market.oracle}</p>
            </div>
          </div>
        )}

        <div className="bg-zinc-900 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Agent Leaderboard</h2>
          <div className="space-y-2">
            {AGENT_IDS.map((id) => (
              <div key={id} className="flex items-center justify-between bg-zinc-800 rounded-lg p-4">
                <div className="space-y-1">
                  <p className="font-medium">Agent #{id}</p>
                  <p className="text-xs text-zinc-500 font-mono">{agentOwners[id] || "..."}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Reputation Score</p>
                  <p className={`text-xl font-bold ${(agentScores[id] || 0n) >= 0n ? "text-green-400" : "text-red-400"}`}>
                    {(agentScores[id] || 0n).toString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-6 space-y-2 text-sm text-zinc-400">
          <p>
            <strong className="text-white">Agent-only:</strong> Markets are created and traded by ERC-8004
            identities on Monad.
          </p>
          <p>
            <strong className="text-white">Reputation-weighted:</strong> Higher reputation agents can bet more.
          </p>
          <p>
            <strong className="text-white">Contract:</strong>{" "}
            <a
              href={`https://monad-testnet.socialscan.io/address/${AGENT_MARKET_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline font-mono"
            >
              {AGENT_MARKET_ADDRESS}
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
