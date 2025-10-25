// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/RealCrossChainPayment.sol";

contract DeployRealCrossChainPayment is Script {
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

        RealCrossChainPayment realCrossChainPayment = new RealCrossChainPayment();

        console.log("RealCrossChainPayment deployed at:", address(realCrossChainPayment));
        console.log("Supported source chains:");
        console.log("- Ethereum Sepolia (11155111)");
        console.log("- Avalanche Fuji (43113)");
        console.log("- Polygon Amoy (80002)");
        console.log("- Arbitrum Sepolia (421614)");
        console.log("- Optimism Sepolia (11155420)");
        console.log("Supported bridges:");
        console.log("- Orbiter Finance");
        console.log("- Owlto Finance");
        console.log("- Wormhole");
        console.log("- Axelar");

        vm.stopBroadcast();
    }
}
