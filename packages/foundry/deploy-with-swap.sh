#!/bin/bash

# MonadPayWithSwap Deployment Script for Monad Testnet

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "🚀 MonadPayWithSwap Deployment Script"
echo "======================================"
echo ""

# Load .env file from the script's directory if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "📁 Loading environment variables from $SCRIPT_DIR/.env..."
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Check if DEPLOYER_PRIVATE_KEY is set
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "❌ Error: DEPLOYER_PRIVATE_KEY environment variable is not set"
    echo ""
    echo "Option 1 - Create .env file in packages/foundry/:"
    echo "  echo 'DEPLOYER_PRIVATE_KEY=your_private_key_here' > packages/foundry/.env"
    echo ""
    echo "Option 2 - Export manually:"
    echo "  export DEPLOYER_PRIVATE_KEY=\"your_private_key_here\""
    echo ""
    echo "Option 3 - Use a keystore:"
    echo "  cast wallet import deployer --interactive"
    exit 1
fi

echo "📡 Deploying MonadPayWithSwap to Monad Testnet..."
echo "RPC: https://testnet-rpc.monad.xyz"
echo "Chain ID: 10143"
echo ""
echo "📋 Configuration:"
echo "  Uniswap Router: 0xfB8e1C3b833f9E67a71C859a132cf783b645e436"
echo "  WMON (Wrapped MON): 0x760AFe86e5d5Fa0EE542F7B713713E1c0dd59701"
echo "  USDC: 0xf817257fed379853cDe0fa4F97AB987181B1E5Ea"
echo ""

# Change to the foundry directory
cd "$SCRIPT_DIR"

# Deploy the contract
forge script script/DeployMonadPayWithSwap.s.sol:DeployMonadPayWithSwap \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --legacy \
  -vvvv

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ MonadPayWithSwap deployed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Copy the deployed contract address from the output above"
    echo "2. Add it to packages/nextjs/contracts/deployedContracts.ts"
    echo "3. Restart Next.js (yarn start)"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above"
    exit 1
fi

