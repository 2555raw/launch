// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILilyPadFactory {
    function treasury() external view returns (address);
    function graduator() external view returns (address);
}
