// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SafeTransfer} from "../lib/SafeTransfer.sol";
import {IGraduator} from "../interfaces/IGraduator.sol";
import {YuelongPool} from "../pool/YuelongPool.sol";

interface IFactoryCurves {
    function curveOf(address token) external view returns (address);
}

/// @title PoolGraduator
/// @notice Graduates a curve into its own YuelongPool, so a chain needs no outside DEX. The
///         pool has no LP tokens, so the seeded liquidity is locked for good.
contract PoolGraduator is IGraduator {
    using SafeTransfer for address;

    address public immutable factory;
    mapping(address => address) public poolOf;   // coin -> pool

    event PoolSeeded(address indexed pool, address indexed token, address indexed quote, uint256 tokenAmount, uint256 quoteAmount);

    error AlreadyGraduated();
    error NotCurve();

    constructor(address factory_) { factory = factory_; }

    /// @dev Only the factory's own curve for `token` may graduate it, so nobody can squat a
    ///      coin's pool before its curve fills.
    function graduate(address token, address quote, uint256 tokenAmount, uint256 quoteAmount) external returns (address pool) {
        if (IFactoryCurves(factory).curveOf(token) != msg.sender) revert NotCurve();
        if (poolOf[token] != address(0)) revert AlreadyGraduated();
        YuelongPool p = new YuelongPool{salt: bytes32(uint256(uint160(token)))}(token, quote);
        pool = address(p);
        poolOf[token] = pool;
        token.safeTransferFrom(msg.sender, pool, tokenAmount);
        quote.safeTransferFrom(msg.sender, pool, quoteAmount);
        p.initialize();
        emit PoolSeeded(pool, token, quote, tokenAmount, quoteAmount);
    }
}
