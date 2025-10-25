"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

// Supported destination chains for LayerZero OFT
const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Ethereum Sepolia", symbol: "ETH" },
  { id: 43113, name: "Avalanche Fuji", symbol: "AVAX" },
  { id: 80002, name: "Polygon Amoy", symbol: "MATIC" },
  { id: 421614, name: "Arbitrum Sepolia", symbol: "ETH" },
  { id: 11155420, name: "Optimism Sepolia", symbol: "ETH" },
];

export default function CrossChainPaymentPage() {
  const { address } = useAccount();
  
  const [destinationChainId, setDestinationChainId] = useState<number>(11155111);
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string>("");
  const [showPaymentLink, setShowPaymentLink] = useState(false);

  const { writeContractAsync: writeCrossChainPaymentETH } = useScaffoldWriteContract({
    contractName: "CrossChainPaymentETH",
  });

  const handleRequestCrossChainPayment = async () => {
    if (!recipient || !amount || !description) {
      notification.error("Please fill in all fields");
      return;
    }

    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }

    setLoading(true);
    try {
      const amountWei = BigInt(parseFloat(amount) * 1e18);
      
      const result = await writeCrossChainPaymentETH({
        functionName: "requestCrossChainPayment",
        args: [recipient, amountWei, destinationChainId, description],
      });

      if (result) {
        notification.success("Cross-chain payment request created! Payment ID generated.");
        
        // Generate payment link for the payer
        // Generate a proper bytes32 payment ID
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        const paymentId = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;

        const paymentData = {
          destinationChain: destinationChainId.toString(),
          recipient: recipient,
          amount: amount,
          description: description,
          paymentId: paymentId,
        };

        const generatedLink = `${window.location.origin}/cross-chain/pay?${new URLSearchParams(paymentData).toString()}`;
        setPaymentLink(generatedLink);
        setShowPaymentLink(true);
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(generatedLink);
          notification.success("Payment link copied to clipboard! Share this link with the payer.");
        } catch (clipboardError) {
          console.error("Failed to copy to clipboard:", clipboardError);
          notification.warning("Payment link generated but could not copy to clipboard. Please copy manually below.");
        }
      }
    } catch (error) {
      console.error("Error creating cross-chain payment request:", error);
      notification.error("Failed to create cross-chain payment request");
    } finally {
      setLoading(false);
    }
  };

  const copyPaymentLink = async () => {
    if (paymentLink) {
      try {
        await navigator.clipboard.writeText(paymentLink);
        notification.success("Payment link copied to clipboard!");
      } catch (error) {
        notification.error("Failed to copy to clipboard. Please copy manually from the link above.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8">🌉 LayerZero Cross-Chain Payment</h1>
        
        <div className="card bg-base-200 shadow-xl p-6">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-6">Create LayerZero Cross-Chain Payment Request</h2>
            
            <div className="space-y-4">
              {/* Destination Chain Selection */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Destination Chain (Where payer will send from)</span>
                </label>
                <select 
                  className="select select-bordered w-full"
                  value={destinationChainId}
                  onChange={(e) => setDestinationChainId(Number(e.target.value))}
                >
                  {SUPPORTED_CHAINS.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name} ({chain.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Address */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Your Monad Address (Where you'll receive payment)</span>
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="input input-bordered w-full"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>

              {/* Amount */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Amount in ETH</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.1"
                  className="input input-bordered w-full"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  placeholder="Payment description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-3">
                <button
                  className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
                  onClick={handleRequestCrossChainPayment}
                  disabled={loading}
                >
                  {loading ? 'Creating Payment Request...' : 'Create LayerZero Payment Request'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Link Display */}
        {showPaymentLink && paymentLink && (
          <div className="card bg-success shadow-xl p-6 mt-6">
            <div className="card-body">
              <h3 className="card-title text-xl mb-4">🔗 Payment Link Generated!</h3>
              <div className="space-y-3">
                <p className="text-sm">Share this link with the payer:</p>
                <div className="bg-base-100 p-3 rounded-lg">
                  <code className="text-xs break-all">{paymentLink}</code>
                </div>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={copyPaymentLink}
                >
                  📋 Copy Link Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="card bg-base-200 shadow-xl p-6 mt-6">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">📋 How LayerZero Cross-Chain Payments Work</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Step 1:</strong> Create payment request above (generates payment ID)</p>
              <p><strong>Step 2:</strong> Share payment link with payer</p>
              <p><strong>Step 3:</strong> Payer opens link, sees payment details</p>
              <p><strong>Step 4:</strong> Payer sends ETH from {SUPPORTED_CHAINS.find(c => c.id === destinationChainId)?.name} to Monad Testnet using LayerZero</p>
              <p><strong>Step 5:</strong> You receive ETH on Monad Testnet automatically via LayerZero messaging</p>
            </div>
          </div>
        </div>

        {/* ETH Payment Info */}
        <div className="card bg-base-200 shadow-xl p-6 mt-6">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">💎 About ETH Cross-Chain Payments</h3>
            <div className="space-y-2 text-sm">
              <p><strong>What is this?</strong> Cross-chain ETH payments using LayerZero technology</p>
              <p><strong>How it works:</strong> Payer sends ETH, recipient receives ETH on Monad Testnet</p>
              <p><strong>Cross-chain:</strong> ETH is transferred between chains using LayerZero messaging</p>
              <p><strong>Real ETH:</strong> Uses actual ETH tokens, not test tokens</p>
            </div>
          </div>
        </div>

        {/* LayerZero Info */}
        <div className="card bg-base-200 shadow-xl p-6 mt-6">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">🚀 LayerZero OFT Technology</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Real Cross-Chain:</strong> Uses LayerZero's Omnichain Fungible Token (OFT) protocol</p>
              <p><strong>No Bridges:</strong> Direct cross-chain messaging between chains</p>
              <p><strong>Secure:</strong> Decentralized verifier networks ensure message integrity</p>
              <p><strong>Fast:</strong> Optimized for high-throughput cross-chain transfers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}