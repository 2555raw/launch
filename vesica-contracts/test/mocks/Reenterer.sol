// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IVaultLike {
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256);
}

/// @dev An asset that calls back into the vault mid-transfer, the way an
///      ERC-777 style hook would. Test only.
contract Reenterer is ERC20 {
    IVaultLike public vault;
    bool public armed;

    constructor() ERC20("Hook", "HOOK") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(IVaultLike v) external {
        vault = v;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (armed && from != address(0) && address(vault) != address(0)) {
            armed = false; // one shot, so the test fails on the guard, not on gas
            vault.deposit(1, address(this));
        }
        super._update(from, to, value);
    }
}
