// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/AgentWallet.sol";
import "../src/PolicyEngine.sol";

contract DeployAgentKit is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying AgentKit to Monad...");
        console.log("Deployer:", deployer);
        
        PolicyEngine policyEngine = new PolicyEngine();
        console.log("PolicyEngine:", address(policyEngine));
        
        address agentAddress = deployer;
        
        AgentWallet wallet = new AgentWallet(
            deployer,
            agentAddress,
            address(policyEngine)
        );
        console.log("AgentWallet:", address(wallet));
        
        console.log("\n=== Deployment Complete ===");
        console.log("PolicyEngine:", address(policyEngine));
        console.log("AgentWallet:", address(wallet));
        console.log("\nNext steps:");
        console.log("1. Fund wallet with testnet MON");
        console.log("2. Create policy for the wallet");
        console.log("3. Test agent execution");
        
        vm.stopBroadcast();
    }
}

contract CreatePolicy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address policyEngine = vm.envAddress("POLICY_ENGINE");
        address wallet = vm.envAddress("WALLET");
        
        uint256 dailyLimit = vm.envUint("DAILY_LIMIT");
        uint256 weeklyLimit = vm.envUint("WEEKLY_LIMIT");
        uint256 approvalThreshold = vm.envUint("APPROVAL_THRESHOLD");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PolicyEngine(policyEngine).createPolicy(
            wallet,
            dailyLimit,
            weeklyLimit,
            new address[](0),
            new address[](0),
            approvalThreshold
        );
        
        console.log("Policy created for wallet:", wallet);
        
        vm.stopBroadcast();
    }
}
