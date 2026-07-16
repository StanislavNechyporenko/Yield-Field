// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title WMON — wrapped MON, WETH9-style
contract WMON is ERC20 {
    event Deposit(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    constructor() ERC20("Wrapped MON", "WMON") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "WMON: MON transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

    receive() external payable {
        deposit();
    }
}
