// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../src/AgentWallet.sol";
import "../src/PolicyEngine.sol";

contract AgentWalletTest is Test {
    AgentWallet public wallet;
    PolicyEngine public policyEngine;
    
    address public owner = address(0x1);
    address public agent = address(0x2);
    address public recipient = address(0x3);
    address public token = address(0x4);
    
    function setUp() public {
        vm.startPrank(owner);
        policyEngine = new PolicyEngine();
        wallet = new AgentWallet(owner, agent, address(policyEngine));
        vm.stopPrank();
        
        vm.deal(address(wallet), 10 ether);
    }
    
    function test_InitialState() public view {
        assertEq(wallet.owner(), owner);
        assertEq(wallet.agent(), agent);
        assertEq(wallet.policyEngine(), address(policyEngine));
    }
    
    function test_ExecuteWithoutPolicy() public {
        uint256 initialBalance = recipient.balance;
        
        vm.prank(agent);
        wallet.execute(recipient, 1 ether, "");
        
        assertEq(recipient.balance, initialBalance + 1 ether);
    }
    
    function test_ExecuteByOwner() public {
        vm.prank(owner);
        vm.expectRevert(AgentWallet.NotAuthorized.selector);
        wallet.execute(recipient, 1 ether, "");
    }
    
    function test_ExecuteByRandom() public {
        vm.prank(address(0x999));
        vm.expectRevert(AgentWallet.NotAuthorized.selector);
        wallet.execute(recipient, 1 ether, "");
    }
    
    function test_PolicyLimitsSpending() public {
        address[] memory empty = new address[](0);
        
        vm.prank(address(wallet));
        policyEngine.createPolicy(
            address(wallet),
            0.5 ether,
            2 ether,
            empty,
            empty,
            1 ether
        );
        
        vm.prank(agent);
        wallet.execute(recipient, 0.3 ether, "");
        
        vm.prank(agent);
        vm.expectRevert();
        wallet.execute(recipient, 0.3 ether, "");
    }
    
    function test_AgentChange() public {
        address newAgent = address(0x5);
        
        vm.prank(owner);
        wallet.initiateAgentChange(newAgent);
        
        assertEq(wallet.pendingAgent(), newAgent);
        
        vm.warp(block.timestamp + 25 hours);
        
        vm.prank(owner);
        wallet.completeAgentChange();
        
        assertEq(wallet.agent(), newAgent);
        assertEq(wallet.pendingAgent(), address(0));
    }
    
    function test_Withdraw() public {
        uint256 ownerBalance = owner.balance;
        
        vm.prank(owner);
        wallet.withdraw(address(0), 1 ether);
        
        assertEq(owner.balance, ownerBalance + 1 ether);
    }
    
    function test_TransferToken() public {
        MockERC20 mockToken = new MockERC20();
        mockToken.mint(address(wallet), 1000 * 10**18);
        
        vm.prank(agent);
        wallet.transferToken(address(mockToken), recipient, 100 * 10**18);
        
        assertEq(mockToken.balanceOf(recipient), 100 * 10**18);
    }
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract PolicyEngineTest is Test {
    PolicyEngine public engine;
    address public wallet = address(0x1);
    
    function setUp() public {
        engine = new PolicyEngine();
    }
    
    function test_CreatePolicy() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(0x123);
        
        address[] memory contracts = new address[](0);
        
        vm.prank(wallet);
        engine.createPolicy(
            wallet,
            1 ether,
            5 ether,
            tokens,
            contracts,
            0.5 ether
        );
        
        (
            bool isActive,
            uint256 dailyLimit,
            uint256 weeklyLimit,
            uint256 dailySpent,
            uint256 weeklySpent,
            uint256 requireApprovalAbove
        ) = engine.getPolicy(wallet);
        
        assertTrue(isActive);
        assertEq(dailyLimit, 1 ether);
        assertEq(weeklyLimit, 5 ether);
        assertEq(requireApprovalAbove, 0.5 ether);
    }
    
    function test_UpdateLimits() public {
        address[] memory empty = new address[](0);
        
        vm.prank(wallet);
        engine.createPolicy(wallet, 1 ether, 5 ether, empty, empty, 0);
        
        vm.prank(wallet);
        engine.updateDailyLimit(wallet, 2 ether);
        
        (, uint256 dailyLimit,,,,) = engine.getPolicy(wallet);
        assertEq(dailyLimit, 2 ether);
    }
}
