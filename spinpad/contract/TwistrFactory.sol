// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {TwistrCoin} from "./TwistrCoin.sol";

/// @title TwistrFactory
/// @notice Deploys a TwistrCoin on the caller's behalf, so launching is a
///         contract CALL rather than a bare contract creation.
///
/// WHY THIS EXISTS, AND IT IS NOT GAS.
///
/// A contract creation has no `to`, no recipient and no transfer. Wallet
/// simulators exist to show a person the balance changes a transaction will
/// cause, so on a creation they have nothing to describe — and several of them,
/// Phantom among them, respond by showing a red "could not simulate this
/// request" warning with a "Confirm (unsafe)" button underneath. The
/// transaction is fine. The preview is not possible.
///
/// Routed through this contract the same launch becomes an ordinary call: there
/// is a `to`, and the mint inside emits Transfer(0x0 -> you, supply), which is
/// exactly the kind of event a simulator is built to read. The warning goes
/// away because the thing it was complaining about is gone.
///
/// Two things fall out of it for free. The draw is announced from ONE known
/// address, so reading every launch off the chain is a log query filtered by
/// this contract instead of a sweep of every block for a topic. And a launch
/// and its pool could later be made atomic, which is impossible when the token
/// does not exist until its own transaction has been mined.
///
/// THIS CONTRACT HOLDS NOTHING AND CAN DO NOTHING. No owner, no fee, no
/// pause, no upgrade, no way to reach a coin once it is made. It has one
/// external function; the supply is minted straight to the caller and never
/// passes through here. There is no balance for anybody to take, including
/// whoever deployed it.
contract TwistrFactory {
    /// @notice Every launch, from one address, so the board can be read back
    ///         off the chain by anyone with a single filtered log query.
    /// Two addresses and nothing else, on purpose.
    ///
    /// The draw, the name, the symbol and the supply are all already on the
    /// token — and the token emits its own Paired event in this very
    /// transaction. Repeating any of it here would be a second copy that can
    /// disagree with the first, and it is what made an earlier version of this
    /// contract fail to compile at all: nine event fields on top of seven
    /// calldata arguments is more than the stack holds.
    ///
    /// This event's whole job is "the factory made this one", which is what
    /// turns reading the board into a log query filtered by one address.
    event Launched(address indexed token, address indexed creator);

    /// @notice Deploy a coin carrying its draw. The whole supply is minted to
    ///         you, not to this contract.
    /// @return token the address of the new coin.
    function launch(
        string calldata name,
        string calldata symbol,
        uint256 supply,
        string calldata pairedAsset,
        string calldata assetTicker,
        string calldata colour,
        string calldata position
    ) external returns (address token) {
        TwistrCoin coin = new TwistrCoin(
            name,
            symbol,
            supply,
            pairedAsset,
            assetTicker,
            colour,
            position,
            msg.sender
        );

        token = address(coin);

        emit Launched(token, msg.sender);
    }
}
