// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title SpinpadCoin
/// @notice A plain ERC-20 that carries the draw that created it.
///
/// The point of this contract is the four fields under "the draw". They are set
/// once, in the constructor, and there is no function anywhere that can change
/// them. Whatever the board landed on is what the token says it landed on, for
/// as long as the token exists, and anyone can read it back off the chain
/// without trusting the page that deployed it.
///
/// No owner, no mint, no pause, no upgrade path. The whole supply goes to the
/// creator in the constructor and the contract is finished.
contract SpinpadCoin {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    /* ---------- the draw ---------- */

    /// @notice The asset the board paired this coin with.
    string public pairedAsset;
    /// @notice Its ticker on the board.
    string public assetTicker;
    /// @notice The colour family the arrow landed in.
    string public family;
    /// @notice The quadrant it landed in: the other half of the draw.
    string public quadrant;
    /// @notice Block timestamp of the deployment that recorded the draw.
    uint256 public drawnAt;
    /// @notice Who spun.
    address public immutable creator;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    /// @notice Emitted once, at birth, so the draw is in the logs as well as in storage.
    event Paired(string asset, string assetTicker, string family, string quadrant, address creator);

    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _supply,
        string memory _pairedAsset,
        string memory _assetTicker,
        string memory _family,
        string memory _quadrant
    ) {
        name = _name;
        symbol = _symbol;
        pairedAsset = _pairedAsset;
        assetTicker = _assetTicker;
        family = _family;
        quadrant = _quadrant;
        drawnAt = block.timestamp;
        creator = msg.sender;

        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;

        emit Transfer(address(0), msg.sender, _supply);
        emit Paired(_pairedAsset, _assetTicker, _family, _quadrant, msg.sender);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _move(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - value;
        }
        _move(from, to, value);
        return true;
    }

    function _move(address from, address to, uint256 value) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}
