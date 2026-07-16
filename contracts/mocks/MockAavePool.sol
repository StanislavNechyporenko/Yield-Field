// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAavePool {
    using SafeERC20 for IERC20;

    function supply(address asset, uint256 amount, address, uint16) external {
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        IERC20(asset).safeTransfer(to, amount);
        return amount;
    }
}
