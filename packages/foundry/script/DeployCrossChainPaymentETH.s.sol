// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/CrossChainPaymentETH.sol";

contract DeployCrossChainPaymentETH is Script {
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

        // Deploy CrossChainPaymentETH
        CrossChainPaymentETH paymentContract = new CrossChainPaymentETH();
        console.log("CrossChainPaymentETH deployed at:", address(paymentContract));

        // Deposit some ETH to the contract for testing
        // This simulates having ETH available for cross-chain payments
        vm.deal(address(paymentContract), 10 ether);
        console.log("Deposited 10 ETH to contract for testing");

        vm.stopBroadcast();
    }
}
