// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/MonadPayWithSwap.sol";

contract DeployMonadPayWithSwap is Script {
    function run() external {
        // Read private key as string to handle both with and without 0x prefix
        string memory pkString = vm.envString("DEPLOYER_PRIVATE_KEY");
        
        // Convert to uint256
        uint256 deployerPrivateKey;
        
        // Check if the key starts with 0x
        bytes memory pkBytes = bytes(pkString);
        if (pkBytes.length >= 2 && pkBytes[0] == "0" && pkBytes[1] == "x") {
            // Has 0x prefix, parse as is
            deployerPrivateKey = vm.parseUint(pkString);
        } else {
            // No prefix, add it
            deployerPrivateKey = vm.parseUint(string.concat("0x", pkString));
        }
        
        vm.startBroadcast(deployerPrivateKey);

        // Uniswap V2 Router on Monad Testnet
        address uniswapRouter = 0xfB8e1C3b833f9E67a71C859a132cf783b645e436; // UniswapV2Router02
        
        // Wrapped MON on Monad Testnet
        address wmon = 0x760AFe86e5d5Fa0EE542F7B713713E1c0dd59701; // WrappedMonad

        MonadPayWithSwap monadPayWithSwap = new MonadPayWithSwap(uniswapRouter, wmon);
        console.log("MonadPayWithSwap deployed at:", address(monadPayWithSwap));
        console.log("Configured with Uniswap Router:", uniswapRouter);
        console.log("Configured with WMON:", wmon);

        vm.stopBroadcast();
    }
}

