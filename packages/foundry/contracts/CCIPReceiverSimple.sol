// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CCIPReceiverSimple
 * @dev Simplified cross-chain payment receiver for MonadPay
 * @notice Receives and processes cross-chain payments from other chains
 */
contract CCIPReceiverSimple is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Supported source chains
    mapping(uint64 => bool) public supportedChains;
    
    // Trusted senders (source chain addresses)
    mapping(uint64 => mapping(address => bool)) public trustedSenders;
    
    // Events
    event CrossChainPaymentReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChain,
        address indexed sender,
        address recipient,
        address token,
        uint256 amount,
        string description
    );
    
    event ChainSupportUpdated(uint64 chainSelector, bool supported);
    event TrustedSenderUpdated(uint64 chainSelector, address sender, bool trusted);

    // Errors
    error UnsupportedChain(uint64 chainSelector);
    error UntrustedSender(uint64 chainSelector, address sender);
    error InvalidMessage();

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Handle incoming cross-chain message (simplified)
     * @param messageId Unique message identifier
     * @param sourceChainSelector Source chain selector
     * @param sender Sender address on source chain
     * @param messageData Encoded message data
     */
    function handleCrossChainMessage(
        bytes32 messageId,
        uint64 sourceChainSelector,
        address sender,
        bytes calldata messageData
    ) external nonReentrant {
        // Validate source chain
        if (!supportedChains[sourceChainSelector]) {
            revert UnsupportedChain(sourceChainSelector);
        }

        // Validate sender
        if (!trustedSenders[sourceChainSelector][sender]) {
            revert UntrustedSender(sourceChainSelector, sender);
        }

        // Decode message data
        (address recipient, address token, uint256 amount, string memory description) = 
            abi.decode(messageData, (address, address, uint256, string));

        // Validate decoded data
        if (recipient == address(0) || amount == 0) {
            revert InvalidMessage();
        }

        // Process token transfer if token is specified
        if (token != address(0)) {
            // For token transfers, transfer tokens to recipient
            IERC20(token).transfer(recipient, amount);
        } else {
            // For native token transfers, send ETH to recipient
            if (address(this).balance >= amount) {
                payable(recipient).transfer(amount);
            }
        }

        emit CrossChainPaymentReceived(
            messageId,
            sourceChainSelector,
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
    function addSupportedChain(uint64 chainSelector) external onlyOwner {
        supportedChains[chainSelector] = true;
        emit ChainSupportUpdated(chainSelector, true);
    }

    /**
     * @dev Remove supported source chain
     */
    function removeSupportedChain(uint64 chainSelector) external onlyOwner {
        supportedChains[chainSelector] = false;
        emit ChainSupportUpdated(chainSelector, false);
    }

    /**
     * @dev Add trusted sender for a specific chain
     */
    function addTrustedSender(uint64 chainSelector, address sender) external onlyOwner {
        trustedSenders[chainSelector][sender] = true;
        emit TrustedSenderUpdated(chainSelector, sender, true);
    }

    /**
     * @dev Remove trusted sender for a specific chain
     */
    function removeTrustedSender(uint64 chainSelector, address sender) external onlyOwner {
        trustedSenders[chainSelector][sender] = false;
        emit TrustedSenderUpdated(chainSelector, sender, false);
    }

    /**
     * @dev Emergency function to withdraw stuck tokens
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Emergency function to withdraw ETH
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}
