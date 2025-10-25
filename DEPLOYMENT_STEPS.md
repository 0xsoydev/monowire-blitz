# Deployment Steps for MonadPayWithSwap

## Issue: Deployer Wallet Needs MON

**Deployer Address**: `0x553d2Db79d200017647d554a83ce87E05d9B727C`  
**Current Balance**: 0.26 MON  
**Needed**: ~0.50 MON for gas

## Option 1: Send MON to Deployer (Easiest)

### Using MetaMask/Your Wallet:
1. Send **1 MON** from your main wallet (`0xE4E016...443C`) to deployer (`0x553d2Db79d200017647d554a83ce87E05d9B727C`)
2. Run deployment again: `./packages/foundry/deploy-with-swap.sh`

### Using CLI:
```bash
# Import your main wallet's private key temporarily (if you have it)
cast send 0x553d2Db79d200017647d554a83ce87E05d9B727C \
  --value 1ether \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key YOUR_MAIN_WALLET_PK
```

---

## Option 2: Use Faucet for Deployer Address

Visit: https://testnet.monad.xyz/  
Connect with deployer address: `0x553d2Db79d200017647d554a83ce87E05d9B727C`  
Request MON

---

## Option 3: Change Deployer Key to Your Main Wallet

**⚠️ Warning**: Only if you're comfortable using your main wallet for deployment

```bash
# Update packages/foundry/.env
# Replace DEPLOYER_PRIVATE_KEY with your main wallet's private key
nano packages/foundry/.env
```

---

## After Getting MON:

### 1. Verify Balance:
```bash
cast balance 0x553d2Db79d200017647d554a83ce87E05d9B727C --rpc-url https://testnet-rpc.monad.xyz
# Should show > 500000000000000000 (0.5 MON)
```

### 2. Deploy:
```bash
./packages/foundry/deploy-with-swap.sh
```

### 3. Copy Deployed Address:
Look for: `MonadPayWithSwap deployed at: 0x...`

### 4. Update Frontend:
```typescript
// packages/nextjs/contracts/deployedContracts.ts
const deployedContracts = {
  10143: {
    // ... existing MonadPay
    MonadPayWithSwap: {
      address: "0xYOUR_DEPLOYED_ADDRESS",
      abi: [ /* paste ABI */ ]
    }
  }
}
```

---

## What Happens Next:

Once deployed, you can:
1. Create invoice (USDC)
2. Pay with MON (auto-swap)
3. Recipients receive USDC
4. PROFIT! 🚀

