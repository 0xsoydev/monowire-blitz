// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SimpleCrossChainPayment
 * @dev Simplified cross-chain payment system for MonadPay
 * @notice Enables cross-chain payment requests and tracking
 */
contract SimpleCrossChainPayment is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event CrossChainPaymentRequested(
        bytes32 indexed paymentId,
        address indexed recipient,
        uint256 amount,
        uint32 destinationChainId,
        address token,
        string description
    );

    event CrossChainPaymentReceived(
        bytes32 indexed paymentId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint32 sourceChainId,
        address token,
        string description
    );

    // Custom errors
    error InvalidRecipient();
    error InvalidAmount();
    error PaymentAlreadyProcessed(bytes32 paymentId);
    error UnsupportedChain(uint32 chainId);
    error UnsupportedToken(address token);

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
        address token;
        string description;
        uint256 timestamp;
        bool processed;
    }
    
    mapping(bytes32 => PaymentRecord) public payments;

    // Supported destination chains
    mapping(uint32 => bool) public supportedChains;
    
    // Supported tokens
    mapping(address => bool) public supportedTokens;

    // Chain IDs
    uint32 public constant MONAD_TESTNET = 10143;
    uint32 public constant ETHEREUM_SEPOLIA = 11155111;
    uint32 public constant OPTIMISM_SEPOLIA = 11155420;
    uint32 public constant ARBITRUM_SEPOLIA = 421614;
    uint32 public constant POLYGON_AMOY = 80002;
    uint32 public constant AVALANCHE_FUJI = 43113;

    constructor() Ownable(msg.sender) {
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
     * @param amount Amount of tokens to send
     * @param destinationChainId Destination chain ID
     * @param token Token address (address(0) for native ETH/MON)
     * @param description Payment description
     */
    function requestCrossChainPayment(
        address recipient,
        uint256 amount,
        uint32 destinationChainId,
        address token,
        string calldata description
    ) external nonReentrant returns (bytes32 paymentId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (!supportedChains[destinationChainId]) revert UnsupportedChain(destinationChainId);
        if (token != address(0) && !supportedTokens[token]) revert UnsupportedToken(token);

        // Generate unique payment ID
        paymentId = keccak256(abi.encodePacked(
            msg.sender,
            recipient,
            amount,
            destinationChainId,
            token,
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
            token: token,
            description: description,
            timestamp: block.timestamp,
            processed: false
        });

        emit CrossChainPaymentRequested(
            paymentId,
            recipient,
            amount,
            destinationChainId,
            token,
            description
        );
    }

    /**
     * @dev Process received cross-chain payment (called by bridge or admin)
     * @param paymentId Payment ID
     * @param sender Original sender address
     * @param recipient Recipient address
     * @param amount Amount received
     * @param sourceChainId Source chain ID
     * @param token Token address
     * @param description Payment description
     */
    function processReceivedPayment(
        bytes32 paymentId,
        address sender,
        address recipient,
        uint256 amount,
        uint32 sourceChainId,
        address token,
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
            token: token,
            description: description,
            timestamp: block.timestamp,
            processed: true
        });

        emit CrossChainPaymentReceived(
            paymentId,
            sender,
            recipient,
            amount,
            sourceChainId,
            token,
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
     * @dev Add supported token
     */
    function addSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = true;
    }

    /**
     * @dev Remove supported token
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @dev Emergency function to withdraw stuck ERC20 tokens
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Emergency function to withdraw stuck native ETH/MON
     */
    function withdrawNative(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    /**
     * @dev Receive function to accept native ETH/MON
     */
    receive() external payable {}
}
