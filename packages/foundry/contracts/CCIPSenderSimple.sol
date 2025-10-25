// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// CCIP Router interface (simplified)
interface IRouterClient {
    function ccipSend(uint64 destinationChainSelector, bytes calldata message) external returns (bytes32);
    function getFee(uint64 destinationChainSelector, bytes calldata message) external view returns (uint256);
}

/**
 * @title CCIPSenderSimple
 * @dev Simplified cross-chain payment sender for MonadPay
 * @notice Enables sending payments across chains using Chainlink CCIP
 */
contract CCIPSenderSimple is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Router for sending cross-chain messages
    IRouterClient public immutable router;
    
    // Supported destination chains
    mapping(uint64 => bool) public supportedChains;
    
    // Fee token (LINK token for CCIP fees)
    IERC20 public immutable feeToken;
    
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
    error InsufficientFeeTokenBalance(uint256 required, uint256 available);
    error InvalidRecipient();
    error InvalidAmount();

    constructor(
        address _router,
        address _feeToken
    ) Ownable(msg.sender) {
        router = IRouterClient(_router);
        feeToken = IERC20(_feeToken);
    }

    /**
     * @dev Send cross-chain payment
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

        // Build CCIP message (simplified)
        bytes memory message = abi.encode(
            recipient,
            token,
            amount,
            description
        );

        // Get fee
        uint256 fee = router.getFee(destinationChainSelector, message);
        
        // Check and handle fee payment
        if (feeToken.balanceOf(address(this)) < fee) {
            revert InsufficientFeeTokenBalance(fee, feeToken.balanceOf(address(this)));
        }
        
        // Approve router to spend fee tokens
        feeToken.approve(address(router), fee);

        // Send cross-chain message
        bytes32 messageId = router.ccipSend(destinationChainSelector, message);

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
     * @dev Withdraw fee tokens (emergency function)
     */
    function withdrawFeeTokens(uint256 amount) external onlyOwner {
        feeToken.transfer(owner(), amount);
    }

    /**
     * @dev Get CCIP fee for cross-chain payment
     */
    function getCrossChainFee(
        uint64 destinationChainSelector,
        address recipient,
        address token,
        uint256 amount,
        string calldata description
    ) external view returns (uint256) {
        bytes memory message = abi.encode(
            recipient,
            token,
            amount,
            description
        );

        return router.getFee(destinationChainSelector, message);
    }
}