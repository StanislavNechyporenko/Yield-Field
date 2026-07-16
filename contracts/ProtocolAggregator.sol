// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAavePool {
    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;

    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}

/// ERC-4626-style vault interface (MetaMorpho vaults conform to this).
interface IMorphoVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
}

interface IWMON {
    function deposit() external payable;

    function withdraw(uint256 amount) external;
}

/// @title ProtocolAggregator
/// @notice Single entry point for depositing assets into Monad DeFi
///         protocols. Accepts whitelisted ERC-20 tokens and native MON
///         (wrapped to WMON on the way in, unwrapped on the way out).
///         Positions are held by this contract; per-user accounting tracks
///         deposited principal only — accrued yield stays in the pool
///         position and is not claimable through this MVP.
contract ProtocolAggregator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Protocol {
        Aave,
        Morpho
    }

    struct ProtocolInfo {
        address pool;
        string name;
        bool active;
    }

    struct UserInvestment {
        Protocol protocol;
        address asset;
        uint256 amount;
        uint256 timestamp;
    }

    /// Wrapped-MON contract used for native deposits; zero disables them.
    address public wmon;

    mapping(uint256 => ProtocolInfo) public protocols;
    mapping(address => UserInvestment[]) public userInvestments;
    mapping(address => bool) public whitelistedAssets;
    /// user => protocol id => asset => principal currently deposited
    mapping(address => mapping(uint256 => mapping(address => uint256))) public deposited;

    event Deposit(address indexed user, Protocol protocol, uint256 amount, address asset);
    event Withdrawal(address indexed user, Protocol protocol, uint256 amount);
    event ProtocolRegistered(Protocol protocol, address poolAddress);
    event AssetWhitelisted(address indexed asset, bool allowed);

    error AssetNotWhitelisted(address asset);
    error ProtocolNotActive(uint256 protocolId);
    error ZeroAmount();
    error ZeroAddress();
    error NativeNotSupported();
    error NativeTransferFailed();
    error InsufficientDeposit(uint256 available, uint256 requested);

    constructor(address wmon_) Ownable(msg.sender) {
        wmon = wmon_;
    }

    /// Accepts MON unwrapped by WMON during native withdrawals.
    receive() external payable {}

    // ---------------------------------------------------------------- admin

    function registerProtocol(Protocol protocol, address poolAddress, string calldata name) external onlyOwner {
        if (poolAddress == address(0)) revert ZeroAddress();
        protocols[uint256(protocol)] = ProtocolInfo({pool: poolAddress, name: name, active: true});
        emit ProtocolRegistered(protocol, poolAddress);
    }

    function setProtocolActive(Protocol protocol, bool active) external onlyOwner {
        protocols[uint256(protocol)].active = active;
    }

    function setWMON(address wmon_) external onlyOwner {
        wmon = wmon_;
    }

    function addSupportedAsset(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        whitelistedAssets[token] = true;
        emit AssetWhitelisted(token, true);
    }

    function removeSupportedAsset(address token) external onlyOwner {
        whitelistedAssets[token] = false;
        emit AssetWhitelisted(token, false);
    }

    /// @notice Rescue tokens sitting on the aggregator itself. Deposited
    ///         funds live in the underlying pools, not on this contract, so
    ///         this cannot drain user positions.
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // ------------------------------------------------------ ERC-20 deposits

    function depositToAave(address asset, uint256 amount) external nonReentrant {
        ProtocolInfo memory info = _checkDeposit(Protocol.Aave, asset, amount);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _supplyToAave(info.pool, asset, amount);
        _logDeposit(Protocol.Aave, asset, amount);
    }

    function depositToMorpho(address asset, uint256 amount) external nonReentrant {
        ProtocolInfo memory info = _checkDeposit(Protocol.Morpho, asset, amount);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _supplyToMorpho(info.pool, asset, amount);
        _logDeposit(Protocol.Morpho, asset, amount);
    }

    // -------------------------------------------------- native MON deposits

    function depositNativeToAave() external payable nonReentrant {
        ProtocolInfo memory info = _checkNativeDeposit(Protocol.Aave);
        IWMON(wmon).deposit{value: msg.value}();
        _supplyToAave(info.pool, wmon, msg.value);
        _logDeposit(Protocol.Aave, wmon, msg.value);
    }

    function depositNativeToMorpho() external payable nonReentrant {
        ProtocolInfo memory info = _checkNativeDeposit(Protocol.Morpho);
        IWMON(wmon).deposit{value: msg.value}();
        _supplyToMorpho(info.pool, wmon, msg.value);
        _logDeposit(Protocol.Morpho, wmon, msg.value);
    }

    // --------------------------------------------------- ERC-20 withdrawals

    function withdrawFromAave(address asset, uint256 amount) external nonReentrant {
        ProtocolInfo memory info = _checkWithdraw(Protocol.Aave, asset, amount);
        IAavePool(info.pool).withdraw(asset, amount, msg.sender);
        emit Withdrawal(msg.sender, Protocol.Aave, amount);
    }

    function withdrawFromMorpho(address asset, uint256 amount) external nonReentrant {
        ProtocolInfo memory info = _checkWithdraw(Protocol.Morpho, asset, amount);
        IMorphoVault(info.pool).withdraw(amount, msg.sender, address(this));
        emit Withdrawal(msg.sender, Protocol.Morpho, amount);
    }

    // ----------------------------------------------- native MON withdrawals

    function withdrawNativeFromAave(uint256 amount) external nonReentrant {
        ProtocolInfo memory info = _checkWithdraw(Protocol.Aave, wmon, amount);
        IAavePool(info.pool).withdraw(wmon, amount, address(this));
        _unwrapAndSend(amount);
        emit Withdrawal(msg.sender, Protocol.Aave, amount);
    }

    function withdrawNativeFromMorpho(uint256 amount) external nonReentrant {
        ProtocolInfo memory info = _checkWithdraw(Protocol.Morpho, wmon, amount);
        IMorphoVault(info.pool).withdraw(amount, address(this), address(this));
        _unwrapAndSend(amount);
        emit Withdrawal(msg.sender, Protocol.Morpho, amount);
    }

    // ----------------------------------------------------------------- view

    function getUserInvestments(address user) external view returns (UserInvestment[] memory) {
        return userInvestments[user];
    }

    // ------------------------------------------------------------- internal

    function _supplyToAave(address pool, address asset, uint256 amount) private {
        IERC20(asset).forceApprove(pool, amount);
        IAavePool(pool).supply(asset, amount, address(this), 0);
    }

    function _supplyToMorpho(address pool, address asset, uint256 amount) private {
        IERC20(asset).forceApprove(pool, amount);
        IMorphoVault(pool).deposit(amount, address(this));
    }

    function _unwrapAndSend(uint256 amount) private {
        IWMON(wmon).withdraw(amount);
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    function _checkDeposit(
        Protocol protocol,
        address asset,
        uint256 amount
    ) private view returns (ProtocolInfo memory info) {
        if (amount == 0) revert ZeroAmount();
        if (!whitelistedAssets[asset]) revert AssetNotWhitelisted(asset);
        info = protocols[uint256(protocol)];
        if (info.pool == address(0) || !info.active) revert ProtocolNotActive(uint256(protocol));
    }

    function _checkNativeDeposit(Protocol protocol) private view returns (ProtocolInfo memory info) {
        if (wmon == address(0)) revert NativeNotSupported();
        return _checkDeposit(protocol, wmon, msg.value);
    }

    function _logDeposit(Protocol protocol, address asset, uint256 amount) private {
        deposited[msg.sender][uint256(protocol)][asset] += amount;
        userInvestments[msg.sender].push(
            UserInvestment({protocol: protocol, asset: asset, amount: amount, timestamp: block.timestamp})
        );
        emit Deposit(msg.sender, protocol, amount, asset);
    }

    function _checkWithdraw(
        Protocol protocol,
        address asset,
        uint256 amount
    ) private returns (ProtocolInfo memory info) {
        if (amount == 0) revert ZeroAmount();
        info = protocols[uint256(protocol)];
        if (info.pool == address(0) || !info.active) revert ProtocolNotActive(uint256(protocol));
        uint256 balance = deposited[msg.sender][uint256(protocol)][asset];
        if (balance < amount) revert InsufficientDeposit(balance, amount);
        deposited[msg.sender][uint256(protocol)][asset] = balance - amount;
    }
}
