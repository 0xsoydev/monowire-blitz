// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CrossChainPayment.sol";

contract DeployCrossChainPayment is Script {
    function run() external {
        string memory pkString = vm.envString("DEPLOYER_PRIVATE_KEY");
        uint256 deployerPrivateKey;
        bytes memory pkBytes = bytes(pkString);
        if (pkBytes.length >= 2 && pkBytes[0] == "0" && pkBytes[1] == "x") {
            deployerPrivateKey = vm.parseUint(pkString);
        } else {
            deployerPrivateKey = vm.parseUint(string.concat("0x", pkString));
        }
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy CrossChainPayment
        CrossChainPayment payment = new CrossChainPayment();
        console.log("CrossChainPayment deployed at:", address(payment));

        // Add supported destination chains
        // Ethereum Sepolia
        payment.addSupportedChain(16015286601757825753);
        console.log("Added Ethereum Sepolia support");
        
        // Avalanche Fuji
        payment.addSupportedChain(14767482510784806043);
        console.log("Added Avalanche Fuji support");
        
        // Sonic Blaze
        payment.addSupportedChain(40109);
        console.log("Added Sonic Blaze support");

        vm.stopBroadcast();
    }
}
