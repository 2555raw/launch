// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// Deploys init code at a CREATE2 address, so a hook can land on an address
/// whose low 14 bits match its permissions.
contract Create2Deployer {
    event Deployed(address addr);

    function deploy(bytes memory code, bytes32 salt) external returns (address addr) {
        assembly {
            addr := create2(0, add(code, 0x20), mload(code), salt)
        }
        require(addr != address(0), "deploy failed");
        emit Deployed(addr);
    }
}
