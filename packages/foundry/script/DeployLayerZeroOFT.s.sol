// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MonadPayOFT.sol";
import "../contracts/CrossChainPaymentOFT.sol";

contract DeployLayerZeroOFT is Script {
    // LayerZero endpoint addresses (placeholder - would be real in production)
    address constant MONAD_TESTNET_ENDPOINT = 0x6EDCE65403992e310A62460808c4b910D972f10f;
    
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

        // Deploy MonadPayOFT
        MonadPayOFT oft = new MonadPayOFT(
            "MonadPay Token",
            "MPT",
            MONAD_TESTNET_ENDPOINT
        );
        console.log("MonadPayOFT deployed at:", address(oft));

        // Deploy CrossChainPaymentOFT
        CrossChainPaymentOFT paymentContract = new CrossChainPaymentOFT(address(oft));
        console.log("CrossChainPaymentOFT deployed at:", address(paymentContract));

        // Mint initial tokens to deployer for testing
        oft.mint(msg.sender, 1000000 * 10**18); // 1M tokens
        console.log("Minted 1M MPT tokens to deployer");

        vm.stopBroadcast();
    }
}