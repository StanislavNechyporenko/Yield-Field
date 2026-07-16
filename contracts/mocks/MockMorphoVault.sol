// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockMorphoVault {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;

    constructor(address asset_) {
        asset = IERC20(asset_);
    }

    function deposit(uint256 assets, address) external returns (uint256) {
        asset.safeTransferFrom(msg.sender, address(this), assets);
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address) external returns (uint256) {
        asset.safeTransfer(receiver, assets);
        return assets;
    }
}
