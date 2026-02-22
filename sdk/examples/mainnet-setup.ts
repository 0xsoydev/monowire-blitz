/**
 * Mainnet setup: createPolicy on new PolicyEngine
 * PolicyEngine deployed at 0x6B75948f29EAB424164D89F05d282CE9Aaf80EDc
 * setPolicyEngine already called — wallet points to new PE
 */
import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = '0x77abb5d6fb5b59d6f08a2b9c89df4b95e874008c0f5bbf10eb760a90057d5838' as const;
const WALLET_ADDRESS = '0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054' as Address;
const NEW_PE = '0x6B75948f29EAB424164D89F05d282CE9Aaf80EDc' as Address;

const MAINNET_CHAIN = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
} as const;

const account = privateKeyToAccount(PRIVATE_KEY);
const wc = createWalletClient({ account, chain: MAINNET_CHAIN, transport: http('https://rpc.monad.xyz') });
const pc = createPublicClient({ chain: MAINNET_CHAIN, transport: http('https://rpc.monad.xyz') });

const SET_POLICY_ABI = [{
  name: 'setPolicyEngine',
  type: 'function' as const,
  inputs: [{ name: '_policyEngine', type: 'address' }],
  outputs: [],
  stateMutability: 'nonpayable' as const,
}] as const;

const EXECUTE_ABI = [{
  inputs: [
    { name: 'target', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
  name: 'execute',
  outputs: [{ name: '', type: 'bytes' }],
  stateMutability: 'payable' as const,
  type: 'function' as const,
}] as const;

const CREATE_POLICY_ABI = [{
  inputs: [
    { name: 'wallet', type: 'address' },
    { name: 'dailyLimit', type: 'uint256' },
    { name: 'weeklyLimit', type: 'uint256' },
    { name: 'allowedTokens', type: 'address[]' },
    { name: 'allowedContracts', type: 'address[]' },
    { name: 'requireApprovalAbove', type: 'uint256' },
  ],
  name: 'createPolicy',
  outputs: [],
  stateMutability: 'nonpayable' as const,
  type: 'function' as const,
}] as const;

// createPolicy via wallet.execute()
console.log('=== createPolicy (1 MON daily, 5 MON weekly) ===');
const createPolicyCalldata = encodeFunctionData({
  abi: CREATE_POLICY_ABI,
  functionName: 'createPolicy',
  args: [
    WALLET_ADDRESS,
    parseEther('1'),
    parseEther('5'),
    [],
    [],
    0n,
  ],
});

const execHash = await wc.writeContract({
  address: WALLET_ADDRESS,
  abi: EXECUTE_ABI,
  functionName: 'execute',
  args: [NEW_PE, 0n, createPolicyCalldata],
} as any);
const execReceipt = await pc.waitForTransactionReceipt({ hash: execHash });
console.log(`  TX: ${execHash}`);
console.log(`  Status: ${execReceipt.status}`);

console.log('\n=== DONE ===');
console.log(`New PolicyEngine: ${NEW_PE}`);
