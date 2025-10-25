// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title RealCrossChainPayment
 * @dev Real cross-chain payment system for Monad Testnet
 * @notice This contract handles cross-chain payments using supported bridges
 */
contract RealCrossChainPayment is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Events
    event CrossChainPaymentInitiated(
        bytes32 indexed paymentId,
        uint256 indexed sourceChainId,
        address indexed sender,
        address recipient,
        address token,
        uint256 amount,
        string description,
        string bridgeProvider
    );

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
    error InsufficientAllowance();

    // Supported source chains
    mapping(uint256 => bool) public supportedSourceChains;
    
    // Payment tracking
    mapping(bytes32 => bool) public isPaymentProcessed;
    
    // Bridge providers
    mapping(string => bool) public supportedBridges;
    
    // Payment records
    struct PaymentRecord {
        bytes32 paymentId;
        uint256 sourceChainId;
        address sender;
        address recipient;
        address token;
        uint256 amount;
        string description;
        string bridgeProvider;
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

        // Initialize supported bridges
        supportedBridges["Orbiter"] = true;
        supportedBridges["Owlto"] = true;
        supportedBridges["Wormhole"] = true;
        supportedBridges["Axelar"] = true;
    }

    /**
     * @dev Initiate cross-chain payment
     * @param sourceChainId Source chain ID
     * @param recipient Recipient address on Monad
     * @param token Token address (0x0 for native MON)
     * @param amount Amount to transfer
     * @param description Payment description
     * @param bridgeProvider Bridge provider to use
     */
    function initiateCrossChainPayment(
        uint256 sourceChainId,
        address recipient,
        address token,
        uint256 amount,
        string calldata description,
        string calldata bridgeProvider
    ) external payable nonReentrant {
        if (!supportedSourceChains[sourceChainId]) {
            revert UnsupportedSourceChain(sourceChainId);
        }
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (!supportedBridges[bridgeProvider]) {
            revert("Unsupported bridge provider");
        }

        // Generate unique payment ID
        bytes32 paymentId = keccak256(abi.encodePacked(
            sourceChainId,
            msg.sender,
            recipient,
            token,
            amount,
            description,
            bridgeProvider,
            block.timestamp,
            block.number
        ));

        if (isPaymentProcessed[paymentId]) {
            revert PaymentAlreadyProcessed(paymentId);
        }

        // Handle token transfer
        if (token == address(0)) {
            // Native MON transfer
            if (msg.value < amount) {
                revert InsufficientBalance();
            }
            // Refund excess
            if (msg.value > amount) {
                payable(msg.sender).transfer(msg.value - amount);
            }
        } else {
            // ERC20 token transfer
            IERC20 tokenContract = IERC20(token);
            if (tokenContract.balanceOf(msg.sender) < amount) {
                revert InsufficientBalance();
            }
            if (tokenContract.allowance(msg.sender, address(this)) < amount) {
                revert InsufficientAllowance();
            }
            tokenContract.safeTransferFrom(msg.sender, address(this), amount);
        }

        // Record payment
        payments[paymentId] = PaymentRecord({
            paymentId: paymentId,
            sourceChainId: sourceChainId,
            sender: msg.sender,
            recipient: recipient,
            token: token,
            amount: amount,
            description: description,
            bridgeProvider: bridgeProvider,
            timestamp: block.timestamp,
            processed: false
        });

        isPaymentProcessed[paymentId] = true;

        emit CrossChainPaymentInitiated(
            paymentId,
            sourceChainId,
            msg.sender,
            recipient,
            token,
            amount,
            description,
            bridgeProvider
        );
    }

    /**
     * @dev Process cross-chain payment (called by bridge service)
     * @param paymentId Payment ID
     * @param sourceChainId Source chain ID
     * @param sender Original sender address
     * @param recipient Recipient address
     * @param token Token address
     * @param amount Amount
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

        // Transfer tokens to recipient
        if (token == address(0)) {
            // Native MON transfer
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
     * @dev Add supported bridge provider
     */
    function addSupportedBridge(string calldata bridgeProvider) external onlyOwner {
        supportedBridges[bridgeProvider] = true;
    }

    /**
     * @dev Remove supported bridge provider
     */
    function removeSupportedBridge(string calldata bridgeProvider) external onlyOwner {
        supportedBridges[bridgeProvider] = false;
    }

    /**
     * @dev Get payment record
     */
    function getPayment(bytes32 paymentId) external view returns (PaymentRecord memory) {
        return payments[paymentId];
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @dev Emergency function to withdraw stuck native MON
     */
    function withdrawNative(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    /**
     * @dev Allow contract to receive native MON
     */
    receive() external payable {}
    fallback() external payable {}
}
