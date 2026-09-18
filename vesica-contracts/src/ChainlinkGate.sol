// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IOracleGate} from "./interfaces/IOracleGate.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title ChainlinkGate
/// @notice Two questions asked before a vault will take money: is the chain
///         actually running, and is the price recent enough to act on.
///
/// @dev The sequencer check is not optional on an L2. When a sequencer comes
///      back after an outage it replays a queue of transactions that were
///      submitted while the feeds were frozen, so for a few minutes the price
///      on the feed can be stale while trades execute against it. That is the
///      window arbitrageurs wait for, which is why a grace period has to pass
///      after the sequencer is up again before this gate opens.
contract ChainlinkGate is IOracleGate {
    /// @notice The price feed for the asset this vault holds.
    IAggregatorV3 public immutable priceFeed;

    /// @notice The L2 sequencer uptime feed, or address(0) on a chain that has
    ///         no sequencer (mainnet, or a local test chain).
    IAggregatorV3 public immutable sequencerFeed;

    /// @notice How old the price may be before this gate refuses, in seconds.
    ///         Set it from the feed's own heartbeat, with headroom.
    uint256 public immutable maxStaleness;

    /// @notice How long after the sequencer returns before the gate reopens.
    uint256 public immutable gracePeriod;

    error SequencerDown();
    error SequencerGracePeriod(uint256 secondsRemaining);
    error StalePrice(uint256 age, uint256 limit);
    error BadPrice(int256 price);
    error IncompleteRound();
    error ZeroFeed();
    error ZeroStaleness();

    constructor(
        IAggregatorV3 _priceFeed,
        IAggregatorV3 _sequencerFeed,
        uint256 _maxStaleness,
        uint256 _gracePeriod
    ) {
        if (address(_priceFeed) == address(0)) revert ZeroFeed();
        // A gate with no staleness limit is not a gate.
        if (_maxStaleness == 0) revert ZeroStaleness();
        priceFeed = _priceFeed;
        sequencerFeed = _sequencerFeed;
        maxStaleness = _maxStaleness;
        gracePeriod = _gracePeriod;
    }

    /// @inheritdoc IOracleGate
    function decimals() external view returns (uint8) {
        return priceFeed.decimals();
    }

    /// @inheritdoc IOracleGate
    function check() external view returns (int256) {
        if (address(sequencerFeed) != address(0)) {
            (, int256 up, uint256 startedAt,,) = sequencerFeed.latestRoundData();
            // 0 means up, 1 means down. Anything else is a feed we do not
            // understand, so treat it as down rather than guessing.
            if (up != 0) revert SequencerDown();
            // startedAt is when the current up/down round began. Zero means the
            // feed has not reported since it was deployed: no evidence of
            // uptime is not evidence of uptime.
            if (startedAt == 0) revert SequencerDown();
            uint256 since = block.timestamp - startedAt;
            if (since <= gracePeriod) revert SequencerGracePeriod(gracePeriod - since + 1);
        }

        (uint80 roundId, int256 price, , uint256 updatedAt, uint80 answeredInRound) = priceFeed.latestRoundData();
        if (updatedAt == 0) revert IncompleteRound();
        // A price carried over from an earlier round is not this round's price.
        if (answeredInRound < roundId) revert IncompleteRound();
        if (price <= 0) revert BadPrice(price);
        uint256 age = block.timestamp - updatedAt;
        if (age > maxStaleness) revert StalePrice(age, maxStaleness);

        return price;
    }
}
