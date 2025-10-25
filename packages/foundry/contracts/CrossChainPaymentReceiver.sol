// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CrossChainPaymentReceiver
 * @dev Receives cross-chain payments on Monad Testnet from other chains
 * @notice This contract receives payments that were initiated on other chains
 */
contract CrossChainPaymentReceiver is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event CrossChainPaymentReceived(
        bytes32 indexed paymentId,
        uint256 indexed sourceChainId,
        address indexed sender,
        address recipient,
        address token,
        uint256 amount,
        string description
    );

    // Custom errors
    error UnsupportedSourceChain(uint256 chainId);
    error InvalidRecipient();
    error InvalidAmount();
    error PaymentAlreadyProcessed(bytes32 paymentId);
    error InsufficientBalance();

    // Supported source chains
    mapping(uint256 => bool) public supportedSourceChains;
    
    // Payment tracking
    mapping(bytes32 => bool) public isPaymentProcessed;
    
    // Payment records
    struct PaymentRecord {
        bytes32 paymentId;
        uint256 sourceChainId;
        address sender;
        address recipient;
        address token;
        uint256 amount;
        string description;
        uint256 timestamp;
        bool processed;
    }
    
    mapping(bytes32 => PaymentRecord) public payments;

    // Chain IDs
    uint256 public constant ETHEREUM_SEPOLIA = 11155111;
    uint256 public constant AVALANCHE_FUJI = 43113;
    uint256 public constant POLYGON_AMOY = 80002;
    uint256 public constant ARBITRUM_SEPOLIA = 421614;
    uint256 public constant OPTIMISM_SEPOLIA = 11155420;

    constructor() Ownable(msg.sender) {
        // Initialize supported source chains
        supportedSourceChains[ETHEREUM_SEPOLIA] = true;
        supportedSourceChains[AVALANCHE_FUJI] = true;
        supportedSourceChains[POLYGON_AMOY] = true;
        supportedSourceChains[ARBITRUM_SEPOLIA] = true;
        supportedSourceChains[OPTIMISM_SEPOLIA] = true;
    }

    /**
     * @dev Process cross-chain payment (called by bridge service after tokens arrive)
     * @param paymentId Unique payment identifier
     * @param sourceChainId Source chain ID
     * @param sender Original sender address on source chain
     * @param recipient Recipient address on Monad
     * @param token Token address (0x0 for native ETH)
     * @param amount Amount to transfer
     * @param description Payment description
     */
    function processCrossChainPayment(
        bytes32 paymentId,
        uint256 sourceChainId,
        address sender,
        address recipient,
        address token,
        uint256 amount,
        string calldata description
    ) external onlyOwner nonReentrant {
        if (!supportedSourceChains[sourceChainId]) {
            revert UnsupportedSourceChain(sourceChainId);
        }
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        if (isPaymentProcessed[paymentId]) {
            revert PaymentAlreadyProcessed(paymentId);
        }
        isPaymentProcessed[paymentId] = true;

        // Record payment
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            sourceChainId: sourceChainId,
            sender: sender,
            recipient: recipient,
            token: token,
            amount: amount,
            description: description,
            timestamp: block.timestamp,
            processed: true
        });

        // Transfer tokens to recipient
        if (token == address(0)) {
            // Native ETH transfer
            if (address(this).balance < amount) {
                revert InsufficientBalance();
            }
            payable(recipient).transfer(amount);
        } else {
            // ERC20 token transfer
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit CrossChainPaymentReceived(
            paymentId,
            sourceChainId,
            sender,
            recipient,
            token,
            amount,
            description
        );
    }

    /**
     * @dev Add supported source chain
     */
    function addSupportedSourceChain(uint256 chainId) external onlyOwner {
        supportedSourceChains[chainId] = true;
    }

    /**
     * @dev Remove supported source chain
     */
    function removeSupportedSourceChain(uint256 chainId) external onlyOwner {
        supportedSourceChains[chainId] = false;
    }

    /**
     * @dev Get payment record
     */
    function getPayment(bytes32 paymentId) external view returns (PaymentRecord memory) {
        return payments[paymentId];
    }

    /**
     * @dev Emergency function to withdraw stuck ERC20 tokens
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Emergency function to withdraw stuck native ETH
     */
    function withdrawNative(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    /**
     * @dev Allow contract to receive native ETH (from bridge)
     */
    receive() external payable {}
    fallback() external payable {}
}