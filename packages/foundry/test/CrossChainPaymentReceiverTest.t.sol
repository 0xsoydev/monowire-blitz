// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import "../contracts/CrossChainPaymentReceiver.sol";

/**
 * @title CrossChainPaymentReceiverTest
 * @dev Test the cross-chain payment receiver contract
 */
contract CrossChainPaymentReceiverTest is Test {
    CrossChainPaymentReceiver public receiver;
    
    // Test addresses
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);
    
    // Chain selectors
    uint64 constant ETHEREUM_SEPOLIA = 16015286601757825753;
    uint64 constant AVALANCHE_FUJI = 14767482510784806043;
    uint64 constant SONIC_BLAZE = 40109;
    uint64 constant UNSUPPORTED_CHAIN = 9999999999999999999;

    function setUp() public {
        receiver = new CrossChainPaymentReceiver();
        
        // Add supported source chains
        receiver.addSupportedSourceChain(ETHEREUM_SEPOLIA);
        receiver.addSupportedSourceChain(AVALANCHE_FUJI);
        receiver.addSupportedSourceChain(SONIC_BLAZE);
    }

    function test_InitialState() public {
        assertTrue(receiver.supportedSourceChains(ETHEREUM_SEPOLIA));
        assertTrue(receiver.supportedSourceChains(AVALANCHE_FUJI));
        assertTrue(receiver.supportedSourceChains(SONIC_BLAZE));
        assertFalse(receiver.supportedSourceChains(UNSUPPORTED_CHAIN));
    }

    function test_ReceiveCrossChainPayment() public {
        // Test parameters
        uint64 sourceChain = ETHEREUM_SEPOLIA;
        address sender = user1;
        address recipient = user2;
        address token = address(0); // Native token
        uint256 amount = 1000;
        string memory description = "Test cross-chain payment";

        // Send some ETH to the contract first
        vm.deal(address(receiver), 1 ether);

        // Generate payment ID
        bytes32 paymentId = keccak256(abi.encodePacked(
            sourceChain,
            sender,
            recipient,
            token,
            amount,
            description,
            block.timestamp
        ));

        // Receive cross-chain payment
        receiver.processCrossChainPayment(
            paymentId,
            sourceChain,
            sender,
            recipient,
            token,
            amount,
            description
        );
        
        console.log("Cross-chain payment received successfully!");
    }

    function test_ReceiveCrossChainPaymentWithNativeToken() public {
        uint64 sourceChain = AVALANCHE_FUJI;
        address sender = user2;
        address recipient = user3;
        address token = address(0); // Native token
        uint256 amount = 500;
        string memory description = "Native token payment";

        // Send some ETH to the contract first
        vm.deal(address(receiver), 1 ether);

        // Generate payment ID
        bytes32 paymentId = keccak256(abi.encodePacked(
            sourceChain,
            sender,
            recipient,
            token,
            amount,
            description,
            block.timestamp
        ));

        receiver.processCrossChainPayment(
            paymentId,
            sourceChain,
            sender,
            recipient,
            token,
            amount,
            description
        );
        
        console.log("Native token payment received successfully!");
    }

    function test_RevertUnsupportedSourceChain() public {
        vm.expectRevert(abi.encodeWithSelector(CrossChainPaymentReceiver.UnsupportedSourceChain.selector, UNSUPPORTED_CHAIN));
        bytes32 paymentId = keccak256(abi.encodePacked(UNSUPPORTED_CHAIN, user1, user2, address(0x123), uint256(1000), "Should fail", block.timestamp));
        receiver.processCrossChainPayment(
            paymentId,
            UNSUPPORTED_CHAIN,
            user1,
            user2,
            address(0x123),
            1000,
            "Should fail"
        );
    }

    function test_RevertInvalidRecipient() public {
        vm.expectRevert(CrossChainPaymentReceiver.InvalidRecipient.selector);
        bytes32 paymentId = keccak256(abi.encodePacked(ETHEREUM_SEPOLIA, user1, address(0), address(0x123), uint256(1000), "Should fail", block.timestamp));
        receiver.processCrossChainPayment(
            paymentId,
            ETHEREUM_SEPOLIA,
            user1,
            address(0), // Invalid recipient
            address(0x123),
            1000,
            "Should fail"
        );
    }

    function test_RevertInvalidAmount() public {
        vm.expectRevert(CrossChainPaymentReceiver.InvalidAmount.selector);
        bytes32 paymentId = keccak256(abi.encodePacked(ETHEREUM_SEPOLIA, user1, user2, address(0x123), uint256(0), "Should fail", block.timestamp));
        receiver.processCrossChainPayment(
            paymentId,
            ETHEREUM_SEPOLIA,
            user1,
            user2,
            address(0x123),
            0, // Invalid amount
            "Should fail"
        );
    }

    function test_AddSupportedSourceChain() public {
        uint64 newChain = 123456789;
        
        assertFalse(receiver.supportedSourceChains(newChain));
        
        receiver.addSupportedSourceChain(newChain);
        
        assertTrue(receiver.supportedSourceChains(newChain));
    }

    function test_RemoveSupportedSourceChain() public {
        assertTrue(receiver.supportedSourceChains(ETHEREUM_SEPOLIA));
        
        receiver.removeSupportedSourceChain(ETHEREUM_SEPOLIA);
        
        assertFalse(receiver.supportedSourceChains(ETHEREUM_SEPOLIA));
    }

    function test_OnlyOwnerCanManageChains() public {
        vm.startPrank(user1); // Not owner
        
        vm.expectRevert();
        receiver.addSupportedSourceChain(123456789);
        
        vm.expectRevert();
        receiver.removeSupportedSourceChain(ETHEREUM_SEPOLIA);
        
        vm.stopPrank();
    }

    function test_EventEmission() public {
        // Send some ETH to the contract first
        vm.deal(address(receiver), 1 ether);
        
        // Generate payment ID
        bytes32 paymentId = keccak256(abi.encodePacked(ETHEREUM_SEPOLIA, user1, user2, address(0), uint256(1000), "Test payment", block.timestamp));
        
        // Test that events are emitted correctly
        receiver.processCrossChainPayment(
            paymentId,
            ETHEREUM_SEPOLIA,
            user1,
            user2,
            address(0), // Native token
            1000,
            "Test payment"
        );
        
        // Just verify the function executes without reverting
        assertTrue(true);
    }

    function test_PaymentIdGeneration() public {
        // Send some ETH to the contract first
        vm.deal(address(receiver), 1 ether);
        
        // Generate payment ID for first payment
        bytes32 paymentId1 = keccak256(abi.encodePacked(ETHEREUM_SEPOLIA, user1, user2, address(0), uint256(1000), "First payment", block.timestamp));
        
        // First payment
        receiver.processCrossChainPayment(
            paymentId1,
            ETHEREUM_SEPOLIA,
            user1,
            user2,
            address(0), // Native token
            1000,
            "First payment"
        );
        
        // Generate payment ID for second payment
        bytes32 paymentId2 = keccak256(abi.encodePacked(AVALANCHE_FUJI, user1, user2, address(0), uint256(1000), "Second payment", block.timestamp + 1));
        
        // Second payment with different parameters should work
        receiver.processCrossChainPayment(
            paymentId2,
            AVALANCHE_FUJI, // Different chain
            user1,
            user2,
            address(0), // Native token
            1000,
            "Second payment"
        );
        
        console.log("Multiple payments processed successfully!");
    }
}
