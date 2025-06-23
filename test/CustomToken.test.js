const { expect } = require("chai");
const { ethers, deployments, upgrades } = require("hardhat");

describe("CustomToken", () => {
  let owner, user1;
  let customToken;
  const tokenName = "Bitcoin";
  const tokenSymbol = "BTC";

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();

    const CustomToken = await ethers.getContractFactory("CustomToken");
    customToken = await upgrades.deployProxy(CustomToken, [tokenName, tokenSymbol]);
    await customToken.waitForDeployment();
  });

  describe("Initialize Values", function () {
    it(`name of token should be ${tokenName}`, async function () {
      expect(await customToken.name()).to.be.equal(tokenName);
    });

    it(`symbol of token should be ${tokenSymbol}`, async function () {
      expect(await customToken.symbol()).to.be.equal(tokenSymbol);
    });

    it("decimal of token should be 18", async function () {
      expect(await customToken.decimals()).to.be.equal(18);
    });

    it("Supply of token should be 200_000_000", async function () {
      expect(await customToken.totalSupply()).to.be.equal(
        "200000000000000000000000000"
      );
    });
  });
});
