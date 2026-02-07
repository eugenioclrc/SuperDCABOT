// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "src/IChainlinkAggregator.sol";
/**
 * @title MockChainlinkAggregator
 * @notice Mock Chainlink price feed for testing
 * @dev Simulates AggregatorV3Interface behavior with controllable price updates
 */
contract MockChainlinkAggregator is AggregatorV3Interface {
    uint8 private _decimals;
    string private _description;
    uint256 private _version;

    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    RoundData private latestRound;

    constructor(uint8 decimals_, string memory description_) {
        _decimals = decimals_;
        _description = description_;
        _version = 1;

        // Initialize with default round
        latestRound = RoundData({
            roundId: 1,
            answer: 0,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            answeredInRound: 1
        });
    }

    /**
     * @notice Updates the price (for testing)
     * @param price The new price
     */
    function updateAnswer(int256 price) external {
        latestRound.roundId++;
        latestRound.answer = price;
        latestRound.startedAt = block.timestamp;
        latestRound.updatedAt = block.timestamp;
        latestRound.answeredInRound = latestRound.roundId;
    }

    /**
     * @notice Simulates stale data (for testing staleness validation)
     * @param timestamp The timestamp to set (old timestamp = stale)
     */
    function setUpdatedAt(uint256 timestamp) external {
        latestRound.updatedAt = timestamp;
    }

    // ═══════════════════════════════════════════════════════════
    // AggregatorV3Interface Implementation
    // ═══════════════════════════════════════════════════════════

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external view returns (string memory) {
        return _description;
    }

    function version() external view returns (uint256) {
        return _version;
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
    
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        // For simplicity, always return latest round (in production, would store historical rounds)
        return (
            latestRound.roundId,
            latestRound.answer,
            latestRound.startedAt,
            latestRound.updatedAt,
            latestRound.answeredInRound
        );
    }

    function latestRoundData()
        external
        view
    
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            latestRound.roundId,
            latestRound.answer,
            latestRound.startedAt,
            latestRound.updatedAt,
            latestRound.answeredInRound
        );
    }
}
