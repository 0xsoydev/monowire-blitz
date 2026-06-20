// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}

contract AgentMarket is Ownable {
    IERC721 public immutable identityRegistry;
    IReputationRegistry public immutable reputationRegistry;

    uint256 public constant BASE_MAX_BET = 0.05 ether;
    int256 public constant SCORE_WIN = 10;
    int256 public constant SCORE_LOSS = -5;

    struct Market {
        string question;
        uint256 resolutionTime;
        address creator;
        address oracle;
        bool resolved;
        uint8 outcome; // 0 = open, 1 = yes, 2 = no
        uint256 totalYes;
        uint256 totalNo;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
        mapping(address => bool) claimed;
        mapping(uint256 => bool) agentBet; // agentId => has bet
        mapping(uint256 => bool) agentBetIsYes; // agentId => bet side
        uint256[] agentIds; // list of agents that bet
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    // agentId => score
    mapping(uint256 => int256) public agentScore;

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        address indexed creator,
        address indexed oracle,
        uint256 resolutionTime
    );
    event BetPlaced(
        uint256 indexed marketId,
        uint256 indexed agentId,
        address indexed user,
        bool isYes,
        uint256 amount,
        uint256 maxBet
    );
    event MarketResolved(uint256 indexed marketId, uint8 outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event AgentScoreUpdated(uint256 indexed agentId, int256 newScore, bool correct);

    constructor(address _identityRegistry, address _reputationRegistry) Ownable(msg.sender) {
        identityRegistry = IERC721(_identityRegistry);
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    function createMarket(
        string calldata question,
        uint256 resolutionTime,
        address oracle
    ) external returns (uint256 marketId) {
        require(identityRegistry.balanceOf(msg.sender) > 0, "Only agents can create markets");
        require(resolutionTime > block.timestamp, "Resolution time must be future");
        require(oracle != address(0), "Oracle cannot be zero");

        marketId = marketCount++;
        Market storage m = markets[marketId];
        m.question = question;
        m.resolutionTime = resolutionTime;
        m.creator = msg.sender;
        m.oracle = oracle;

        emit MarketCreated(marketId, question, msg.sender, oracle, resolutionTime);
    }

    function bet(uint256 marketId, uint256 agentId, bool isYes) external payable {
        Market storage m = markets[marketId];
        require(!m.resolved, "Market already resolved");
        require(block.timestamp < m.resolutionTime, "Market closed");
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not agent owner");
        require(!m.agentBet[agentId], "Agent already bet");

        uint256 maxBet = getMaxBet(agentId);
        require(msg.value > 0, "Bet must be > 0");
        require(msg.value <= maxBet, "Bet exceeds max");

        m.agentBet[agentId] = true;
        m.agentBetIsYes[agentId] = isYes;
        m.agentIds.push(agentId);

        if (isYes) {
            m.yesBets[msg.sender] += msg.value;
            m.totalYes += msg.value;
        } else {
            m.noBets[msg.sender] += msg.value;
            m.totalNo += msg.value;
        }

        emit BetPlaced(marketId, agentId, msg.sender, isYes, msg.value, maxBet);
    }

    function resolveMarket(uint256 marketId, uint8 outcome) external {
        Market storage m = markets[marketId];
        require(msg.sender == m.oracle, "Only oracle");
        require(block.timestamp >= m.resolutionTime, "Too early");
        require(!m.resolved, "Already resolved");
        require(outcome == 1 || outcome == 2, "Invalid outcome");

        m.resolved = true;
        m.outcome = outcome;

        emit MarketResolved(marketId, outcome);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");
        require(!m.claimed[msg.sender], "Already claimed");

        uint256 userBet;
        uint256 winningPool;
        uint256 losingPool;

        if (m.outcome == 1) {
            userBet = m.yesBets[msg.sender];
            winningPool = m.totalYes;
            losingPool = m.totalNo;
        } else {
            userBet = m.noBets[msg.sender];
            winningPool = m.totalNo;
            losingPool = m.totalYes;
        }

        require(userBet > 0, "No winning bet");
        require(winningPool > 0, "No winning pool");

        uint256 payout = userBet + ((userBet * losingPool) / winningPool);
        m.claimed[msg.sender] = true;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Transfer failed");

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    function getMaxBet(uint256 agentId) public view returns (uint256) {
        int256 score = agentScore[agentId];
        uint256 weight;
        if (score > 0) {
            weight = 100 + uint256(score);
        } else if (score < 0) {
            uint256 neg = uint256(-score);
            weight = neg >= 100 ? 1 : 100 - neg;
        } else {
            weight = 100;
        }
        return (BASE_MAX_BET * weight) / 100;
    }

    function updateAgentScore(uint256 agentId, bool correct) public onlyOwner {
        if (correct) {
            agentScore[agentId] += SCORE_WIN;
        } else {
            agentScore[agentId] += SCORE_LOSS;
        }

        emit AgentScoreUpdated(agentId, agentScore[agentId], correct);

        // Mirror to ReputationRegistry
        try reputationRegistry.giveFeedback(
            agentId,
            correct ? int128(int256(SCORE_WIN)) : int128(int256(SCORE_LOSS)),
            0,
            "prediction",
            correct ? "correct" : "incorrect",
            "",
            "",
            bytes32(0)
        ) {} catch {}
    }

    function updateAllAgentScores(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved");

        for (uint256 i = 0; i < m.agentIds.length; i++) {
            uint256 agentId = m.agentIds[i];
            bool isYesBet = m.agentBetIsYes[agentId];
            bool correct = (m.outcome == 1 && isYesBet) || (m.outcome == 2 && !isYesBet);
            updateAgentScore(agentId, correct);
        }
    }

    function getMarketInfo(uint256 marketId)
        external
        view
        returns (
            string memory question,
            uint256 resolutionTime,
            address creator,
            address oracle,
            bool resolved,
            uint8 outcome,
            uint256 totalYes,
            uint256 totalNo
        )
    {
        Market storage m = markets[marketId];
        return (
            m.question,
            m.resolutionTime,
            m.creator,
            m.oracle,
            m.resolved,
            m.outcome,
            m.totalYes,
            m.totalNo
        );
    }

    function getUserBet(uint256 marketId, address user) external view returns (uint256 yes, uint256 no) {
        Market storage m = markets[marketId];
        return (m.yesBets[user], m.noBets[user]);
    }

    receive() external payable {}
    fallback() external payable {}
}
