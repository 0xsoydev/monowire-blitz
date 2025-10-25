"use client";

import { useState, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatUnits } from "viem";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useDeployedContractInfo,
} from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";
import { estimateMONForUSDC } from "~~/utils/kuru";

interface Split {
  recipient: string;
  basisPoints: bigint;
}

type PaymentMethod = "usdc" | "mon" | "other";

export default function PayInvoice({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [isPaying, setIsPaying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [invoiceId, setInvoiceId] = useState<`0x${string}` | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mon");
  const [monQuote, setMonQuote] = useState<bigint | null>(null);

  // Unwrap params in useEffect (Next.js 15 requirement)
  useEffect(() => {
    params.then(p => setInvoiceId(p.invoiceId as `0x${string}`));
  }, [params]);

  // Get MonadPay contract info
  const { data: monadPayContract } = useDeployedContractInfo("MonadPay");

  // Read invoice details
  const { data: invoiceData, isLoading: isLoadingInvoice } = useScaffoldReadContract({
    contractName: "MonadPay",
    functionName: "getInvoice",
    args: [invoiceId],
  });

  const { data: splitsData } = useScaffoldReadContract({
    contractName: "MonadPay",
    functionName: "getInvoiceSplits",
    args: [invoiceId],
  });

  const { writeContractAsync: payInvoice } = useScaffoldWriteContract("MonadPay");

  // USDC approval
  const { writeContractAsync: approveUSDC } = useScaffoldWriteContract("USDC");

  // Calculate MON quote when invoice data loads
  useEffect(() => {
    if (invoiceData && invoiceData[2]) {
      const usdcAmount = invoiceData[2];
      const estimatedMON = estimateMONForUSDC(usdcAmount);
      setMonQuote(estimatedMON);
    }
  }, [invoiceData]);

  async function handleApprove() {
    if (!invoiceData || !monadPayContract) return;

    setIsApproving(true);
    try {
      const amountToApprove = invoiceData[2]; // amount from getInvoice

      await approveUSDC({
        functionName: "approve",
        args: [monadPayContract.address, amountToApprove],
      });

      notification.success(`Approved ${formatUnits(amountToApprove, 6)} USDC! ✅`);
    } catch (error: any) {
      console.error("Approval error:", error);
      notification.error(error.message || "Failed to approve USDC");
    } finally {
      setIsApproving(false);
    }
  }

  async function handlePay() {
    if (!invoiceData) return;

    setIsPaying(true);
    try {
      await payInvoice({
        functionName: "payInvoice",
        args: [invoiceId],
      });

      notification.success("Payment successful! 🎉");
      // Refresh page to show updated status
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error("Payment error:", error);
      notification.error(error.message || "Failed to pay invoice");
    } finally {
      setIsPaying(false);
    }
  }

  async function handlePayWithMON() {
    if (!invoiceData || !monQuote || !walletClient || !publicClient || !monadPayContract || !userAddress) {
      notification.error("Wallet not connected or invoice data missing");
      return;
    }

    setIsPaying(true);
    
    try {
      // Kuru configuration (from actual Kuru.io network inspection)
      const KURU_RPC_URL = "https://rpc.kuru.io/swap";
      const KURU_ROUTER = "0x96eaC98928437496DdD0Cd2080E54Fe78BaC99b6";
      const NATIVE_MON = "0x0000000000000000000000000000000000000000";
      const USDC_ADDRESS = "0xf817257fed379853cde0fa4f97ab987181b1e5ea";
      
      // Step 1: Get swap quote from Kuru RPC
      notification.info("🔄 Step 1/4: Getting best swap route from Kuru...");
      
      const usdcAmount = invoiceData[2]; // Amount needed
      
      // Based on Kuru.io network inspection, they use this format:
      const swapRequest = {
        tokenIn: NATIVE_MON,
        tokenOut: USDC_ADDRESS,
        amount: monQuote.toString(), // MON amount in wei
        autoSlippage: true,
        slippageTolerance: 30,
      };
      
      console.log("🔍 Sending to Kuru:", swapRequest);
      
      const response = await fetch("/api/kuru-swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequest),
      });
      
      if (!response.ok) {
        throw new Error(`Kuru API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data?.data) {
        throw new Error("Failed to get swap quote from Kuru");
      }
      
      const swapData = result.data.data;
      notification.success(`✅ Route found! Output: ${formatUnits(BigInt(swapData.output), 6)} USDC`);
      
      // Step 2: Execute swap transaction
      notification.info("🔄 Step 2/4: Executing swap on Kuru...");
      
      const txHash = await walletClient.sendTransaction({
        to: swapData.transaction.to as `0x${string}`,
        data: swapData.transaction.calldata as `0x${string}`,
        value: BigInt(swapData.transaction.value),
        account: userAddress,
      });
      
      notification.info(`Swap TX: ${txHash.slice(0, 10)}...`);
      
      // Wait for swap to complete
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      notification.success("✅ Swap complete! Now approving USDC...");
      
      // Step 3: Approve USDC for MonadPay contract
      notification.info("🔄 Step 3/4: Approving USDC for MonadPay contract...");
      await approveUSDC({
        functionName: "approve",
        args: [monadPayContract.address, usdcAmount],
      });
      
      notification.success("✅ USDC approved! Now paying invoice...");
      
      // Step 4: Pay invoice with swapped USDC
      notification.info("🔄 Step 4/4: Paying invoice with USDC...");
      await payInvoice({
        functionName: "payInvoice",
        args: [invoiceId],
      });
      
      notification.success("🎉 Payment successful! Invoice paid with MON via Kuru!");
      
      // Refresh page to show updated status
      setTimeout(() => window.location.reload(), 2000);
      
    } catch (error: any) {
      console.error("MON payment error:", error);
      notification.error(error.message || "Failed to pay with MON");
    } finally {
      setIsPaying(false);
    }
  }

  if (!invoiceId || isLoadingInvoice) {
    return (
      <div className="container mx-auto p-8 text-center">
        <div className="loading loading-spinner loading-lg"></div>
        <p className="mt-4">Loading invoice...</p>
      </div>
    );
  }

  if (!invoiceData || !invoiceData[0]) {
    return (
      <div className="container mx-auto p-8 text-center">
        <div className="alert alert-error">
          <span>Invoice not found or does not exist</span>
        </div>
      </div>
    );
  }

  const [, creator, amount, , description, paid, createdAt, paidAt, paidBy] = invoiceData;

  const amountFormatted = formatUnits(amount, 6);

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {paid ? (
            <div className="alert alert-success mb-4">
              <span>✅ This invoice has been paid!</span>
            </div>
          ) : null}

          <h2 className="card-title text-3xl mb-4">{paid ? "Paid Invoice" : "Pay Invoice"}</h2>

          <div className="space-y-4">
            <div className="bg-primary/10 p-6 rounded-lg">
              <p className="text-sm opacity-70">Amount</p>
              <p className="text-4xl font-bold text-primary">{amountFormatted} USDC</p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-sm opacity-70">Description</p>
              <p className="text-lg">{description}</p>
            </div>

            <div className="bg-base-200 p-4 rounded-lg">
              <p className="text-sm opacity-70 mb-2">Created by</p>
              <Address address={creator} />
              <p className="text-xs opacity-60 mt-2">
                Created on: {new Date(Number(createdAt) * 1000).toLocaleString()}
              </p>
            </div>

            {splitsData && splitsData.length > 0 && (
              <div className="bg-base-200 p-4 rounded-lg">
                <p className="text-sm opacity-70 mb-3 font-bold">Payment will be split to:</p>
                <div className="space-y-2">
                  {splitsData.map((split: Split, index: number) => {
                    const percentage = Number(split.basisPoints) / 100;
                    const splitAmount = (amount * split.basisPoints) / 10000n;
                    return (
                      <div key={index} className="flex justify-between items-center p-2 bg-base-100 rounded">
                        <Address address={split.recipient} />
                        <div className="text-right">
                          <span className="font-bold block">{formatUnits(splitAmount, 6)} USDC</span>
                          <span className="text-xs opacity-70">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {paid ? (
              <div className="bg-base-200 p-4 rounded-lg">
                <p className="text-sm opacity-70 mb-2">Paid by</p>
                <Address address={paidBy} />
                <p className="text-sm opacity-70 mt-2">
                  Paid on: {new Date(Number(paidAt) * 1000).toLocaleString()}
                </p>
              </div>
            ) : null}
          </div>

          {!paid && userAddress ? (
            <div className="mt-6">
              {/* Payment Method Selector */}
              <div className="bg-base-200 p-4 rounded-lg mb-4">
                <p className="font-bold mb-3">Choose Payment Method:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("mon")}
                    className={`btn ${paymentMethod === "mon" ? "btn-primary" : "btn-outline"}`}
                  >
                    <span className="text-lg">🔥 Pay with MON</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("usdc")}
                    className={`btn ${paymentMethod === "usdc" ? "btn-primary" : "btn-outline"}`}
                  >
                    <span className="text-lg">💵 Pay with USDC</span>
                  </button>
                </div>

                {/* Payment Quote Display */}
                <div className="mt-4 p-3 bg-base-100 rounded">
                  {paymentMethod === "mon" ? (
                    <div>
                      <p className="text-sm opacity-70">You&apos;ll pay (estimated):</p>
                      <p className="text-2xl font-bold text-success">
                        {monQuote ? `~${formatUnits(monQuote, 18)} MON` : "Calculating..."}
                      </p>
                      <p className="text-xs opacity-60 mt-1">
                        ✨ Auto-swaps to USDC via Kuru DEX • No approval needed!
                      </p>
                      <p className="text-xs text-info mt-2">
                        💡 Kuru finds the best route across all order books
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm opacity-70">You&apos;ll pay:</p>
                      <p className="text-2xl font-bold text-info">{amountFormatted} USDC</p>
                      <p className="text-xs opacity-60 mt-1">
                        ⚠️ Requires approval step first
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Buttons */}
              {paymentMethod === "mon" ? (
                <div>
                  <button
                    onClick={handlePayWithMON}
                    disabled={isPaying || !monQuote}
                    className="btn btn-primary btn-lg w-full"
                  >
                    {isPaying ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Swapping & Paying...
                      </>
                    ) : (
                      <>🚀 Pay {monQuote ? `~${formatUnits(monQuote, 18)}` : "..."} MON</>
                    )}
                  </button>
                  <div className="text-xs opacity-60 mt-3 text-center">
                    💡 One transaction: Kuru swaps MON → USDC, then pays invoice
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={isApproving}
                      className="btn btn-secondary flex-1"
                    >
                      {isApproving ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Approving...
                        </>
                      ) : (
                        "1️⃣ Approve USDC"
                      )}
                    </button>
                    <button onClick={handlePay} disabled={isPaying} className="btn btn-primary flex-1">
                      {isPaying ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Paying...
                        </>
                      ) : (
                        "2️⃣ Pay Now"
                      )}
                    </button>
                  </div>
                  <div className="text-xs opacity-60 mt-3 text-center">
                    💡 Approve first, then pay. Two transactions required.
                  </div>
                </div>
              )}
            </div>
          ) : !paid && !userAddress ? (
            <div className="alert alert-warning mt-6">
              <span>Please connect your wallet to pay this invoice</span>
            </div>
          ) : null}
        </div>
      </div>

      {!paid && (
        <div className="mt-6 text-center">
          <p className="text-sm opacity-60">
            Invoice ID: <code className="text-xs">{invoiceId}</code>
          </p>
        </div>
      )}
    </div>
  );
}

