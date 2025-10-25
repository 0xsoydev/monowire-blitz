# Testing MON Payment Feature 🧪

## Contract Deployed ✅
**MonadPayWithSwap**: `0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054`

---

## Option 1: Quick CLI Test (5 mins) ⚡

### Step 1: Create a Test Invoice

```bash
# Using MonadPay contract (already works)
cast send 0x2905fcb25b64e5AD092967410043E35746C7f697 \
  "createInvoice(uint256,address,string,(address,uint256)[])" \
  99000000 \
  0xf817257fed379853cDe0fa4F97AB987181B1E5Ea \
  "Test Invoice for MON Payment" \
  "[('0x3b036a01d0785be98a260e939df4f1779daf04fa',5000),('0xE4E0166c45FfFaa4C051Ae01895F1C23b8a3443C',5000)]" \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key YOUR_PRIVATE_KEY
```

This creates a 99 USDC invoice split 50/50 between two recipients.

### Step 2: Get the Invoice ID

From the transaction receipt, look for the `InvoiceCreated` event and copy the `invoiceId`.

OR use the transaction hash:
```bash
# Get event logs from the tx
cast receipt YOUR_TX_HASH --rpc-url https://testnet-rpc.monad.xyz | grep -A 5 "InvoiceCreated"
```

### Step 3: Get MON Quote

```bash
# Check how much MON is needed
cast call 0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054 \
  "getNativeMONQuote(bytes32)" \
  YOUR_INVOICE_ID \
  --rpc-url https://testnet-rpc.monad.xyz

# Convert to human-readable
cast from-wei RESULT_FROM_ABOVE
```

### Step 4: Pay with MON!

```bash
# Pay the invoice with MON
cast send 0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054 \
  "payInvoiceWithNativeMON(bytes32)" \
  YOUR_INVOICE_ID \
  --value 20ether \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key YOUR_PRIVATE_KEY
```

### Step 5: Verify Payment

Check the transaction on explorer:
```
https://testnet.monadscan.com/tx/YOUR_TX_HASH
```

You should see:
1. **SwapExecuted** event (MON → USDC swap)
2. **SplitDistributed** events (USDC to recipients)
3. **InvoicePaid** event (invoice marked as paid)

---

## Option 2: Test via Frontend (15 mins) 🎨

### What We Need to Build:

On the payment page (`/pay/[invoiceId]`), add:

1. **"Pay with MON" Button** alongside "Pay with USDC"
2. **MON Quote Display**: "~19.8 MON needed"
3. **One-click payment** (no approvals!)

### Quick Implementation:

```typescript
// In app/pay/[invoiceId]/page.tsx

// Get MON quote
const { data: monQuote } = useScaffoldReadContract({
  contractName: "MonadPayWithSwap",
  functionName: "getNativeMONQuote",
  args: [invoiceId],
});

// Pay with MON
const { writeContractAsync: payWithMON } = useScaffoldWriteContract("MonadPayWithSwap");

async function handlePayWithMON() {
  if (!monQuote) return;
  
  try {
    await payWithMON({
      functionName: "payInvoiceWithNativeMON",
      args: [invoiceId],
      value: monQuote, // Send MON with transaction
    });
    
    notification.success("Paid with MON! 🎉");
  } catch (error: any) {
    notification.error(error.message);
  }
}
```

---

## Expected Results ✅

### After Paying with MON:

1. ✅ User's MON balance decreases by ~20 MON
2. ✅ Recipients receive USDC (49.5 USDC each)
3. ✅ Invoice marked as paid
4. ✅ Transaction completes in <1 second (Monad!)

### What Happens Behind the Scenes:

```
User: Sends 20 MON
  ↓
MonadPayWithSwap Contract:
  ├─ Receives 20 MON
  ├─ Calls Uniswap: swapExactETHForTokens
  ├─ Uniswap wraps MON → WMON
  ├─ Uniswap swaps WMON → USDC
  └─ Returns 99 USDC to contract
  ↓
MonadPay Logic:
  ├─ Split 99 USDC:
  │   ├─ 49.5 USDC → Recipient 1
  │   └─ 49.5 USDC → Recipient 2
  └─ Mark invoice as paid
  ↓
Done! ✅
```

---

## Debugging Tips 🔍

### If Transaction Fails:

1. **Check Uniswap Liquidity**:
   ```bash
   # Verify WMON/USDC pair exists
   # Visit Monad testnet Uniswap to check liquidity
   ```

2. **Check Slippage**:
   - Current slippage: 1% (in contract)
   - If swap fails, might need to increase

3. **Check MON Balance**:
   ```bash
   cast balance YOUR_ADDRESS --rpc-url https://testnet-rpc.monad.xyz
   ```

4. **Check Gas**:
   - Estimated: ~350k gas
   - Make sure you have enough MON for gas + payment

---

## What's Next?

### After Successful Test:

1. ✅ **Take screenshots** of the transaction
2. ✅ **Note the block explorer link**
3. ✅ **Build frontend UI** for seamless UX
4. ✅ **Prepare demo**: "Pay any invoice with MON in 1 click!"

### Demo Flow:

1. Show invoice: "99 USDC needed"
2. User has: "20 MON"
3. Click: "Pay with MON"
4. Show: Transaction executing...
5. Success: "Paid! Recipients received USDC!"
6. Show: Block explorer with swap events

---

## Current Status:

- ✅ Contract deployed
- ✅ Frontend configured
- ⏳ CLI test (do this now!)
- ⏳ Frontend UI (next)
- ⏳ Full integration test

**Ready to test! Go for it!** 🚀

