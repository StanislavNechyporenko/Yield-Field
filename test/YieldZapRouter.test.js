const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldZapRouter", function () {
  async function deployFixture() {
    const [owner, user, other] = await ethers.getSigners();

    const wmon = await (await ethers.getContractFactory("WMON")).deploy();
    const usdc = await (await ethers.getContractFactory("MockERC20")).deploy("USD Coin", "USDC", 6);

    const vaultWmonA = await (await ethers.getContractFactory("Mock4626")).deploy(await wmon.getAddress());
    const vaultWmonB = await (await ethers.getContractFactory("Mock4626")).deploy(await wmon.getAddress());
    const vaultUsdc = await (await ethers.getContractFactory("Mock4626")).deploy(await usdc.getAddress());

    const router = await (await ethers.getContractFactory("YieldZapRouter")).deploy(await wmon.getAddress());
    await router.setVault(await vaultWmonA.getAddress(), true);
    await router.setVault(await vaultWmonB.getAddress(), true);
    await router.setVault(await vaultUsdc.getAddress(), true);

    return { owner, user, other, wmon, usdc, vaultWmonA, vaultWmonB, vaultUsdc, router };
  }

  describe("zapMon", function () {
    it("wraps MON and mints vault shares directly to the caller", async function () {
      const { user, wmon, vaultWmonA, router } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("5");

      await expect(router.connect(user).zapMon(await vaultWmonA.getAddress(), 0, { value: amount }))
        .to.emit(router, "Zap")
        .withArgs(user.address, await vaultWmonA.getAddress(), await wmon.getAddress(), amount, amount);

      expect(await vaultWmonA.balanceOf(user.address)).to.equal(amount);
      expect(await wmon.balanceOf(await vaultWmonA.getAddress())).to.equal(amount);
      // non-custodial: the router keeps nothing
      expect(await wmon.balanceOf(await router.getAddress())).to.equal(0);
      expect(await vaultWmonA.balanceOf(await router.getAddress())).to.equal(0);
    });

    it("respects the exact minSharesOut boundary", async function () {
      const { user, vaultWmonA, router } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("2");
      // Mock vault mints 1:1, so minSharesOut == amount must pass.
      await router.connect(user).zapMon(await vaultWmonA.getAddress(), amount, { value: amount });
      expect(await vaultWmonA.balanceOf(user.address)).to.equal(amount);
    });

    it("reverts when fewer shares are minted than minSharesOut", async function () {
      const { user, vaultWmonA, router } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("2");
      await expect(
        router.connect(user).zapMon(await vaultWmonA.getAddress(), amount + 1n, { value: amount })
      ).to.be.revertedWithCustomError(router, "SlippageExceeded");
    });

    it("reverts for a non-whitelisted vault", async function () {
      const { user, wmon, router } = await loadFixture(deployFixture);
      const rogue = await (await ethers.getContractFactory("Mock4626")).deploy(await wmon.getAddress());
      await expect(
        router.connect(user).zapMon(await rogue.getAddress(), 0, { value: 1n })
      ).to.be.revertedWithCustomError(router, "VaultNotWhitelisted");
    });

    it("reverts on zero value", async function () {
      const { user, vaultWmonA, router } = await loadFixture(deployFixture);
      await expect(
        router.connect(user).zapMon(await vaultWmonA.getAddress(), 0, { value: 0 })
      ).to.be.revertedWithCustomError(router, "ZeroAmount");
    });
  });

  describe("diversifyMon", function () {
    it("splits MON across several vaults in one transaction", async function () {
      const { user, vaultWmonA, vaultWmonB, router } = await loadFixture(deployFixture);
      const a = ethers.parseEther("3");
      const b = ethers.parseEther("2");

      await router
        .connect(user)
        .diversifyMon(
          [await vaultWmonA.getAddress(), await vaultWmonB.getAddress()],
          [a, b],
          [a, b],
          { value: a + b }
        );

      expect(await vaultWmonA.balanceOf(user.address)).to.equal(a);
      expect(await vaultWmonB.balanceOf(user.address)).to.equal(b);
    });

    it("reverts when the parts do not sum to msg.value", async function () {
      const { user, vaultWmonA, vaultWmonB, router } = await loadFixture(deployFixture);
      await expect(
        router
          .connect(user)
          .diversifyMon(
            [await vaultWmonA.getAddress(), await vaultWmonB.getAddress()],
            [1n, 1n],
            [0n, 0n],
            { value: 3n }
          )
      ).to.be.revertedWithCustomError(router, "PartsMustSumToValue");
    });

    it("reverts on array length mismatch", async function () {
      const { user, vaultWmonA, router } = await loadFixture(deployFixture);
      await expect(
        router
          .connect(user)
          .diversifyMon([await vaultWmonA.getAddress()], [1n, 1n], [0n, 0n], { value: 2n })
      ).to.be.revertedWithCustomError(router, "LengthMismatch");
      await expect(
        router.connect(user).diversifyMon([await vaultWmonA.getAddress()], [1n], [], { value: 1n })
      ).to.be.revertedWithCustomError(router, "LengthMismatch");
    });
  });

  describe("zapErc20", function () {
    it("routes the vault's asset and mints shares to the caller", async function () {
      const { user, usdc, vaultUsdc, router } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("1000", 6);
      await usdc.mint(user.address, amount);
      await usdc.connect(user).approve(await router.getAddress(), amount);

      await expect(router.connect(user).zapErc20(await vaultUsdc.getAddress(), amount, amount))
        .to.emit(router, "Zap")
        .withArgs(user.address, await vaultUsdc.getAddress(), await usdc.getAddress(), amount, amount);

      expect(await vaultUsdc.balanceOf(user.address)).to.equal(amount);
      expect(await usdc.balanceOf(await router.getAddress())).to.equal(0);
    });

    it("reverts when fewer shares are minted than minSharesOut", async function () {
      const { user, usdc, vaultUsdc, router } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("10", 6);
      await usdc.mint(user.address, amount);
      await usdc.connect(user).approve(await router.getAddress(), amount);
      await expect(
        router.connect(user).zapErc20(await vaultUsdc.getAddress(), amount, amount + 1n)
      ).to.be.revertedWithCustomError(router, "SlippageExceeded");
    });

    it("reverts for a non-whitelisted vault and zero amount", async function () {
      const { user, usdc, vaultUsdc, router } = await loadFixture(deployFixture);
      const rogue = await (await ethers.getContractFactory("Mock4626")).deploy(await usdc.getAddress());
      await expect(
        router.connect(user).zapErc20(await rogue.getAddress(), 1n, 0)
      ).to.be.revertedWithCustomError(router, "VaultNotWhitelisted");
      await expect(
        router.connect(user).zapErc20(await vaultUsdc.getAddress(), 0, 0)
      ).to.be.revertedWithCustomError(router, "ZeroAmount");
    });
  });

  describe("access control & rescue", function () {
    it("only owner can manage the whitelist", async function () {
      const { user, vaultWmonA, router } = await loadFixture(deployFixture);
      await expect(
        router.connect(user).setVault(await vaultWmonA.getAddress(), false)
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });

    it("only owner can rescue stuck tokens", async function () {
      const { owner, user, usdc, router } = await loadFixture(deployFixture);
      const amount = ethers.parseUnits("10", 6);
      await usdc.mint(await router.getAddress(), amount);
      await expect(
        router.connect(user).rescue(await usdc.getAddress(), user.address, amount)
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
      await router.connect(owner).rescue(await usdc.getAddress(), owner.address, amount);
      expect(await usdc.balanceOf(owner.address)).to.equal(amount);
    });

    it("owner can rescue force-sent native MON", async function () {
      const { owner, user, router } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1");
      await (
        await ethers.getContractFactory("ForceSend")
      ).deploy(await router.getAddress(), { value: amount });

      await expect(
        router.connect(user).rescueNative(user.address, amount)
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");

      await expect(router.connect(owner).rescueNative(owner.address, amount)).to.changeEtherBalances(
        [owner, router],
        [amount, -amount]
      );
    });
  });
});
