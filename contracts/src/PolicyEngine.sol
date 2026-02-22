// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PolicyEngine is Ownable, ReentrancyGuard {
    
    struct SpendingLimit {
        uint256 dailyLimit;
        uint256 weeklyLimit;
        uint256 dailySpent;
        uint256 weeklySpent;
        uint256 lastDailyReset;
        uint256 lastWeeklyReset;
    }
    
    struct Policy {
        bool isActive;
        SpendingLimit limits;
        mapping(address => bool) allowedTokens;
        mapping(address => bool) allowedContracts;
        mapping(bytes4 => bool) allowedFunctions;
        uint256 requireApprovalAbove;
        address[] tokenList;
        address[] contractList;
    }
    
    mapping(address => Policy) public policies;
    
    event PolicyCreated(address indexed wallet);
    event PolicyUpdated(address indexed wallet, string parameter);
    event ExecutionRecorded(address indexed wallet, address target, uint256 value);
    
    error PolicyNotActive();
    error DailyLimitExceeded();
    error WeeklyLimitExceeded();
    error TokenNotAllowed();
    error ContractNotAllowed();
    error FunctionNotAllowed();
    error ApprovalRequired();
    error NotWalletOwner();
    
    constructor() Ownable(msg.sender) {}
    
    function createPolicy(
        address wallet,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        address[] calldata allowedTokens,
        address[] calldata allowedContracts,
        uint256 requireApprovalAbove
    ) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        
        Policy storage policy = policies[wallet];
        policy.isActive = true;
        policy.limits.dailyLimit = dailyLimit;
        policy.limits.weeklyLimit = weeklyLimit;
        policy.limits.lastDailyReset = block.timestamp;
        policy.limits.lastWeeklyReset = block.timestamp;
        policy.requireApprovalAbove = requireApprovalAbove;
        
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            policy.allowedTokens[allowedTokens[i]] = true;
            policy.tokenList.push(allowedTokens[i]);
        }
        
        for (uint256 i = 0; i < allowedContracts.length; i++) {
            policy.allowedContracts[allowedContracts[i]] = true;
            policy.contractList.push(allowedContracts[i]);
        }
        
        emit PolicyCreated(wallet);
    }
    
    function canExecute(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (bool) {
        Policy storage policy = policies[wallet];
        
        if (!policy.isActive) return true;
        
        uint256 totalValue = value + _decodeTokenAmount(data);
        
        (uint256 dailyRemaining, uint256 weeklyRemaining) = _getRemainingLimits(wallet);
        
        if (policy.limits.dailyLimit > 0 && totalValue > dailyRemaining) {
            revert DailyLimitExceeded();
        }
        
        if (policy.limits.weeklyLimit > 0 && totalValue > weeklyRemaining) {
            revert WeeklyLimitExceeded();
        }
        
        if (policy.tokenList.length > 0 && _isTokenTransfer(data)) {
            if (!policy.allowedTokens[target]) revert TokenNotAllowed();
        }
        
        if (policy.contractList.length > 0) {
            if (!policy.allowedContracts[target]) revert ContractNotAllowed();
        }
        
        if (policy.requireApprovalAbove > 0 && totalValue > policy.requireApprovalAbove) {
            revert ApprovalRequired();
        }
        
        return true;
    }
    
    function recordExecution(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data
    ) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        
        Policy storage policy = policies[wallet];
        if (!policy.isActive) return;
        
        _resetLimitsIfNeeded(wallet);
        
        uint256 totalValue = value + _decodeTokenAmount(data);
        policy.limits.dailySpent += totalValue;
        policy.limits.weeklySpent += totalValue;
        
        emit ExecutionRecorded(wallet, target, value);
    }
    
    function _getRemainingLimits(address wallet) internal view returns (uint256 dailyRemaining, uint256 weeklyRemaining) {
        Policy storage policy = policies[wallet];
        
        uint256 dailySpent = policy.limits.dailySpent;
        uint256 weeklySpent = policy.limits.weeklySpent;
        
        if (block.timestamp >= policy.limits.lastDailyReset + 1 days) {
            dailySpent = 0;
        }
        
        if (block.timestamp >= policy.limits.lastWeeklyReset + 7 days) {
            weeklySpent = 0;
        }
        
        dailyRemaining = policy.limits.dailyLimit > dailySpent 
            ? policy.limits.dailyLimit - dailySpent 
            : 0;
        weeklyRemaining = policy.limits.weeklyLimit > weeklySpent 
            ? policy.limits.weeklyLimit - weeklySpent 
            : 0;
    }
    
    function _resetLimitsIfNeeded(address wallet) internal {
        Policy storage policy = policies[wallet];
        
        if (block.timestamp >= policy.limits.lastDailyReset + 1 days) {
            policy.limits.dailySpent = 0;
            policy.limits.lastDailyReset = block.timestamp;
        }
        
        if (block.timestamp >= policy.limits.lastWeeklyReset + 7 days) {
            policy.limits.weeklySpent = 0;
            policy.limits.lastWeeklyReset = block.timestamp;
        }
    }
    
    function updateDailyLimit(address wallet, uint256 newLimit) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        policies[wallet].limits.dailyLimit = newLimit;
        emit PolicyUpdated(wallet, "dailyLimit");
    }
    
    function updateWeeklyLimit(address wallet, uint256 newLimit) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        policies[wallet].limits.weeklyLimit = newLimit;
        emit PolicyUpdated(wallet, "weeklyLimit");
    }
    
    function updateApprovalThreshold(address wallet, uint256 threshold) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        policies[wallet].requireApprovalAbove = threshold;
        emit PolicyUpdated(wallet, "requireApprovalAbove");
    }
    
    function addAllowedToken(address wallet, address token) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        policies[wallet].allowedTokens[token] = true;
        policies[wallet].tokenList.push(token);
        emit PolicyUpdated(wallet, "allowedToken");
    }
    
    function addAllowedContract(address wallet, address contractAddr) external {
        if (msg.sender != wallet) revert NotWalletOwner();
        policies[wallet].allowedContracts[contractAddr] = true;
        policies[wallet].contractList.push(contractAddr);
        emit PolicyUpdated(wallet, "allowedContract");
    }
    
    function getPolicy(address wallet) external view returns (
        bool isActive,
        uint256 dailyLimit,
        uint256 weeklyLimit,
        uint256 dailySpent,
        uint256 weeklySpent,
        uint256 requireApprovalAbove
    ) {
        Policy storage policy = policies[wallet];
        return (
            policy.isActive,
            policy.limits.dailyLimit,
            policy.limits.weeklyLimit,
            policy.limits.dailySpent,
            policy.limits.weeklySpent,
            policy.requireApprovalAbove
        );
    }
    
    function getRemainingLimits(address wallet) external view returns (
        uint256 dailyRemaining,
        uint256 weeklyRemaining
    ) {
        return _getRemainingLimits(wallet);
    }
    
    function _decodeTokenAmount(bytes calldata data) internal pure returns (uint256) {
        if (data.length < 68) return 0;
        
        bytes4 selector = bytes4(data[:4]);
        
        if (selector == bytes4(keccak256("transfer(address,uint256)"))) {
            return abi.decode(data[36:], (uint256));
        }
        
        if (selector == bytes4(keccak256("transferFrom(address,address,uint256)"))) {
            return abi.decode(data[68:], (uint256));
        }
        
        return 0;
    }
    
    function _isTokenTransfer(bytes calldata data) internal pure returns (bool) {
        if (data.length < 4) return false;
        bytes4 selector = bytes4(data[:4]);
        return selector == bytes4(keccak256("transfer(address,uint256)")) ||
               selector == bytes4(keccak256("transferFrom(address,address,uint256)"));
    }
}
