// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CrossChainPaymentReceiver.sol";

contract DeployCrossChainPaymentReceiver is Script {
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

        // Deploy CrossChainPaymentReceiver
        CrossChainPaymentReceiver receiver = new CrossChainPaymentReceiver();
        console.log("CrossChainPaymentReceiver deployed at:", address(receiver));

        // Add supported source chains (where payments come FROM)
        // Ethereum Sepolia
        receiver.addSupportedSourceChain(16015286601757825753);
        console.log("Added Ethereum Sepolia as source chain");
        
        // Avalanche Fuji
        receiver.addSupportedSourceChain(14767482510784806043);
        console.log("Added Avalanche Fuji as source chain");
        
        // Sonic Blaze
        receiver.addSupportedSourceChain(40109);
        console.log("Added Sonic Blaze as source chain");

        vm.stopBroadcast();
    }
}
