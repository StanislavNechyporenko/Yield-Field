const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const AAVE = 0;
const MORPHO = 1;

describe("ProtocolAggregator", function () {
  async function deployFixture() {
    const [owner, user, other] = await ethers.getSigners();

    const wmon = await (await ethers.getContractFactory("WMON")).deploy();
    const token = await (await ethers.getContractFactory("MockERC20")).deploy("Mock USDC", "USDC", 6);
    const aavePool = await (await ethers.getContractFactory("MockAavePool")).deploy();
    const morphoVault = await (
      await ethers.getContractFactory("MockMorphoVault")
    ).deploy(await token.getAddress());
    const aggregator = await (
      await ethers.getContractFactory("ProtocolAggregator")
    ).deploy(await wmon.getAddress());

    await aggregator.registerProtocol(AAVE, await aavePool.getAddress(), "Aave V3");
    await aggregator.registerProtocol(MORPHO, await morphoVault.getAddress(), "Morpho Blue");
    await aggregator.addSupportedAsset(await token.getAddress());

    const amount = ethers.parseUnits("1000", 6);
    await token.mint(user.address, amount * 10n);
    await token.connect(user).approve(await aggregator.getAddress(), ethers.MaxUint256);

    return { owner, user, other, wmon, token, aavePool, morphoVault, aggregator, amount };
  }

  async function nativeFixture() {
    const [owner, user, other] = await ethers.getSigners();

    const wmon = await (await ethers.getContractFactory("WMON")).deploy();
    const aavePool = await (await ethers.getContractFactory("MockAavePool")).deploy();
    const morphoVault = await (
      await ethers.getContractFactory("MockMorphoVault")
    ).deploy(await wmon.getAddress());
    const aggregator = await (
      await ethers.getContractFactory("ProtocolAggregator")
    ).deploy(await wmon.getAddress());

    await aggregator.registerProtocol(AAVE, await aavePool.getAddress(), "Aave V3");
    await aggregator.registerProtocol(MORPHO, await morphoVault.getAddress(), "Morpho Blue");
    await aggregator.addSupportedAsset(await wmon.getAddress());

    const amount = ethers.parseEther("5");

    return { owner, user, other, wmon, aavePool, morphoVault, aggregator, amount };
  }

  describe("ERC-20 deposits", function () {
    it("depositToAave moves tokens to the pool and records the investment", async function () {
      const { user, token, aavePool, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();

      await expect(aggregator.connect(user).depositToAave(tokenAddress, amount))
        .to.emit(aggregator, "Deposit")
        .withArgs(user.address, AAVE, amount, tokenAddress);

      expect(await token.balanceOf(await aavePool.getAddress())).to.equal(amount);
      expect(await aggregator.deposited(user.address, AAVE, tokenAddress)).to.equal(amount);

      const investments = await aggregator.getUserInvestments(user.address);
      expect(investments.length).to.equal(1);
      expect(investments[0].amount).to.equal(amount);
    });

    it("depositToMorpho moves tokens to the vault and records the investment", async function () {
      const { user, token, morphoVault, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();

      await expect(aggregator.connect(user).depositToMorpho(tokenAddress, amount))
        .to.emit(aggregator, "Deposit")
        .withArgs(user.address, MORPHO, amount, tokenAddress);

      expect(await token.balanceOf(await morphoVault.getAddress())).to.equal(amount);
      expect(await aggregator.deposited(user.address, MORPHO, tokenAddress)).to.equal(amount);
    });

    it("reverts for a non-whitelisted asset", async function () {
      const { user, aggregator, amount } = await loadFixture(deployFixture);
      const rogue = await (await ethers.getContractFactory("MockERC20")).deploy("Rogue", "RGE", 18);
      await rogue.mint(user.address, amount);
      await rogue.connect(user).approve(await aggregator.getAddress(), amount);

      await expect(
        aggregator.connect(user).depositToAave(await rogue.getAddress(), amount)
      ).to.be.revertedWithCustomError(aggregator, "AssetNotWhitelisted");
    });

    it("reverts on zero amount", async function () {
      const { user, token, aggregator } = await loadFixture(deployFixture);
      await expect(
        aggregator.connect(user).depositToAave(await token.getAddress(), 0)
      ).to.be.revertedWithCustomError(aggregator, "ZeroAmount");
    });

    it("reverts when the protocol is not registered or inactive", async function () {
      const { owner, user, token, aggregator, amount } = await loadFixture(deployFixture);
      await aggregator.connect(owner).setProtocolActive(AAVE, false);
      await expect(
        aggregator.connect(user).depositToAave(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(aggregator, "ProtocolNotActive");
    });
  });

  describe("native MON deposits", function () {
    it("depositNativeToAave wraps MON and supplies WMON to the pool", async function () {
      const { user, wmon, aavePool, aggregator, amount } = await loadFixture(nativeFixture);
      const wmonAddress = await wmon.getAddress();

      await expect(aggregator.connect(user).depositNativeToAave({ value: amount }))
        .to.emit(aggregator, "Deposit")
        .withArgs(user.address, AAVE, amount, wmonAddress);

      expect(await wmon.balanceOf(await aavePool.getAddress())).to.equal(amount);
      expect(await aggregator.deposited(user.address, AAVE, wmonAddress)).to.equal(amount);
    });

    it("depositNativeToMorpho wraps MON and deposits WMON into the vault", async function () {
      const { user, wmon, morphoVault, aggregator, amount } = await loadFixture(nativeFixture);
      const wmonAddress = await wmon.getAddress();

      await aggregator.connect(user).depositNativeToMorpho({ value: amount });

      expect(await wmon.balanceOf(await morphoVault.getAddress())).to.equal(amount);
      expect(await aggregator.deposited(user.address, MORPHO, wmonAddress)).to.equal(amount);
    });

    it("reverts on zero value", async function () {
      const { user, aggregator } = await loadFixture(nativeFixture);
      await expect(
        aggregator.connect(user).depositNativeToAave({ value: 0 })
      ).to.be.revertedWithCustomError(aggregator, "ZeroAmount");
    });

    it("reverts when WMON is not configured", async function () {
      const { owner, user, aggregator, amount } = await loadFixture(nativeFixture);
      await aggregator.connect(owner).setWMON(ethers.ZeroAddress);
      await expect(
        aggregator.connect(user).depositNativeToAave({ value: amount })
      ).to.be.revertedWithCustomError(aggregator, "NativeNotSupported");
    });
  });

  describe("ERC-20 withdrawals", function () {
    it("withdrawFromAave returns tokens to the user", async function () {
      const { user, token, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await aggregator.connect(user).depositToAave(tokenAddress, amount);

      const balanceBefore = await token.balanceOf(user.address);
      await expect(aggregator.connect(user).withdrawFromAave(tokenAddress, amount))
        .to.emit(aggregator, "Withdrawal")
        .withArgs(user.address, AAVE, amount);

      expect(await token.balanceOf(user.address)).to.equal(balanceBefore + amount);
      expect(await aggregator.deposited(user.address, AAVE, tokenAddress)).to.equal(0);
    });

    it("withdrawFromMorpho returns tokens to the user", async function () {
      const { user, token, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await aggregator.connect(user).depositToMorpho(tokenAddress, amount);

      const balanceBefore = await token.balanceOf(user.address);
      await aggregator.connect(user).withdrawFromMorpho(tokenAddress, amount);
      expect(await token.balanceOf(user.address)).to.equal(balanceBefore + amount);
    });

    it("reverts when withdrawing more than deposited", async function () {
      const { user, token, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await aggregator.connect(user).depositToAave(tokenAddress, amount);

      await expect(
        aggregator.connect(user).withdrawFromAave(tokenAddress, amount + 1n)
      ).to.be.revertedWithCustomError(aggregator, "InsufficientDeposit");
    });

    it("does not let one user withdraw another user's deposit", async function () {
      const { user, other, token, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await aggregator.connect(user).depositToAave(tokenAddress, amount);

      await expect(
        aggregator.connect(other).withdrawFromAave(tokenAddress, amount)
      ).to.be.revertedWithCustomError(aggregator, "InsufficientDeposit");
    });
  });

  describe("native MON withdrawals", function () {
    it("withdrawNativeFromAave unwraps WMON and sends MON back to the user", async function () {
      const { user, wmon, aggregator, amount } = await loadFixture(nativeFixture);
      const wmonAddress = await wmon.getAddress();
      await aggregator.connect(user).depositNativeToAave({ value: amount });

      await expect(aggregator.connect(user).withdrawNativeFromAave(amount)).to.changeEtherBalances(
        [user, wmon],
        [amount, -amount]
      );
      expect(await aggregator.deposited(user.address, AAVE, wmonAddress)).to.equal(0);
    });

    it("withdrawNativeFromMorpho unwraps WMON and sends MON back to the user", async function () {
      const { user, aggregator, wmon, amount } = await loadFixture(nativeFixture);
      await aggregator.connect(user).depositNativeToMorpho({ value: amount });

      await expect(
        aggregator.connect(user).withdrawNativeFromMorpho(amount)
      ).to.changeEtherBalances([user, wmon], [amount, -amount]);
    });

    it("reverts when withdrawing more native than deposited", async function () {
      const { user, aggregator, amount } = await loadFixture(nativeFixture);
      await aggregator.connect(user).depositNativeToAave({ value: amount });

      await expect(
        aggregator.connect(user).withdrawNativeFromAave(amount + 1n)
      ).to.be.revertedWithCustomError(aggregator, "InsufficientDeposit");
    });
  });

  describe("access control", function () {
    it("only owner can register protocols", async function () {
      const { user, aavePool, aggregator } = await loadFixture(deployFixture);
      await expect(
        aggregator.connect(user).registerProtocol(AAVE, await aavePool.getAddress(), "X")
      ).to.be.revertedWithCustomError(aggregator, "OwnableUnauthorizedAccount");
    });

    it("only owner can whitelist assets", async function () {
      const { user, token, aggregator } = await loadFixture(deployFixture);
      await expect(
        aggregator.connect(user).addSupportedAsset(await token.getAddress())
      ).to.be.revertedWithCustomError(aggregator, "OwnableUnauthorizedAccount");
    });

    it("only owner can change the WMON address", async function () {
      const { user, aggregator } = await loadFixture(deployFixture);
      await expect(
        aggregator.connect(user).setWMON(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(aggregator, "OwnableUnauthorizedAccount");
    });

    it("only owner can emergency-withdraw stuck tokens", async function () {
      const { owner, user, token, aggregator, amount } = await loadFixture(deployFixture);
      const tokenAddress = await token.getAddress();
      await token.mint(await aggregator.getAddress(), amount);

      await expect(
        aggregator.connect(user).emergencyWithdraw(tokenAddress, user.address, amount)
      ).to.be.revertedWithCustomError(aggregator, "OwnableUnauthorizedAccount");

      await aggregator.connect(owner).emergencyWithdraw(tokenAddress, owner.address, amount);
      expect(await token.balanceOf(owner.address)).to.equal(amount);
    });
  });
});
