// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  RollRegistry — one hash per month, append-only, forever.
/// @notice The Vault writes here at every close. Once a month's hash is set
///         nobody — the operator included — can change it. Anyone can read it
///         and compare it with the SHA-256 of the published Roll file.
contract RollRegistry {
    /// @dev month is YYYYMM, e.g. 202608
    mapping(uint256 => bytes32) private _hash;
    uint256[] private _months;
    address public immutable writer;

    event RollPublished(uint256 indexed month, bytes32 hash);

    error NotWriter();
    error AlreadyPublished(uint256 month);
    error NotInOrder(uint256 month);
    error EmptyHash();

    constructor(address writer_) { writer = writer_; }

    /// @notice Record a month's Roll. Months must be published in order.
    function publish(uint256 month, bytes32 hash) external {
        if (msg.sender != writer) revert NotWriter();
        if (hash == bytes32(0)) revert EmptyHash();
        if (_hash[month] != bytes32(0)) revert AlreadyPublished(month);
        if (_months.length > 0 && month <= _months[_months.length - 1]) revert NotInOrder(month);
        _hash[month] = hash;
        _months.push(month);
        emit RollPublished(month, hash);
    }

    function rollHash(uint256 month) external view returns (bytes32) { return _hash[month]; }
    function count() external view returns (uint256) { return _months.length; }
    function monthAt(uint256 i) external view returns (uint256) { return _months[i]; }
    function latest() external view returns (uint256 month, bytes32 hash) {
        if (_months.length == 0) return (0, bytes32(0));
        month = _months[_months.length - 1];
        hash = _hash[month];
    }
}
