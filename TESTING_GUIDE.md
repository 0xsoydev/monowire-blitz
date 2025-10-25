# 🧪 Complete Testing Guide - MonadPay with MON Payments

## ✅ What's Ready:

1. **Smart Contracts**:
   - MonadPay: `0x2905fcb25b64e5AD092967410043E35746C7f697`
   - MonadPayWithSwap: `0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054`

2. **Frontend**: 
   - Payment page with dual payment options (USDC or MON)
   - Real-time MON quote display
   - One-click MON payment

3. **Your Wallet**:
   - Address: `0xE4E0166c45FfFaa4C051Ae01895F1C23b8a3443C`
   - Balance: ~38 MON

---

## 🚀 Complete Test Flow (End-to-End)

### Step 1: Start the Frontend

```bash
cd /home/zer0day/Projects/monowire
yarn start
```

Visit: `http://localhost:3000`

---

### Step 2: Create an Invoice

1. Go to **"Create Invoice"** page
2. **Option A - Use AI**:
   ```
   "Create an invoice for 99 USDC, split 50/50 between 
   0x3b036a01d0785be98a260e939df4f1779daf04fa and 
   0xE4E0166c45FfFaa4C051Ae01895F1C23b8a3443C for development work"
   ```

3. **Option B - Manual**:
   - Amount: `99` USDC
   - Description: `Test Payment with MON`
   - Recipients:
     - Recipient 1: `0x3b036a01d0785be98a260e939df4f1779daf04fa` - 50%
     - Recipient 2: `0xE4E0166c45FfFaa4C051Ae01895F1C23b8a3443C` - 50%

4. Click **"Create Invoice"**
5. **Copy the payment link** (or QR code)

---

### Step 3: Pay the Invoice with MON 🔥

1. Open the payment link (or scan QR)
2. **Connect your wallet** (if not connected)
3. You'll see:
   ```
   Invoice: 99 USDC
   
   Choose Payment Method:
   [🔥 Pay with MON] [💵 Pay with USDC]
   
   You'll pay: ~19.8 MON
   ✨ Auto-swaps to USDC for recipients • No approval needed!
   ```

4. **Click "🚀 Pay ~19.8 MON Now"**
5. **Approve transaction in MetaMask**
   - You're sending MON (native token)
   - No approval needed!
   - One transaction only!

6. **Wait for confirmation** (<1 sec on Monad!)
7. **Success!** 🎉

---

### Step 4: Verify Payment

#### On the Payment Page:
- Status changes to "✅ This invoice has been paid!"
- Shows who paid and when

#### On Block Explorer:
Visit: `https://testnet.monadscan.com/tx/YOUR_TX_HASH`

You should see:
1. **SwapExecuted** event:
   - `tokenIn`: `0x0000...0000` (native MON)
   - `tokenOut`: USDC address
   - `amountIn`: ~19.8 MON
   - `amountOut`: 99 USDC

2. **SplitDistributed** events (2):
   - Recipient 1: 49.5 USDC
   - Recipient 2: 49.5 USDC

3. **InvoicePaid** event:
   - Invoice ID
   - Your address
   - Amount: 99 USDC

---

## 🧪 Test Cases

### Test 1: Pay with MON (Recommended!)
**Goal**: Verify auto-swap works

- ✅ Create invoice for 99 USDC
- ✅ Select "Pay with MON"
- ✅ Verify quote shows ~19.8 MON
- ✅ Click pay
- ✅ Verify recipients receive USDC
- ✅ Verify invoice marked as paid

**Expected**:
- Your MON decreases by ~20 MON
- Recipients get 49.5 USDC each
- One transaction only!

---

### Test 2: Pay with USDC (Traditional)
**Goal**: Verify standard payment works

- ✅ Create invoice for 99 USDC
- ✅ Select "Pay with USDC"
- ✅ Click "Approve USDC"
- ✅ Wait for approval
- ✅ Click "Pay Now"
- ✅ Verify payment completes

**Expected**:
- Your USDC decreases by 99 USDC
- Recipients get 49.5 USDC each
- Two transactions required (approve + pay)

---

### Test 3: Multiple Invoices
**Goal**: Test at scale

- ✅ Create 3 invoices with different amounts
- ✅ Pay one with MON
- ✅ Pay one with USDC
- ✅ Leave one unpaid
- ✅ Check dashboard (if built)

---

### Test 4: Different Split Ratios
**Goal**: Verify split math works

- ✅ Create invoice with 60/40 split
- ✅ Pay with MON
- ✅ Verify recipients get correct amounts:
  - Recipient 1: 59.4 USDC (60%)
  - Recipient 2: 39.6 USDC (40%)

---

### Test 5: Edge Cases

#### Small Amount:
- Invoice: 1 USDC
- Pay with MON
- Verify slippage doesn't cause issues

#### Large Amount (if you have enough MON):
- Invoice: 500 USDC
- Verify quote is reasonable
- (Don't actually pay unless you have the MON!)

---

## 🐛 Troubleshooting

### Issue: "Loading..." for MON quote
**Solution**: 
- Check if Uniswap has WMON/USDC liquidity
- Try refreshing the page
- Check console for errors

### Issue: Transaction fails with "Insufficient output"
**Solution**:
- Slippage too high (market moved)
- Try again or increase slippage in contract
- Current slippage: 1% (hardcoded)

### Issue: "Insufficient MON sent"
**Solution**:
- Quote was lower than actual needed
- Send a bit more MON (buffer recommended)
- Try increasing maxAmount parameter

### Issue: No MON in wallet
**Solution**:
- Visit: https://testnet.monad.xyz/
- Connect wallet
- Request MON from faucet
- Wait for confirmation

---

## 📊 Expected Performance

| Metric | Expected Value |
|--------|----------------|
| Transaction Time | <1 second |
| Gas Cost (MON) | ~350k gas (~$0.01) |
| Swap Fee | 0.3% (Uniswap) |
| MON → USDC Rate | ~$5 per MON (varies) |
| Success Rate | >99% |

---

## 🎬 Demo Script

**For judges/presentation:**

1. **Show Problem**:
   "Traditional payment gateways only accept fiat. DeFi users have crypto."

2. **Show MonadPay**:
   "Create invoice - recipients want USDC"

3. **Show Innovation**:
   "But user only has MON (Monad's native token)"

4. **Show Solution**:
   - Click "Pay with MON"
   - Shows quote: ~19.8 MON for 99 USDC
   - One click
   - Recipients instantly receive USDC

5. **Show Result**:
   - Block explorer with swap proof
   - Recipients' balances updated
   - "This is DeFi composability in action!"

---

## ✅ Success Criteria

Before demo, verify:
- [ ] Can create invoices
- [ ] Can see MON quote
- [ ] Can pay with MON
- [ ] Recipients receive USDC
- [ ] Block explorer shows events
- [ ] UI is responsive
- [ ] No console errors
- [ ] Wallet connection works
- [ ] QR code displays
- [ ] Payment link works

---

## 🚀 Ready to Test!

**Start here:**
1. `yarn start` in terminal
2. Go to `localhost:3000`
3. Create invoice
4. Pay with MON
5. **CELEBRATE!** 🎉

**Block Explorer**: https://testnet.monadscan.com/  
**USDC Token**: https://testnet.monadscan.com/token/0xf817257fed379853cDe0fa4F97AB987181B1E5Ea  
**MonadPayWithSwap**: https://testnet.monadscan.com/address/0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054

