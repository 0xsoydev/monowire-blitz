// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { MonadPayOFT } from "./MonadPayOFT.sol";

/**
 * @title CrossChainPaymentOFT
 * @dev Cross-chain payment system using simplified OFT
 * @notice Enables cross-chain payments between Monad Testnet and other chains
 */
contract CrossChainPaymentOFT is Ownable, ReentrancyGuard {
    // Events
    event CrossChainPaymentRequested(
        bytes32 indexed paymentId,
        address indexed recipient,
        uint256 amount,
        uint32 destinationChainId,
        string description
    );

    event CrossChainPaymentReceived(
        bytes32 indexed paymentId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint32 sourceChainId,
        string description
    );

    // Custom errors
    error InvalidRecipient();
    error InvalidAmount();
    error PaymentAlreadyProcessed(bytes32 paymentId);
    error InsufficientBalance();
    error UnsupportedChain(uint32 chainId);

    // Payment tracking
    mapping(bytes32 => bool) public isPaymentProcessed;
    
    // Payment records
    struct PaymentRecord {
        bytes32 paymentId;
        address sender;
        address recipient;
        uint256 amount;
        uint32 sourceChainId;
        uint32 destinationChainId;
        string description;
        uint256 timestamp;
        bool processed;
    }
    
    mapping(bytes32 => PaymentRecord) public payments;

    // LayerZero OFT contract
    MonadPayOFT public immutable oft;

    // Supported destination chains
    mapping(uint32 => bool) public supportedChains;

    // Chain IDs
    uint32 public constant MONAD_TESTNET = 10143;
    uint32 public constant ETHEREUM_SEPOLIA = 11155111;
    uint32 public constant OPTIMISM_SEPOLIA = 11155420;
    uint32 public constant ARBITRUM_SEPOLIA = 421614;
    uint32 public constant POLYGON_AMOY = 80002;
    uint32 public constant AVALANCHE_FUJI = 43113;

    constructor(address _oft) Ownable(msg.sender) {
        oft = MonadPayOFT(_oft);
        
        // Initialize supported chains
        supportedChains[ETHEREUM_SEPOLIA] = true;
        supportedChains[OPTIMISM_SEPOLIA] = true;
        supportedChains[ARBITRUM_SEPOLIA] = true;
        supportedChains[POLYGON_AMOY] = true;
        supportedChains[AVALANCHE_FUJI] = true;
    }

    /**
     * @dev Request a cross-chain payment
     * @param recipient Address to receive payment on destination chain
     * @param amount Amount of OFT tokens to send
     * @param destinationChainId Destination chain ID
     * @param description Payment description
     */
    function requestCrossChainPayment(
        address recipient,
        uint256 amount,
        uint32 destinationChainId,
        string calldata description
    ) external nonReentrant returns (bytes32 paymentId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (!supportedChains[destinationChainId]) revert UnsupportedChain(destinationChainId);

        // Generate unique payment ID
        paymentId = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            amount,
            destinationChainId,
            description,
            block.timestamp,
            block.number
        ));

        if (isPaymentProcessed[paymentId]) {
            revert PaymentAlreadyProcessed(paymentId);
        }

        // Record payment request
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            sourceChainId: MONAD_TESTNET,
            destinationChainId: destinationChainId,
            description: description,
            timestamp: block.timestamp,
            processed: false
        });

        emit CrossChainPaymentRequested(
            paymentId,
            recipient,
            amount,
            destinationChainId,
            description
        );
    }

    /**
     * @dev Send cross-chain payment using OFT
     * @param recipient Recipient address on destination chain
     * @param amount Amount to send
     * @param destinationChainId Destination chain ID
     * @param paymentId Payment ID for tracking
     */
    function sendCrossChainPayment(
        address recipient,
        uint256 amount,
        uint32 destinationChainId,
        bytes32 paymentId
    ) external nonReentrant {
        // Verify payment exists and is not processed
        PaymentRecord storage payment = payments[paymentId];
        if (payment.paymentId == bytes32(0)) revert InvalidRecipient();
        if (isPaymentProcessed[paymentId]) revert PaymentAlreadyProcessed(paymentId);

        // Check if sender has enough OFT tokens
        if (oft.balanceOf(msg.sender) < amount) {
            revert InsufficientBalance();
        }

        // Mark payment as processed
        isPaymentProcessed[paymentId] = true;
        payment.processed = true;

        // Initiate cross-chain transfer using OFT
        oft.initiateCrossChainTransfer(recipient, amount, destinationChainId);
    }

    /**
     * @dev Process received cross-chain payment (called by LayerZero or admin)
     * @param paymentId Payment ID
     * @param sender Original sender address
     * @param recipient Recipient address
     * @param amount Amount received
     * @param sourceChainId Source chain ID
     * @param description Payment description
     */
    function processReceivedPayment(
        bytes32 paymentId,
        address sender,
        address recipient,
        uint256 amount,
        uint32 sourceChainId,
        string calldata description
    ) external onlyOwner {
        if (isPaymentProcessed[paymentId]) {
            revert PaymentAlreadyProcessed(paymentId);
        }
        isPaymentProcessed[paymentId] = true;

        // Record received payment
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            sender: sender,
            recipient: recipient,
            amount: amount,
            sourceChainId: sourceChainId,
            destinationChainId: MONAD_TESTNET,
            description: description,
            timestamp: block.timestamp,
            processed: true
        });

        // Complete the cross-chain transfer (mint tokens to recipient)
        oft.completeCrossChainTransfer(paymentId, recipient, amount, sourceChainId);

        emit CrossChainPaymentReceived(
            paymentId,
            sender,
            recipient,
            amount,
            sourceChainId,
            description
        );
    }

    /**
     * @dev Get payment record
     */
    function getPayment(bytes32 paymentId) external view returns (PaymentRecord memory) {
        return payments[paymentId];
    }

    /**
     * @dev Add supported destination chain
     */
    function addSupportedChain(uint32 chainId) external onlyOwner {
        supportedChains[chainId] = true;
    }

    /**
     * @dev Remove supported destination chain
     */
    function removeSupportedChain(uint32 chainId) external onlyOwner {
        supportedChains[chainId] = false;
    }

    /**
     * @dev Emergency function to withdraw stuck ETH
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }
}