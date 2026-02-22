// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPolicyEngine {
    function canExecute(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data
    ) external view returns (bool);
    
    function recordExecution(
        address wallet,
        address target,
        uint256 value,
        bytes calldata data
    ) external;
}

contract AgentWallet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    address public agent;
    address public policyEngine;
    address public pendingAgent;
    uint256 public constant AGENT_CHANGE_DELAY = 24 hours;
    uint256 public agentChangeInitiated;
    
    event AgentSet(address indexed oldAgent, address indexed newAgent);
    event AgentChangeInitiated(address indexed pendingAgent, uint256 timestamp);
    event Executed(address indexed target, uint256 value, bytes data);
    event TokenTransferred(address indexed token, address indexed to, uint256 amount);
    
    error NotAuthorized();
    error PolicyViolation();
    error InvalidAddress();
    error ChangeNotReady();
    error ExecutionFailed();
    
    modifier onlyOwnerOrAgent() {
        if (msg.sender != owner() && msg.sender != agent) {
            revert NotAuthorized();
        }
        _;
    }
    
    modifier onlyAgent() {
        if (msg.sender != agent) {
            revert NotAuthorized();
        }
        _;
    }
    
    constructor(
        address _owner,
        address _agent,
        address _policyEngine
    ) Ownable(_owner) {
        if (_agent == address(0)) revert InvalidAddress();
        agent = _agent;
        policyEngine = _policyEngine;
        emit AgentSet(address(0), _agent);
    }
    
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyAgent nonReentrant returns (bytes memory) {
        if (policyEngine != address(0)) {
            if (!IPolicyEngine(policyEngine).canExecute(address(this), target, value, data)) {
                revert PolicyViolation();
            }
        }
        
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) revert ExecutionFailed();
        
        if (policyEngine != address(0)) {
            IPolicyEngine(policyEngine).recordExecution(address(this), target, value, data);
        }
        
        emit Executed(target, value, data);
        return result;
    }
    
    function transferToken(
        address token,
        address to,
        uint256 amount
    ) external onlyAgent nonReentrant {
        bytes memory data = abi.encodeWithSelector(
            IERC20.transfer.selector,
            to,
            amount
        );
        
        if (policyEngine != address(0)) {
            if (!IPolicyEngine(policyEngine).canExecute(address(this), token, 0, data)) {
                revert PolicyViolation();
            }
        }
        
        IERC20(token).safeTransfer(to, amount);
        
        if (policyEngine != address(0)) {
            IPolicyEngine(policyEngine).recordExecution(address(this), token, 0, data);
        }
        
        emit TokenTransferred(token, to, amount);
    }
    
    function initiateAgentChange(address _newAgent) external onlyOwner {
        if (_newAgent == address(0)) revert InvalidAddress();
        pendingAgent = _newAgent;
        agentChangeInitiated = block.timestamp;
        emit AgentChangeInitiated(_newAgent, block.timestamp);
    }
    
    function completeAgentChange() external onlyOwner {
        if (pendingAgent == address(0)) revert InvalidAddress();
        if (block.timestamp < agentChangeInitiated + AGENT_CHANGE_DELAY) {
            revert ChangeNotReady();
        }
        address oldAgent = agent;
        agent = pendingAgent;
        delete pendingAgent;
        delete agentChangeInitiated;
        emit AgentSet(oldAgent, agent);
    }
    
    function cancelAgentChange() external onlyOwner {
        delete pendingAgent;
        delete agentChangeInitiated;
    }
    
    function setPolicyEngine(address _policyEngine) external onlyOwner {
        policyEngine = _policyEngine;
    }
    
    function withdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = owner().call{value: amount}("");
            if (!success) revert ExecutionFailed();
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }
    
    function withdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner().call{value: balance}("");
            if (!success) revert ExecutionFailed();
        }
    }
    
    receive() external payable {}
}
