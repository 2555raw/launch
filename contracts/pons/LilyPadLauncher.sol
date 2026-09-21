// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title LilyPadLauncher
/// @notice Launches a token on the public Pons V2 factory and makes the creator's first buy
///         in the same transaction, so nobody can trade the new curve before its creator.
///         The launcher holds nothing between transactions: whatever stock is not spent goes
///         back to the caller before the call returns.
/// @dev    The factory records this contract as the launch's `deployer`; the human creator is
///         `params.creatorFeeRecipient` (enforced to be msg.sender) and the `Launched` event.
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

interface IPonsV2LaunchFactory {
    struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }
    struct TokenParams {
        string name; string symbol; string logo; string description; Socials socials;
        address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt;
    }
    function launchToken(TokenParams calldata params, uint256 launchConfigId, address pairToken, address[] calldata snipeTaxExemptions)
        external payable returns (address token, address curve);
    function launchFee() external view returns (uint256);
    function approvedPairTokens(address pairToken) external view returns (bool);
}

interface IPonsV2BondingCurve {
    function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) external payable returns (uint256 tokensOut);
    function pairToken() external view returns (address);
}

contract LilyPadLauncher {
    IPonsV2LaunchFactory public immutable pons;

    event Launched(address indexed user, address indexed token, address indexed curve, address pairToken, uint256 quoteIn, uint256 tokensOut);

    error WrongFee(uint256 sent, uint256 required);
    error QuoteNotApproved(address pairToken);
    error RecipientNotCaller();
    error PairMismatch(address curveQuote, address wanted);
    error TransferFailed();

    constructor(address _pons) { pons = IPonsV2LaunchFactory(_pons); }

    /// @param params        Pons TokenParams. `creatorFeeRecipient` must be the caller.
    /// @param launchConfigId Factory launch config.
    /// @param pairToken     The stock token the curve is quoted in.
    /// @param exemptions    Snipe-tax exemptions. Include the caller AND this launcher, since the
    ///                      curve sees the launcher as the buyer of the first purchase.
    /// @param quoteIn       Stock to spend on the first buy (0 for none); must be approved to this contract.
    /// @param minTokensOut  Slippage floor for the first buy.
    function launch(
        IPonsV2LaunchFactory.TokenParams calldata params,
        uint256 launchConfigId,
        address pairToken,
        address[] calldata exemptions,
        uint256 quoteIn,
        uint256 minTokensOut
    ) external payable returns (address token, address curve, uint256 tokensOut) {
        uint256 fee = pons.launchFee();
        if (msg.value != fee) revert WrongFee(msg.value, fee);
        if (!pons.approvedPairTokens(pairToken)) revert QuoteNotApproved(pairToken);
        if (params.creatorFeeRecipient != msg.sender) revert RecipientNotCaller();

        (token, curve) = pons.launchToken{value: msg.value}(params, launchConfigId, pairToken, exemptions);
        address curveQuote = IPonsV2BondingCurve(curve).pairToken();
        if (curveQuote != pairToken) revert PairMismatch(curveQuote, pairToken);

        if (quoteIn > 0) {
            _pull(pairToken, msg.sender, quoteIn);
            if (!IERC20(pairToken).approve(curve, quoteIn)) revert TransferFailed();
            tokensOut = IPonsV2BondingCurve(curve).buy(quoteIn, minTokensOut, msg.sender);
            uint256 left = IERC20(pairToken).balanceOf(address(this));
            if (left > 0) _push(pairToken, msg.sender, left);
        }
        if (address(this).balance > 0) {
            (bool ok, ) = msg.sender.call{value: address(this).balance}("");
            if (!ok) revert TransferFailed();
        }
        emit Launched(msg.sender, token, curve, pairToken, quoteIn, tokensOut);
    }

    receive() external payable {}

    function _pull(address t, address from, uint256 amount) private {
        (bool ok, bytes memory data) = t.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, address(this), amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
    function _push(address t, address to, uint256 amount) private {
        (bool ok, bytes memory data) = t.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
