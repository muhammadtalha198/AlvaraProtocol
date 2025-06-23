const { expect } = require("chai");
const { ethers, upgrades, deployments } = require("hardhat");
const { createBTSAndGetInstance } = require("./utils/bts-helper");

describe.only("Alvara-protocol", () => {
  let allDeployments;
  let owner, user1, user2, user3, user4, user5, user6;
  let router, wETH, alva, btsBeacon, btsPairBeacon, factory, bts, btsPair;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    allDeployments = await deployments.fixture(["all-eth"]);

    wETH = await ethers.getContractAt("WETH", allDeployments["WETH"].address);

    router = await ethers.getContractAt(
      "UniswapV2Router02",
      allDeployments["UniswapV2Router02"].address
    );

    alva = await ethers.getContractAt(
      "Alvara",
      allDeployments["Alvara"].address
    );

    bts = await ethers.getContractAt(
      "BasketTokenStandard",
      allDeployments["BasketTokenStandard"].address
    );

    btsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      allDeployments["BasketTokenStandardPair"].address
    );

    btsBeacon = await ethers.getContractAt(
      "BTSBeacon",
      allDeployments["BTSBeacon"].address
    );

    btsPairBeacon = await ethers.getContractAt(
      "BTSPairBeacon",
      allDeployments["BTSPairBeacon"].address
    );

    factory = await ethers.getContractAt(
      "Factory",
      allDeployments["Factory"].address
    );

    await preprocessing();
  });

  const preprocessing = async () => {
    await setAlvaTokenDetails();
    await alvaPreprocessing();
  };

  const alvaPreprocessing = async () => {
    await alva.setListingTimestamp(0);
  };

  const setWETHTokenDetails = async () => {
    const wethPriceInEth = ethers.parseEther("1"); // Alva price in USD, then usd to eth, then eth to wei
    const wethAddress = await wETH.getAddress();

    let res = await setTokenDetails(wethAddress, wethPriceInEth, wETH);

    return res;
  };

  const setAlvaTokenDetails = async () => {
    const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in USD, then usd to eth, then eth to wei
    const alvaAddress = await alva.getAddress();

    let res = await setTokenDetails(alvaAddress, alvaPriceInEth, alva);

    return res;
  };

  const setTokenDetails = async (tokenAddress, priceInEth, tokenContract) => {
    const wethAddress = await wETH.getAddress();

    await router.setTokenDetails(tokenAddress, owner, priceInEth);

    const path1 = [wethAddress, tokenAddress];

    let amountOfTokens1 = await router.getAmountsOut(priceInEth, path1);

    expect(amountOfTokens1[1]).to.be.equal(ethers.parseEther("1"));

    const routerAddress = await router.getAddress();
    const allowedAmount = ethers.parseEther("10000000000000000000000000000");

    tokenContract.approve(routerAddress, allowedAmount);

    return {
      priceInEth,
      wethAddress,
      tokenAddress,
      path1,
      amountOfTokens1,
    };
  };

  describe("Initialize Values", function () {
    it("Alva should be initialized", async function () {
      let alvaAddress = await alva.getAddress();
      let factoryAlvaAddress = await factory.alva();
      expect(factoryAlvaAddress).to.be.equal(alvaAddress);
    });

    it("Bts should be initialized", async function () {
      let btsAddress = await btsBeacon.getAddress();
      let factoryBtsAddress = await factory.btsImplementation();
      expect(factoryBtsAddress).to.be.equal(btsAddress);
    });

    it("Bts Pair should be initialized", async function () {
      let btsPairAddress = await btsPairBeacon.getAddress();
      let factoryBtsPairAddress = await factory.btsPairImplementation();
      expect(factoryBtsPairAddress).to.be.equal(btsPairAddress);
    });

    it("Minimum Percentage should be 5%", async function () {
      let factoryMinAlvaPercentage = await factory.minPercentALVA();
      expect(factoryMinAlvaPercentage).to.be.equal(500);
    });

    it("Bts should be set to BeaconProxy", async function () {
      let btsAddress = await bts.getAddress();
      let beaconBtsAddress = await btsBeacon.implementation();
      expect(btsAddress).to.be.equal(beaconBtsAddress);
    });

    it("BtsPair should be set to BeaconProxy", async function () {
      let btspairAddress = await btsPair.getAddress();
      let beaconBtspairAddress = await btsPairBeacon.implementation();
      expect(btspairAddress).to.be.equal(beaconBtspairAddress);
    });
  });

  describe("Bts", function () {   
    it("Bts should be created", async function () {
      const name = "MY BTS";
      const symbol = "M-BTS";
      const alvaAddress = await alva.getAddress();
      const tokens = [alvaAddress];
      const weights = ["10000"];
      const tokenURI = "https://my-bts/testing.json";
      const autoRebalance = true;
      const buffer = "1000";
      const description = "This is testing BTS";
      const id = "1";

      const initialInvestingAmount = "5";

      const btsInstance = await createBTSAndGetInstance(factory, owner, name, symbol, tokens, weights, tokenURI, buffer, id, description, autoRebalance, initialInvestingAmount);
      const btsOwner = await btsInstance.ownerOf(0);
      expect(btsOwner).to.be.equal(owner.address);

    });
    it("should assign the correct owner to the newly created BTS token", async function () {
      const name = "MY BTS";
      const symbol = "M-BTS";
      const alvaAddress = await alva.getAddress();
      const tokens = [alvaAddress];
      const weights = ["10000"];
      const tokenURI = "https://my-bts/testing.json";
      const autoRebalance = true;
      const buffer = "1000";
      const description = "This is testing BTS";
      const id = "1";

      const initialInvestingAmount = "5";

      const btsInstance = await createBTSAndGetInstance(factory, owner, name, symbol, tokens, weights, tokenURI, buffer, id, description, autoRebalance, initialInvestingAmount);
      const btsOwner = await btsInstance.ownerOf(0);
      expect(btsOwner).to.be.equal(owner.address);
    });
    it("should set the correct factory address in the BTS contract", async function () {
      const name = "MY BTS";
      const symbol = "M-BTS";
      const alvaAddress = await alva.getAddress();
      const tokens = [alvaAddress];
      const weights = ["10000"];
      const tokenURI = "https://my-bts/testing.json";
      const autoRebalance = true;
      const buffer = "1000";
      const description = "This is testing BTS";
      const id = "1";

      const initialInvestingAmount = "5";

      const btsInstance = await createBTSAndGetInstance(factory, owner, name, symbol, tokens, weights, tokenURI, buffer, id, description, autoRebalance, initialInvestingAmount);

      const btsFactory = await btsInstance.factory();
      expect(btsFactory).to.be.equal(await factory.getAddress());
    });
  });
});
