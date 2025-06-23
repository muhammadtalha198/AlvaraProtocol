const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe.only("Platform Fee Configuration Setup", function () {
  let factory;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    // Deploy all contracts tagged with "all-eth" for a fresh test environment
    const allDeployments = await deployments.fixture(["all-eth"]);
    factory = await ethers.getContractAt("Factory", allDeployments["Factory"].address);

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);

  });

  it("should return the current platform fee config", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig).to.exist;
  });

  it("should have all fees initially set to DEFAULT_FEE", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    expect(feeConfig[0]).to.equal(DEFAULT_FEE);
    expect(feeConfig[1]).to.equal(DEFAULT_FEE);
    expect(feeConfig[2]).to.equal(DEFAULT_FEE);
  });

  it("should allow setting all platform fees to 0%", async function () {
    await expect(factory.setPlatformFeeConfig(0, 0, 0))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(0, 0, 0);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(0);
    expect(feeConfig[1]).to.equal(0);
    expect(feeConfig[2]).to.equal(0);
  });

  it("should allow setting all platform fees to 0.1% ", async function () {
    await expect(factory.setPlatformFeeConfig(10, 10, 10))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(10, 10, 10);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(10);
    expect(feeConfig[1]).to.equal(10);
    expect(feeConfig[2]).to.equal(10);
  });

  it("should allow setting all platform fees to 0.11% ", async function () {
    const NEW_FEE = 11;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.19% ", async function () {
    const NEW_FEE = 19;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.20% ", async function () {
    const NEW_FEE = 20;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.25% ", async function () {
    const NEW_FEE = 25;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.30% ", async function () {
    const NEW_FEE = 30;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.35% ", async function () {
    const NEW_FEE = 35;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.40% ", async function () {
    const NEW_FEE = 40;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.45% ", async function () {
    const NEW_FEE = 45;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should allow setting all platform fees to 0.50% ", async function () {
    const NEW_FEE = 50;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.emit(factory, "PlatformFeesUpdated")
      .withArgs(NEW_FEE, NEW_FEE, NEW_FEE);
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(NEW_FEE);
    expect(feeConfig[1]).to.equal(NEW_FEE);
    expect(feeConfig[2]).to.equal(NEW_FEE);
  });

  it("should revert if setting all platform fees to 0.51% ", async function () {
    const NEW_FEE = 51;
    await expect(factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE))
      .to.be.revertedWithCustomError(factory, "InvalidFee");
  });

  it("should revert if any platform fee is set above DEFAULT_FEE", async function () {
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    const fee = DEFAULT_FEE.toNumber ? DEFAULT_FEE.toNumber() : Number(DEFAULT_FEE);
    await expect(factory.setPlatformFeeConfig(fee + 1, 0, 0))
      .to.be.revertedWithCustomError(factory, "InvalidFee");
    await expect(factory.setPlatformFeeConfig(0, fee + 1, 0))
      .to.be.revertedWithCustomError(factory, "InvalidFee");
    await expect(factory.setPlatformFeeConfig(0, 0, fee + 1))
      .to.be.revertedWithCustomError(factory, "InvalidFee");
  });
  
  it("should have a valid feeCollector address", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    expect(feeCollector).to.properAddress;
  });

  it("should revert if setting feeCollector to an invalid (zero) address", async function () {
    await expect(factory.setFeeCollector("0x0000000000000000000000000000000000000000"))
      .to.be.revertedWithCustomError(factory, "InvalidAddress");
  });

  it("should revert if setting feeCollector to the current feeCollector address", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();
    const currentFeeCollector = feeConfig[3];
    await expect(factory.setFeeCollector(currentFeeCollector))
      .to.be.revertedWithCustomError(factory, "InvalidAddress");
  });

  it("should allow setting a new valid feeCollector address", async function () {

    const signers = await ethers.getSigners();
    const newFeeCollector = signers[1].address;
    // Set the new fee collector
    await expect(factory.setFeeCollector(newFeeCollector))
      .to.emit(factory, "FeeCollectorUpdated")
      .withArgs(newFeeCollector);
    // Check the config updated
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[3]).to.equal(newFeeCollector);
  });

  it("should revert if setPlatformFeeConfig is called by a non-owner", async function () {
    const signers = await ethers.getSigners();
    const nonOwner = signers[1];
    await expect(factory.connect(nonOwner).setPlatformFeeConfig(10, 10, 10))
      .to.be.revertedWith(`AccessControl: account ${nonOwner.address.toString().toLowerCase()} is missing role ${await factory.FEE_MANAGER_ROLE()}`);
  });

  it("should revert if setFeeCollector is called by a non-owner", async function () {
    const signers = await ethers.getSigners();
    const nonOwner = signers[1];
    const newFeeCollector = signers[2].address;
    await expect(factory.connect(nonOwner).setFeeCollector(newFeeCollector))
      .to.be.revertedWith(`AccessControl: account ${nonOwner.address.toString().toLowerCase()} is missing role ${await factory.FEE_MANAGER_ROLE()}`);
  });

});
