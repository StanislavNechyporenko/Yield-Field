// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// Force-sends native currency to any address via selfdestruct (test helper).
contract ForceSend {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}
