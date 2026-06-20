// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentMarket.sol";

contract DeployScript is Script {
    address constant IDENTITY_REGISTRY = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address constant REPUTATION_REGISTRY = 0x8004B663056A597Dffe9eCcC1965A193B7388713;
    address constant PYTH = 0x2880aB155794e7179c9eE2e38200202908C17B43;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        AgentMarket market = new AgentMarket(IDENTITY_REGISTRY, REPUTATION_REGISTRY, PYTH);
        vm.stopBroadcast();

        console.log("AgentMarket deployed at:", address(market));
    }
}
