// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IWMON {
    function deposit() external payable;
}

/// @title YieldZapRouter — non-custodial deposit router for Yield Field
/// @notice Wraps native MON and/or routes ERC-20 assets into whitelisted
///         ERC-4626 vaults in a single transaction. Vault shares are minted
///         directly to the caller — the router never holds user positions,
///         so there is nothing here to drain. The whitelist only exists to
///         stop third-party UIs from abusing the router with fake vaults.
contract YieldZapRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable wmon;
    mapping(address => bool) public whitelistedVaults;

    event VaultWhitelisted(address indexed vault, bool allowed);
    event Zap(
        address indexed user,
        address indexed vault,
        address asset,
        uint256 assets,
        uint256 shares
    );

    error VaultNotWhitelisted(address vault);
    error ZeroAmount();
    error ZeroAddress();
    error LengthMismatch();
    error PartsMustSumToValue();

    constructor(address wmon_) Ownable(msg.sender) {
        if (wmon_ == address(0)) revert ZeroAddress();
        wmon = wmon_;
    }

    // ---------------------------------------------------------------- admin

    function setVault(address vault, bool allowed) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();
        whitelistedVaults[vault] = allowed;
        emit VaultWhitelisted(vault, allowed);
    }

    /// @notice Rescue tokens accidentally sent here; by design the router
    ///         holds nothing between transactions.
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // ----------------------------------------------------------------- zaps

    /// @notice Deposit native MON into a WMON-denominated vault in one tx;
    ///         shares are minted to the caller.
    function zapMon(address vault) external payable nonReentrant returns (uint256 shares) {
        shares = _zapMonTo(vault, msg.value);
    }

    /// @notice Split native MON across several WMON vaults in one transaction
    ///         ("diversify"): amounts must add up to msg.value.
    function diversifyMon(
        address[] calldata vaults,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        if (vaults.length == 0 || vaults.length != amounts.length) revert LengthMismatch();
        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }
        if (total != msg.value) revert PartsMustSumToValue();
        for (uint256 i = 0; i < vaults.length; i++) {
            _zapMonTo(vaults[i], amounts[i]);
        }
    }

    /// @notice Deposit the vault's own ERC-20 asset (AUSD, USDC, …) into a
    ///         vault in one tx after approval; shares go to the caller.
    function zapErc20(
        address vault,
        uint256 assets
    ) external nonReentrant returns (uint256 shares) {
        if (!whitelistedVaults[vault]) revert VaultNotWhitelisted(vault);
        if (assets == 0) revert ZeroAmount();
        address asset = IERC4626(vault).asset();
        IERC20(asset).safeTransferFrom(msg.sender, address(this), assets);
        IERC20(asset).forceApprove(vault, assets);
        shares = IERC4626(vault).deposit(assets, msg.sender);
        emit Zap(msg.sender, vault, asset, assets, shares);
    }

    // ------------------------------------------------------------- internal

    function _zapMonTo(address vault, uint256 amount) private returns (uint256 shares) {
        if (!whitelistedVaults[vault]) revert VaultNotWhitelisted(vault);
        if (amount == 0) revert ZeroAmount();
        IWMON(wmon).deposit{value: amount}();
        IERC20(wmon).forceApprove(vault, amount);
        shares = IERC4626(vault).deposit(amount, msg.sender);
        emit Zap(msg.sender, vault, wmon, amount, shares);
    }
}
