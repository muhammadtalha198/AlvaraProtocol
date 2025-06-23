const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("WETH", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let wETH;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    const WETH = await ethers.getContractFactory("WETH");
    wETH = await upgrades.deployProxy(WETH);
    await wETH.waitForDeployment();
  });

  describe("Initialize Values", function () {
    it("name of token should be Wrapped Ether", async function () {
      expect(await wETH.name()).to.be.equal("Wrapped Ether");
    });

    it("symbol of token should be WETH", async function () {
      expect(await wETH.symbol()).to.be.equal("WETH");
    });

    it("decimal of token should be 18", async function () {
      expect(await wETH.decimals()).to.be.equal(18);
    });

    it("deployer should be owner", async function () {
      expect(await wETH.owner()).to.be.equal(owner.address);
    });
  });

  describe("WETH deposit", function () {
    it("user balance should be updated after deposit", async () => {
      let userInitialBal = await wETH.balanceOf(user1.address);
      expect(userInitialBal).to.be.equal(0);
      let value = (5e18).toString();

      const wethAddress = await wETH.getAddress();
      const initialContractBalance = await ethers.provider.getBalance(
        wethAddress
      );

      expect(initialContractBalance).to.be.equal(0);

      await wETH.connect(user1).deposit({ value });

      let userUpdatedBal = await wETH.balanceOf(user1.address);
      expect(userUpdatedBal).to.be.equal(value);

      const updatedContractBalance = await ethers.provider.getBalance(
        wethAddress
      );

      expect(updatedContractBalance).to.be.equal(value);
    });
  });

  describe("WETH withdraw", function () {
    it("Withdraw should send Eth to owner", async () => {
      let userInitialBal = await ethers.provider.getBalance(user1.address);
      let ownerInitialBal = await ethers.provider.getBalance(owner.address);

      let initialBal = 900;

      expect(+ethers.formatEther(userInitialBal)).to.be.greaterThan(initialBal);
      expect(+ethers.formatEther(ownerInitialBal)).to.be.greaterThan(
        initialBal
      );

      let userInitialBalWeth = await wETH.balanceOf(user1.address);

      expect(userInitialBalWeth).to.be.equal(0);

      let value = (5e18).toString();

      await wETH.connect(user1).deposit({ value });

      let userUpdatedBalWeth = await wETH.balanceOf(user1.address);
      let userUpdatedBal = await ethers.provider.getBalance(user1.address);

      expect(userUpdatedBalWeth).to.be.equal(value);

      expect(+ethers.formatEther(userUpdatedBal)).to.be.lessThan(
        +ethers.formatEther(userInitialBal - BigInt(value))
      );

      await wETH.connect(owner).withdraw();
      let ownerUpdatedBal = await ethers.provider.getBalance(owner.address);

      expect(Math.round(+ethers.formatEther(ownerUpdatedBal))).to.be.equal(
        Math.round(+ethers.formatEther(ownerInitialBal + BigInt(value)))
      );
    });

    it("can't withdraw if balance is 0", async () => {
      let wETHBalance = await ethers.provider.getBalance(
        await wETH.getAddress()
      );

      await expect(wETH.connect(owner).withdraw()).to.be.revertedWith(
        "Not enough balance to withdraw"
      );
    });

    it("only owner can call withdrw ", async () => {
      await expect(wETH.connect(user1).withdraw()).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("WETH Minting", function () {
    it("Only Owner can mint", async function () {
      await wETH.mint(user1.address, "10000000000000000000");
      expect(await wETH.balanceOf(user1.address)).to.be.equal(
        "10000000000000000000"
      );
    });
    it("Failed if non-Owner mint", async function () {
      await expect(
        wETH.connect(user1).mint(user2.address, "10000000000000000000")
      ).to.be.revertedWith(`Ownable: caller is not the owner`);
    });
  });

  describe("WETH Burning", function () {
    const amount = "1000000000";
    beforeEach(async function () {
      await wETH.mint(user1.address, amount.toString());
      expect(await wETH.balanceOf(user1.address)).to.be.equal(amount);
    });

    it("Only Owner can burn", async function () {
      const supply = await wETH.totalSupply();
      expect(supply).to.equal(amount);
      let user1Balance = await wETH.balanceOf(user1.address);
      expect(user1Balance).to.equal(amount);

      await wETH["burn(address, uint256)"](user1.address, amount);

      let newUser1Balance = await wETH.balanceOf(user1.address);

      expect(newUser1Balance).to.equal(0);

      const newSupply = await wETH.totalSupply();
      expect(newSupply).to.equal(0);
    });

    it("Failed if non-Owner burn", async function () {
      await expect(
        wETH.connect(user2)["burn(address, uint256)"](user1.address, amount)
      ).to.be.revertedWith(`Ownable: caller is not the owner`);
    });
  });

  describe("WETH Ownable", function () {
    it("Transfer-ownership can transfer the ownership to new address", async function () {
      const ownerAddress = await wETH.owner();
      expect(ownerAddress).to.equal(owner.address);

      await wETH.transferOwnership(user1.address);

      const newOwnerAddress = await wETH.owner();
      expect(newOwnerAddress).to.equal(user1.address);
    });

    it("Only current owner can transfer the ownership", async function () {
      const ownerAddress = await wETH.owner();
      expect(ownerAddress).to.equal(owner.address);

      await wETH.transferOwnership(user1.address);

      const newOwnerAddress = await wETH.owner();
      expect(newOwnerAddress).to.equal(user1.address);

      await expect(wETH.transferOwnership(user3.address)).to.be.rejectedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
