// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CrossChainPayment
 * @dev Simplified cross-chain payment contract for MonadPay
 * @notice This is a demonstration contract showing cross-chain payment structure
 */
contract CrossChainPayment is Ownable, ReentrancyGuard {
    
    // Supported destination chains
    mapping(uint64 => bool) public supportedChains;
    
    // Events
    event CrossChainPaymentSent(
        bytes32 indexed messageId,
        uint64 destinationChain,
        address indexed recipient,
        address token,
        uint256 amount,
        string description
    );
    
    event ChainSupportUpdated(uint64 chainSelector, bool supported);
    
    // Errors
    error UnsupportedChain(uint64 chainSelector);
    error InvalidRecipient();
    error InvalidAmount();

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Send cross-chain payment (simplified for demonstration)
     * @param destinationChainSelector Chain selector of destination chain
     * @param recipient Address on destination chain to receive payment
     * @param token Token address to send (0x0 for native token)
     * @param amount Amount to send
     * @param description Payment description
     */
    function sendCrossChainPayment(
        uint64 destinationChainSelector,
        address recipient,
        address token,
        uint256 amount,
        string calldata description
    ) external payable nonReentrant {
        if (!supportedChains[destinationChainSelector]) {
            revert UnsupportedChain(destinationChainSelector);
        }
        
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }
        
        if (amount == 0) {
            revert InvalidAmount();
        }

        // Generate a mock message ID for demonstration
        bytes32 messageId = keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            destinationChainSelector,
            recipient,
            amount
        ));

        emit CrossChainPaymentSent(
            messageId,
            destinationChainSelector,
            recipient,
            token,
            amount,
            description
        );
    }

    /**
     * @dev Add supported destination chain
     */
    function addSupportedChain(uint64 chainSelector) external onlyOwner {
        supportedChains[chainSelector] = true;
        emit ChainSupportUpdated(chainSelector, true);
    }

    /**
     * @dev Remove supported destination chain
     */
    function removeSupportedChain(uint64 chainSelector) external onlyOwner {
        supportedChains[chainSelector] = false;
        emit ChainSupportUpdated(chainSelector, false);
    }

    /**
     * @dev Get supported chains
     */
    function isChainSupported(uint64 chainSelector) external view returns (bool) {
        return supportedChains[chainSelector];
    }
}
