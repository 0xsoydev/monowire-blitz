// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/SimpleCrossChainPayment.sol";

contract DeploySimpleCrossChain is Script {
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

        // Deploy SimpleCrossChainPayment
        SimpleCrossChainPayment paymentContract = new SimpleCrossChainPayment();
        console.log("SimpleCrossChainPayment deployed at:", address(paymentContract));

        // Add supported tokens (USDC on Monad Testnet)
        address usdcAddress = 0xf817257fed379853cDe0fa4F97AB987181B1E5Ea;
        paymentContract.addSupportedToken(usdcAddress);
        console.log("Added USDC as supported token:", usdcAddress);

        // Add native ETH/MON support
        paymentContract.addSupportedToken(address(0));
        console.log("Added native ETH/MON as supported token");

        vm.stopBroadcast();
    }
}
