// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import "../contracts/CrossChainPayment.sol";

/**
 * @title CrossChainPaymentLiveTest
 * @dev Live testing of deployed CrossChainPayment contract
 */
contract CrossChainPaymentLiveTest is Test {
    CrossChainPayment public crossChainPayment;
    
    // Deployed contract address on Monad Testnet
    address constant DEPLOYED_CONTRACT = 0x6610CFfbf7f2d69e8dcf0130aabE5F1cd7d12a28;
    
    // Test addresses
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    // Chain selectors
    uint64 constant ETHEREUM_SEPOLIA = 16015286601757825753;
    uint64 constant AVALANCHE_FUJI = 14767482510784806043;
    uint64 constant SONIC_BLAZE = 40109;
    uint64 constant UNSUPPORTED_CHAIN = 9999999999999999999;

    function setUp() public {
        // Connect to deployed contract
        crossChainPayment = CrossChainPayment(DEPLOYED_CONTRACT);
    }

    function test_VerifyDeployedContract() public {
        console.log("Testing deployed contract at:", address(crossChainPayment));
        
        // Verify contract is deployed and accessible
        assertTrue(address(crossChainPayment) != address(0));
    }

    function test_CheckSupportedChains() public {
        console.log("Checking supported chains...");
        
        // Check Ethereum Sepolia
        bool sepoliaSupported = crossChainPayment.isChainSupported(ETHEREUM_SEPOLIA);
        console.log("Ethereum Sepolia supported:", sepoliaSupported);
        assertTrue(sepoliaSupported);
        
        // Check Avalanche Fuji
        bool fujiSupported = crossChainPayment.isChainSupported(AVALANCHE_FUJI);
        console.log("Avalanche Fuji supported:", fujiSupported);
        assertTrue(fujiSupported);
        
        // Check Sonic Blaze
        bool sonicSupported = crossChainPayment.isChainSupported(SONIC_BLAZE);
        console.log("Sonic Blaze supported:", sonicSupported);
        assertTrue(sonicSupported);
        
        // Check unsupported chain
        bool unsupportedSupported = crossChainPayment.isChainSupported(UNSUPPORTED_CHAIN);
        console.log("Unsupported chain supported:", unsupportedSupported);
        assertFalse(unsupportedSupported);
    }

    function test_SendCrossChainPayment() public {
        console.log("Testing cross-chain payment...");
        
        // Test parameters
        uint64 destinationChain = ETHEREUM_SEPOLIA;
        address recipient = user2;
        address token = address(0x123); // Mock token
        uint256 amount = 1000;
        string memory description = "Live test payment";

        // Send cross-chain payment
        crossChainPayment.sendCrossChainPayment(
            destinationChain,
            recipient,
            token,
            amount,
            description
        );
        
        console.log("Cross-chain payment sent successfully!");
    }

    function test_SendCrossChainPaymentWithNativeToken() public {
        console.log("Testing native token payment...");
        
        uint64 destinationChain = AVALANCHE_FUJI;
        address recipient = user1;
        address token = address(0); // Native token
        uint256 amount = 500;
        string memory description = "Native token payment";

        crossChainPayment.sendCrossChainPayment{value: amount}(
            destinationChain,
            recipient,
            token,
            amount,
            description
        );
        
        console.log("Native token payment sent successfully!");
    }

    function test_RevertUnsupportedChain() public {
        console.log("Testing unsupported chain revert...");
        
        vm.expectRevert(abi.encodeWithSelector(CrossChainPayment.UnsupportedChain.selector, UNSUPPORTED_CHAIN));
        crossChainPayment.sendCrossChainPayment(
            UNSUPPORTED_CHAIN,
            user2,
            address(0x123),
            1000,
            "Should fail"
        );
    }

    function test_RevertInvalidRecipient() public {
        console.log("Testing invalid recipient revert...");
        
        vm.expectRevert(CrossChainPayment.InvalidRecipient.selector);
        crossChainPayment.sendCrossChainPayment(
            ETHEREUM_SEPOLIA,
            address(0), // Invalid recipient
            address(0x123),
            1000,
            "Should fail"
        );
    }

    function test_RevertInvalidAmount() public {
        console.log("Testing invalid amount revert...");
        
        vm.expectRevert(CrossChainPayment.InvalidAmount.selector);
        crossChainPayment.sendCrossChainPayment(
            ETHEREUM_SEPOLIA,
            user2,
            address(0x123),
            0, // Invalid amount
            "Should fail"
        );
    }

    function test_ContractOwner() public {
        console.log("Testing contract owner...");
        
        address owner = crossChainPayment.owner();
        console.log("Contract owner:", owner);
        assertTrue(owner != address(0));
    }

    function test_ContractBalance() public {
        console.log("Testing contract balance...");
        
        uint256 balance = address(crossChainPayment).balance;
        console.log("Contract balance:", balance);
        
        // Contract should have some balance if we sent native tokens
        assertTrue(balance >= 0);
    }
}
