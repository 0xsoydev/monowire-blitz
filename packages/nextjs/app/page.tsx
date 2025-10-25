"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";

const Home: NextPage = () => {
  const { address } = useAccount();

  return (
    <div className="container mx-auto p-8">
      <div className="hero min-h-[60vh]">
        <div className="hero-content text-center">
          <div className="max-w-2xl">
            <h1 className="text-6xl font-bold mb-6">MonadPay</h1>
            <p className="text-2xl mb-4 opacity-80">Accept payments from any chain, in any token</p>
            <p className="text-lg mb-8 opacity-60">
              The DeFi-native payment gateway. AI-powered invoicing, automatic splits, cross-chain settlements.
            </p>

            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/create" className="btn btn-primary btn-lg">
                Create Invoice
              </Link>
              <Link href="/cross-chain" className="btn btn-accent btn-lg">
                🌉 Cross-Chain Payment
              </Link>
              {address && (
                <Link href="/dashboard" className="btn btn-secondary btn-lg">
                  Dashboard
                </Link>
              )}
              <Link href="/debug" className="btn btn-outline btn-lg">
                Debug Contracts
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-xl">🤖 AI-Powered</h3>
                  <p className="text-sm">Generate invoices from natural language</p>
                </div>
              </div>
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-xl">💰 Any Token</h3>
                  <p className="text-sm">Accept payments in any token with auto-swap</p>
                </div>
              </div>
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-xl">🌐 Cross-Chain</h3>
                  <p className="text-sm">Pay from Ethereum, receive on Monad</p>
                </div>
              </div>
            </div>

            <div className="mt-12 text-left bg-base-200 p-6 rounded-lg">
              <h3 className="font-bold text-lg mb-3">✨ Features:</h3>
              <ul className="space-y-2 text-sm opacity-80">
                <li>✅ AI-powered invoice generation with Groq Llama</li>
                <li>✅ Automatic payment splits to multiple recipients</li>
                <li>✅ QR code payment links</li>
                <li>✅ Real-time dashboard</li>
                <li>✅ Pay with any token (Kuru DEX integration)</li>
                <li>✅ Cross-chain payments (Real bridge integration)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
