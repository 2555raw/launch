// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title BondNFT (placeholder name)
/// @notice ERC-721 whose only payload is a 32-byte seal code (a SHA-256 commitment made in the
///         browser). Minting is open to any wallet whose OBX balance is at least `minHold`
///         at the moment of minting. Metadata is fully on-chain.
/// @dev    NOT AUDITED.
contract BondNFT is ERC721, Ownable2Step {
    using Strings for uint256;

    /// @notice The OBX token checked by the hold gate.
    IERC20 public immutable obx;
    /// @notice Upper bound for `minHold`, fixed at deploy so the owner cannot price everyone out.
    uint256 public immutable maxMinHold;
    /// @notice If true, bonds cannot be transferred after minting (fixed at deploy).
    bool public immutable soulbound;

    /// @notice Minimum OBX balance (smallest units) a wallet needs to mint. Always >= 1.
    uint256 public minHold;
    /// @notice Number of bonds minted so far. Token ids run 1..totalMinted.
    uint256 public totalMinted;

    mapping(uint256 tokenId => bytes32) private _sealCodes;
    /// @notice Token id that carries a seal code, or 0 if none.
    mapping(bytes32 sealCode => uint256) public tokenIdOfSeal;

    event Bonded(uint256 indexed tokenId, address indexed owner, bytes32 indexed sealCode);
    event MinHoldUpdated(uint256 previousMinHold, uint256 newMinHold);

    error ZeroAddress();
    error ZeroSealCode();
    error SealCodeAlreadyBonded(bytes32 sealCode, uint256 tokenId);
    error InsufficientOBX(uint256 balance, uint256 required);
    error MinHoldOutOfRange(uint256 requested, uint256 max);
    error Soulbound();

    /// @param name_       Collection name (placeholder).
    /// @param symbol_     Collection symbol.
    /// @param obx_        OBX token address.
    /// @param minHold_    Initial minimum OBX balance to mint (smallest units, 1..maxMinHold_).
    /// @param maxMinHold_ Hard cap for minHold, immutable.
    /// @param soulbound_  True to make bonds non-transferable.
    constructor(
        string memory name_,
        string memory symbol_,
        address obx_,
        uint256 minHold_,
        uint256 maxMinHold_,
        bool soulbound_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        if (obx_ == address(0)) revert ZeroAddress();
        obx = IERC20(obx_);
        maxMinHold = maxMinHold_;
        soulbound = soulbound_;
        _setMinHold(minHold_);
    }

    // ---------------------------------------------------------------- owner settings

    /// @notice Change the hold requirement, within 1..maxMinHold.
    function setMinHold(uint256 newMinHold) external onlyOwner {
        _setMinHold(newMinHold);
    }

    function _setMinHold(uint256 newMinHold) private {
        if (newMinHold == 0 || newMinHold > maxMinHold) revert MinHoldOutOfRange(newMinHold, maxMinHold);
        emit MinHoldUpdated(minHold, newMinHold);
        minHold = newMinHold;
    }

    // ---------------------------------------------------------------- mint

    /// @notice Mint a bond carrying `sealCode` to the caller. Caller must hold >= minHold OBX.
    function mint(bytes32 sealCode) external returns (uint256 tokenId) {
        if (sealCode == bytes32(0)) revert ZeroSealCode();
        uint256 existing = tokenIdOfSeal[sealCode];
        if (existing != 0) revert SealCodeAlreadyBonded(sealCode, existing);
        uint256 bal = obx.balanceOf(msg.sender);
        if (bal < minHold) revert InsufficientOBX(bal, minHold);

        tokenId = ++totalMinted;
        _sealCodes[tokenId] = sealCode;
        tokenIdOfSeal[sealCode] = tokenId;
        _safeMint(msg.sender, tokenId);
        emit Bonded(tokenId, msg.sender, sealCode);
    }

    // ---------------------------------------------------------------- views

    /// @notice The seal code carried by `tokenId`. Reverts if the token does not exist.
    function sealCodeOf(uint256 tokenId) public view returns (bytes32) {
        _requireOwned(tokenId);
        return _sealCodes[tokenId];
    }

    /// @notice On-chain metadata: data:application/json;base64,... with an inline SVG image.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        bytes32 seal = sealCodeOf(tokenId);
        string memory sealHex = uint256(seal).toHexString(32);
        string memory idStr = tokenId.toString();

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#0b0b0c"/>',
            '<text x="24" y="56" fill="#f2f2f2" font-family="monospace" font-size="28">Bond #',
            idStr,
            "</text>",
            '<text x="24" y="330" fill="#9a9aa0" font-family="monospace" font-size="11">',
            _slice(sealHex, 0, 34),
            "</text>",
            '<text x="24" y="350" fill="#9a9aa0" font-family="monospace" font-size="11">',
            _slice(sealHex, 34, 66),
            "</text></svg>"
        );

        string memory json = string.concat(
            '{"name":"Bond #',
            idStr,
            '","description":"A sealed bond. It carries a SHA-256 seal code and nothing else.",',
            '"attributes":[{"trait_type":"Seal code","value":"',
            sealHex,
            '"}],"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '"}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // ---------------------------------------------------------------- soulbound hook

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        // Mints (from == 0) are always allowed; with soulbound on, everything else reverts.
        if (soulbound && from != address(0)) revert Soulbound();
    }

    function _slice(string memory s, uint256 start, uint256 end) private pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(end - start);
        for (uint256 i = start; i < end; ++i) {
            out[i - start] = b[i];
        }
        return string(out);
    }
}
