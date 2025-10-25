# Uniswap V2 Integration - MonadPay

## ✅ What's Been Built

### 1. Smart Contract (`MonadPayWithSwap.sol`)
**Location**: `packages/foundry/contracts/MonadPayWithSwap.sol`

**Features**:
- ✅ Extends MonadPay with swap functionality
- ✅ Integrates with Uniswap V2 Router on Monad
- ✅ `payInvoiceWithSwap()` - Pay with any token, auto-swap to USDC
- ✅ `getSwapQuote()` - Get quote for how much input token needed
- ✅ Supports custom swap paths (multi-hop swaps)
- ✅ Atomic transactions - swap + payment in one TX
- ✅ Automatic split distribution after swap

**How it works**:
```solidity
// User pays with WETH, invoice requires USDC
payInvoiceWithSwap(
    invoiceId,
    WETH_ADDRESS,      // Token user has
    maxWETH,           // Max willing to spend
    [WETH, USDC]       // Swap path
)

// Contract automatically:
// 1. Gets quote from Uniswap
// 2. Takes WETH from user
// 3. Swaps WETH → USDC on Uniswap
// 4. Distributes USDC to recipients
```

### 2. Deployment Script
**Location**: `packages/foundry/script/DeployMonadPayWithSwap.s.sol`
**Helper**: `packages/foundry/deploy-with-swap.sh`

**Uniswap Router**: `0xfB8e1C3b833f9E67a71C859a132cf783b645e436`

### 3. External Contracts Configuration
**Location**: `packages/nextjs/contracts/externalContracts.ts`

Added:
- ✅ USDC: `0xf817257fed379853cDe0fa4F97AB987181B1E5Ea`
- ✅ WETH: `0xB5a30b0Dc5EA4A5f0DcC5EA9760c844bF9Fb37`
- ✅ UniswapV2Router02: `0xfB8e1C3b833f9E67a71C859a132cf783b645e436`

---

## 🚀 How to Deploy

### Step 1: Deploy the Contract

```bash
cd /home/zer0day/Projects/monowire
./packages/foundry/deploy-with-swap.sh
```

### Step 2: Copy Deployed Address
From the output:
```
MonadPayWithSwap deployed at: 0xABCD1234...
```

### Step 3: Add to deployedContracts.ts
```typescript
// packages/nextjs/contracts/deployedContracts.ts
const deployedContracts = {
  10143: {
    // ... existing MonadPay
    MonadPayWithSwap: {
      address: "0xYOUR_DEPLOYED_ADDRESS",
      abi: [/* copy from forge output or build artifacts */]
    }
  }
}
```

---

## 📱 Frontend Integration (TODO)

### What Needs to be Built:

1. **Token Selector Component**
   - Let users choose payment token (USDC, WETH, MON)
   - Show balances for each token
   - Auto-detect what user has

2. **Swap Quote Display**
   - Call `getSwapQuote()` to show exchange rate
   - Display: "Pay 0.05 WETH to cover 99 USDC invoice"
   - Show estimated gas costs

3. **Approve + Swap Flow**
   - Step 1: Approve payment token (WETH) to MonadPayWithSwap
   - Step 2: Call `payInvoiceWithSwap()`

4. **Update Payment Page**
   - Add token selection dropdown
   - Show swap preview
   - Handle both direct payment and swap payment

---

## 🧪 Testing Flow

### Scenario: Pay USDC invoice with WETH

1. **Get Testnet Tokens**
   - USDC faucet
   - WETH faucet (or wrap testnet MON)

2. **Create Invoice** (99 USDC)
   ```typescript
   createInvoice(99_000000, USDC, "Test", splits)
   ```

3. **Get Swap Quote**
   ```typescript
   getSwapQuote(invoiceId, [WETH, USDC])
   // Returns: ~0.05 WETH needed
   ```

4. **Approve WETH**
   ```typescript
   WETH.approve(MonadPayWithSwap, 0.05e18)
   ```

5. **Pay with Swap**
   ```typescript
   payInvoiceWithSwap(
     invoiceId,
     WETH,
     0.06e18,  // Max 0.06 WETH (with slippage)
     [WETH, USDC]
   )
   ```

6. **Verify**
   - Recipients receive USDC ✅
   - User spent WETH ✅
   - Invoice marked as paid ✅

---

## 🎯 Benefits

✅ **Users can pay with any token they have**
✅ **Atomic swaps** - no need to manually swap first
✅ **Best UX** - one-click payment regardless of token
✅ **Gas efficient** - single transaction
✅ **Extensible** - can add more DEXs later (Kuru!)

---

## 🔮 Future Enhancements

### Add Kuru DEX Support
- Same interface pattern
- Compare quotes: Uniswap vs Kuru
- Choose cheapest route automatically

### Multi-DEX Aggregation
```typescript
const uniQuote = getUniswapQuote()
const kuruQuote = getKuruQuote()
const cheapest = uniQuote < kuruQuote ? uniswap : kuru
```

### Support More Tokens
- MON (native Monad token)
- USDT
- DAI
- Any ERC20 with liquidity

---

## 📊 Current Status

- ✅ Smart contract written and compiled
- ✅ Deployment script ready
- ✅ External contracts configured
- ⏳ Frontend integration (next step)
- ⏳ Testing on testnet
- ⏳ UI/UX polish

**Estimated Time to Complete**: 30-45 minutes
**Blockers**: Need testnet WETH for testing

