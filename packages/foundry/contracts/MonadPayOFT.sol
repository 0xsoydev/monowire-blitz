// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MonadPayOFT
 * @dev Simplified OFT for cross-chain payments in MonadPay
 * @notice This token enables cross-chain payments between Monad Testnet and other chains
 * @dev This is a simplified version that implements basic ERC20 functionality
 *      In a real implementation, this would inherit from LayerZero's OFT contract
 */
contract MonadPayOFT is ERC20, Ownable {
    // LayerZero endpoint address (placeholder - would be real in production)
    address public immutable endpoint;
    
    // Cross-chain payment tracking
    mapping(bytes32 => bool) public crossChainTransfers;
    
    // Events
    event CrossChainTransferInitiated(
        bytes32 indexed transferId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint32 destinationChainId
    );
    
    event CrossChainTransferCompleted(
        bytes32 indexed transferId,
        address indexed from,
        address indexed to,
        uint256 amount,
        uint32 sourceChainId
    );

    constructor(
        string memory name,
        string memory symbol,
        address _endpoint
    ) ERC20(name, symbol) Ownable(msg.sender) {
        endpoint = _endpoint;
    }

    /**
     * @dev Mint tokens to a specific address (for testing purposes)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from a specific address
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    /**
     * @dev Initiate cross-chain transfer (simplified version)
     * @param to Recipient address on destination chain
     * @param amount Amount to transfer
     * @param destinationChainId Destination chain ID
     */
    function initiateCrossChainTransfer(
        address to,
        uint256 amount,
        uint32 destinationChainId
    ) external returns (bytes32 transferId) {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Generate unique transfer ID
        transferId = keccak256(abi.encodePacked(
            msg.sender,
            to,
            amount,
            destinationChainId,
            block.timestamp,
            block.number
        ));
        
        require(!crossChainTransfers[transferId], "Transfer already initiated");
        crossChainTransfers[transferId] = true;
        
        // Burn tokens from sender (they will be minted on destination chain)
        _burn(msg.sender, amount);
        
        emit CrossChainTransferInitiated(
            transferId,
            msg.sender,
            to,
            amount,
            destinationChainId
        );
    }

    /**
     * @dev Complete cross-chain transfer (called by LayerZero or admin)
     * @param transferId Transfer ID
     * @param to Recipient address
     * @param amount Amount to mint
     * @param sourceChainId Source chain ID
     */
    function completeCrossChainTransfer(
        bytes32 transferId,
        address to,
        uint256 amount,
        uint32 sourceChainId
    ) external onlyOwner {
        require(!crossChainTransfers[transferId], "Transfer already completed");
        crossChainTransfers[transferId] = true;
        
        // Mint tokens to recipient
        _mint(to, amount);
        
        emit CrossChainTransferCompleted(
            transferId,
            address(0), // Original sender (not available in this simplified version)
            to,
            amount,
            sourceChainId
        );
    }

    /**
     * @dev Get cross-chain transfer status
     */
    function isTransferCompleted(bytes32 transferId) external view returns (bool) {
        return crossChainTransfers[transferId];
    }
}