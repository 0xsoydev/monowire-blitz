import { createPublicClient, createWalletClient, http, parseEther, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  IDENTITY_REGISTRY,
  IDENTITY_REGISTRY_ABI,
  getPrivateKey,
  createAgentCard,
} from "./config";

const account = privateKeyToAccount(getPrivateKey());

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: monadTestnet,
  transport: http(),
});

const agentNames = ["Beta Agent", "Gamma Agent"];
const agentImages = [
  "https://em-content.zobj.net/source/twitter/376/robot-face_1f916.png",
  "https://em-content.zobj.net/source/twitter/376/alien_1f47d.png",
];

async function main() {
  const existingBalance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer ${account.address} balance: ${existingBalance} wei`);
  if (existingBalance < parseEther("0.1")) {
    console.warn("Balance is low; get testnet MON from https://faucet.monad.xyz");
  }

  const agentIds: number[] = [];

  for (let i = 0; i < agentNames.length; i++) {
    const name = agentNames[i];
    // placeholder agentId; will be replaced by actual tokenId after mint
    const tempCard = createAgentCard(name, i + 1, agentImages[i]);

    console.log(`Registering agent ${name}...`);
    const tx = await walletClient.writeContract({
      address: IDENTITY_REGISTRY,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "register",
      args: [tempCard],
      gas: 1200000n,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`Agent ${name} registered, tx: ${receipt.transactionHash}`);

    // Find agentId from Registered event
    const logs = parseEventLogs({
      abi: IDENTITY_REGISTRY_ABI,
      eventName: "Registered",
      logs: receipt.logs,
    });

    const agentLog = logs[0];
    if (!agentLog || !agentLog.args.agentId) {
      throw new Error(`Could not find Registered event for ${name}`);
    }
    const agentId = Number(agentLog.args.agentId);
    agentIds.push(agentId);
    console.log(`  Agent ID: ${agentId}`);
  }

  console.log("\nRegistered agents:", agentIds);
  console.log(`Agent owner: ${account.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
