import { NextResponse, type NextRequest } from "next/server";
import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";
import { monadTestnet } from "@/lib/contracts";

const MONAD_USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";

const KEYSTORE_FILE = "e803ff23-8173-4f8d-a5b9-dde7ee76159f";

function getPrivateKey(): `0x${string}` {
  const { execSync } = require("child_process");
  const result = execSync(
    `cast wallet decrypt-keystore --keystore-dir ~/.monskills/keystore ${KEYSTORE_FILE} --unsafe-password "" | awk '{print $NF}'`,
    { encoding: "utf-8" }
  );
  return result.trim() as `0x${string}`;
}

function createAgentWalletClient(): WalletClient {
  const privateKey = getPrivateKey();
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(),
  });
}

export async function GET(request: NextRequest) {
  try {
    const renterId = request.nextUrl.searchParams.get("renter");
    const renteeId = request.nextUrl.searchParams.get("rentee");

    if (!renterId || !renteeId) {
      return NextResponse.json({ error: "renter and rentee agent IDs required" }, { status: 400 });
    }

    const walletClient = createAgentWalletClient();
    const address = walletClient.account?.address;
    if (!address) {
      return NextResponse.json({ error: "Could not load agent wallet" }, { status: 500 });
    }

    const evmSigner = {
      address,
      signTypedData: async (message: {
        domain: Record<string, unknown>;
        types: Record<string, unknown>;
        primaryType: string;
        message: Record<string, unknown>;
      }) => {
        return walletClient.signTypedData({
          account: address,
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

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const response = await paymentFetch(`${baseUrl}/api/rent?agentId=${renteeId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json({ error: text || `Payment failed: ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json({
      ...data,
      renterId,
      renteeId,
      paidBy: address,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent rental failed" },
      { status: 500 }
    );
  }
}
