import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deployPolicyEngine } from '../dist/index.js';

const PRIVATE_KEY = '0x77abb5d6fb5b59d6f08a2b9c89df4b95e874008c0f5bbf10eb760a90057d5838' as const;
const WALLET_ADDRESS = '0xf21Bd56C2Bc0538Eb1FACE7E9730bE20AA352054' as Address;

const TESTNET_CHAIN = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
} as const;

const MAINNET_CHAIN = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
} as const;

const account = privateKeyToAccount(PRIVATE_KEY);

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

async function deployAndSetup(
  chain: any,
  label: string,
  dailyLimit: string,
  weeklyLimit: string,
  isTestnet: boolean,
) {
  const rpc = chain.rpcUrls.default.http[0];
  const wc = createWalletClient({ account, chain, transport: http(rpc) });
  const pc = createPublicClient({ chain, transport: http(rpc) });

  // 1. Deploy new PolicyEngine
  console.log(`\n═══ ${label}: Deploying new PolicyEngine ═══`);
  const pe = await deployPolicyEngine(PRIVATE_KEY, { rpcUrl: rpc, testnet: isTestnet });
  console.log(`  PolicyEngine deployed: ${pe.address}`);
  console.log(`  TX: ${pe.hash}`);

  // 2. setPolicyEngine on AgentWallet
  console.log(`\n═══ ${label}: setPolicyEngine on AgentWallet ═══`);
  const setHash = await wc.writeContract({
    address: WALLET_ADDRESS,
    abi: SET_POLICY_ABI,
    functionName: 'setPolicyEngine',
    args: [pe.address],
  } as any);
  const setReceipt = await pc.waitForTransactionReceipt({ hash: setHash });
  console.log(`  TX: ${setHash} status: ${setReceipt.status}`);

  // 3. Create policy via wallet.execute()
  console.log(`\n═══ ${label}: Creating policy (${dailyLimit} MON daily, ${weeklyLimit} MON weekly) ═══`);
  const createPolicyCalldata = encodeFunctionData({
    abi: CREATE_POLICY_ABI,
    functionName: 'createPolicy',
    args: [
      WALLET_ADDRESS,
      parseEther(dailyLimit),
      parseEther(weeklyLimit),
      [],
      [],
      0n,
    ],
  });

  const execHash = await wc.writeContract({
    address: WALLET_ADDRESS,
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [pe.address, 0n, createPolicyCalldata],
  } as any);
  const execReceipt = await pc.waitForTransactionReceipt({ hash: execHash });
  console.log(`  TX: ${execHash} status: ${execReceipt.status}`);

  console.log(`\n✅ ${label} DONE — New PolicyEngine: ${pe.address}`);
  return pe.address;
}

// ──────── Run ────────
// Testnet already completed — skip
// const testnetPE = await deployAndSetup(TESTNET_CHAIN, 'TESTNET', '0.1', '0.7', true);
const testnetPE = '0x41e24c97816b76af320fa315f49e45c3a6168086'; // already deployed
const mainnetPE = await deployAndSetup(MAINNET_CHAIN, 'MAINNET', '1', '5', false);

console.log('\n\n══════════════════════════════════════════════');
console.log('  DEPLOYMENT COMPLETE');
console.log(`  Testnet PolicyEngine: ${testnetPE}`);
console.log(`  Mainnet PolicyEngine: ${mainnetPE}`);
console.log('══════════════════════════════════════════════');
