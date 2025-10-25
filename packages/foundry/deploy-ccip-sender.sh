#!/bin/bash

# CCIP Sender Deployment Script for Monad Testnet
# This script deploys the CCIPSender contract to Monad Testnet

set -e

echo "🚀 CCIP Sender Deployment Script"
echo "================================="

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "❌ Error: .env file not found in $SCRIPT_DIR"
    echo ""
    echo "Please create a .env file with:"
    echo "DEPLOYER_PRIVATE_KEY=your_private_key_here"
    echo ""
    exit 1
fi

# Load environment variables
echo "📁 Loading environment variables from $SCRIPT_DIR/.env..."
source "$SCRIPT_DIR/.env"

# Check if DEPLOYER_PRIVATE_KEY is set
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "❌ Error: DEPLOYER_PRIVATE_KEY environment variable is not set"
    echo ""
    echo "Please add to your .env file:"
    echo "DEPLOYER_PRIVATE_KEY=your_private_key_here"
    echo ""
    exit 1
fi

echo "📡 Deploying to Monad Testnet..."
echo "RPC: https://testnet-rpc.monad.xyz"
echo "Chain ID: 10143"
echo ""

# Deploy CCIPSender
echo "🔧 Deploying CCIPSender contract..."
cd "$SCRIPT_DIR"
forge script script/DeployCCIPSender.s.sol:DeployCCIPSender \
    --rpc-url https://testnet-rpc.monad.xyz \
    --broadcast \
    --verify \
    --etherscan-api-key "dummy" \
    --chain-id 10143

echo ""
echo "✅ CCIPSender deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update deployedContracts.ts with the new contract address"
echo "2. Deploy CCIPReceiver on destination chains"
echo "3. Configure trusted senders"
echo "4. Test cross-chain payments"
echo ""
echo "🔗 Monad Testnet Explorer: https://testnet.monadexplorer.com"
echo "🔗 CCIP Explorer: https://ccip.chain.link"
