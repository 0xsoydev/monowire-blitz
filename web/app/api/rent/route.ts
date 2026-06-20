import { NextResponse, type NextRequest } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";

const MONAD_NETWORK: Network = "eip155:10143";
const MONAD_USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const FACILITATOR_URL = "https://x402-facilitator.molandak.org";

const PAY_TO = process.env.NEXT_PUBLIC_PAY_TO_ADDRESS;
if (!PAY_TO) {
  throw new Error("NEXT_PUBLIC_PAY_TO_ADDRESS environment variable is required");
}

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const server = new x402ResourceServer(facilitatorClient);

const monadScheme = new ExactEvmScheme();
monadScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === MONAD_NETWORK) {
    const tokenAmount = Math.floor(amount * 1_000_000).toString();
    return {
      amount: tokenAmount,
      asset: MONAD_USDC_TESTNET,
      extra: {
        name: "USDC",
        version: "2",
      },
    };
  }
  return null;
});

server.register(MONAD_NETWORK, monadScheme);

const routeConfig: RouteConfig = {
  accepts: {
    scheme: "exact",
    network: MONAD_NETWORK,
    payTo: PAY_TO as `0x${string}`,
    price: "$0.001",
  },
  resource: "https://preda-pi.vercel.app/api/rent",
};

async function handler(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get("agentId");
  const now = new Date().toISOString();

  return NextResponse.json({
    rented: true,
    agentId: agentId ?? "unknown",
    unlockedAt: now,
    validUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    message: `Agent ${agentId} rented for 1 hour.`,
  });
}

export const GET = withX402(handler, routeConfig, server);
