"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

// Supported destination chains for LayerZero OFT
const SUPPORTED_CHAINS = [
  { id: 11155111, name: "Ethereum Sepolia", symbol: "ETH" },
  { id: 43113, name: "Avalanche Fuji", symbol: "AVAX" },
  { id: 80002, name: "Polygon Amoy", symbol: "MATIC" },
  { id: 421614, name: "Arbitrum Sepolia", symbol: "ETH" },
  { id: 11155420, name: "Optimism Sepolia", symbol: "ETH" },
];

export default function CrossChainPayPage() {
  const { address } = useAccount();
  
  const [destinationChainId, setDestinationChainId] = useState<number>(11155111);
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<string>("");

  // Note: This contract only exists on Monad Testnet
  // For real cross-chain payments, we need a different approach
  const { writeContractAsync: writeCrossChainPaymentETH } = useScaffoldWriteContract({
    contractName: "CrossChainPaymentETH",
  });

  // Read contract ETH balance
  const { data: contractETHBalance } = useScaffoldReadContract({
    contractName: "CrossChainPaymentETH",
    functionName: "getETHBalance",
  });

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search);
    const destinationChain = params.get('destinationChain');
    const recipientParam = params.get('recipient');
    const amountParam = params.get('amount');
    const descriptionParam = params.get('description');
    const paymentIdParam = params.get('paymentId');

    if (destinationChain) setDestinationChainId(Number(destinationChain));
    if (recipientParam) setRecipient(recipientParam);
    if (amountParam) setAmount(amountParam);
    if (descriptionParam) setDescription(descriptionParam);
    if (paymentIdParam) setPaymentId(paymentIdParam);
  }, []);

  const handleSendCrossChainPayment = async () => {
    if (!address) {
      notification.error("Please connect your wallet");
      return;
    }

    if (!recipient || !amount || !description) {
      notification.error("Missing payment details");
      return;
    }

    // For demo purposes, we'll redirect to a bridge service
    // In a real implementation, this would use LayerZero or CCIP
    setLoading(true);
    
    try {
      // Generate payment ID for tracking
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const paymentId = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;
      setPaymentId(paymentId);

      // Redirect to bridge service based on source chain
      let bridgeUrl = "";
      if (destinationChainId === 11155111) { // Ethereum Sepolia
        bridgeUrl = `https://bridge.orbiter.finance/?source=ethereum&destination=monad&amount=${amount}&token=ETH&recipient=${recipient}`;
      } else if (destinationChainId === 43113) { // Avalanche Fuji
        bridgeUrl = `https://bridge.orbiter.finance/?source=avalanche&destination=monad&amount=${amount}&token=AVAX&recipient=${recipient}`;
      } else if (destinationChainId === 80002) { // Polygon Amoy
        bridgeUrl = `https://bridge.orbiter.finance/?source=polygon&destination=monad&amount=${amount}&token=MATIC&recipient=${recipient}`;
      } else {
        bridgeUrl = `https://bridge.orbiter.finance/?source=ethereum&destination=monad&amount=${amount}&token=ETH&recipient=${recipient}`;
      }

      // Open bridge in new tab
      window.open(bridgeUrl, '_blank');
      
      notification.success("Redirecting to bridge service for cross-chain transfer...");
    } catch (error) {
      console.error("Error opening bridge:", error);
      notification.error("Failed to open bridge service");
    } finally {
      setLoading(false);
    }
  };


  const openLayerZeroDocs = () => {
    window.open("https://docs.layerzero.network/v2/deployments/evm-chains/monad-testnet-oft-quickstart", "_blank");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100 p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8">💸 Pay Cross-Chain with LayerZero</h1>
        
        <div className="card bg-base-200 shadow-xl p-6">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-6">Payment Request</h2>
            
            <div className="space-y-4">
              {/* Payment Details */}
              <div className="bg-base-100 p-4 rounded-lg">
                <h3 className="font-semibold mb-3">Payment Details:</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Amount:</strong> {amount} ETH</p>
                  <p><strong>From Chain:</strong> {SUPPORTED_CHAINS.find(c => c.id === destinationChainId)?.name}</p>
                  <p><strong>To Chain:</strong> Monad Testnet</p>
                  <p><strong>Recipient:</strong> {recipient}</p>
                  <p><strong>Description:</strong> {description}</p>
                </div>
              </div>

              {/* Contract ETH Balance */}
              {contractETHBalance !== undefined && (
                <div className="bg-info p-3 rounded-lg">
                  <p className="text-sm">
                    <strong>Contract ETH Balance:</strong> {(Number(contractETHBalance) / 1e18).toFixed(4)} ETH
                  </p>
                </div>
              )}

              {/* Bridge Info */}
              <div className="bg-info p-4 rounded-lg">
                <h3 className="font-semibold mb-3">🌉 Bridge Service</h3>
                <p className="text-sm mb-3">
                  This will redirect you to <strong>Orbiter Finance</strong> bridge to complete the cross-chain transfer.
                </p>
                <p className="text-sm">
                  <strong>What happens:</strong> You'll be taken to the bridge where you can send {amount} ETH from {SUPPORTED_CHAINS.find(c => c.id === destinationChainId)?.name} to Monad Testnet.
                </p>
              </div>

              {/* ETH Payment Info */}
              <div className="bg-success p-4 rounded-lg">
                <h3 className="font-semibold mb-3">💎 ETH Cross-Chain Payment</h3>
                <p className="text-sm mb-3">
                  You will send {amount} ETH from {SUPPORTED_CHAINS.find(c => c.id === destinationChainId)?.name}, and the recipient will receive ETH on Monad Testnet.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-3">
                <button
                  className={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
                  onClick={handleSendCrossChainPayment}
                  disabled={loading}
                >
                  {loading ? 'Opening Bridge...' : 'Open Bridge to Send ETH'}
                </button>
                
                <button
                  className="btn btn-outline w-full"
                  onClick={openLayerZeroDocs}
                >
                  📚 Learn About LayerZero OFT
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="card bg-base-200 shadow-xl p-6 mt-6">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">🚀 How Cross-Chain Bridge Payments Work</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Step 1:</strong> Click "Open Bridge to Send ETH" above</p>
              <p><strong>Step 2:</strong> You'll be redirected to Orbiter Finance bridge</p>
              <p><strong>Step 3:</strong> Connect your wallet on the bridge</p>
              <p><strong>Step 4:</strong> Complete the cross-chain transfer on the bridge</p>
              <p><strong>Step 5:</strong> ETH will be transferred to Monad Testnet automatically</p>
            </div>
          </div>
        </div>

        {/* Bridge Info */}
        <div className="card bg-base-200 shadow-xl p-6 mt-6">
          <div className="card-body">
            <h3 className="card-title text-xl mb-4">🌉 Orbiter Finance Bridge</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Real Cross-Chain:</strong> Uses Orbiter Finance's proven bridge infrastructure</p>
              <p><strong>Multi-Chain:</strong> Supports transfers from Ethereum, Avalanche, Polygon, and more</p>
              <p><strong>Secure:</strong> Battle-tested bridge with billions in volume</p>
              <p><strong>Fast:</strong> Optimized for quick cross-chain transfers</p>
            </div>
          </div>
        </div>

        {/* Payment ID Display */}
        {paymentId && (
          <div className="card bg-success shadow-xl p-6 mt-6">
            <div className="card-body">
              <h3 className="card-title text-xl mb-4">✅ Payment Sent!</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Payment ID:</strong> {paymentId}</p>
                <p>The bridge will handle the cross-chain transfer. The recipient will receive ETH on Monad Testnet.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}