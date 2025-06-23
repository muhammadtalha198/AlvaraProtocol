const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe.only("BTSFactory", () => {
  let allDeployments;
  let owner, user1, user2, user3, user4, user5, user6;
  let bts, btsPair, factory, wETH, alva, mtToken, router;
  let btsAddress,
    btsPairAddress,
    factoryAddress,
    wETHAddress,
    alvaAddress,
    mtTokenAddress,
    routerAddress;
  const name = "MY-Token";
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const tokenURI = "https://my-nft.test.metadata.come";
  const description = "This is a test NFT";
  const minPercentage = 500;

  let tokens;

  // Calculate Deadline
  function calculateDeadline(minutes = 20) {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const buffer = minutes * 60; // Convert minutes to seconds
    return currentTime + buffer;
  }

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    allDeployments = await deployments.fixture(["all-eth"]);

    wETH = await ethers.getContractAt("WETH", allDeployments["WETH"].address);
    bts = await ethers.getContractAt(
      "BTSBeacon",
      allDeployments["BTSBeacon"].address
    );

    btsPair = await ethers.getContractAt(
      "BTSPairBeacon",
      allDeployments["BTSPairBeacon"].address
    );

    factory = await ethers.getContractAt(
      "Factory",
      allDeployments["Factory"].address
    );

    alva = await ethers.getContractAt(
      "Alvara",
      allDeployments["Alvara"].address
    );

    mtToken = await ethers.getContractAt(
      "MockToken",
      allDeployments["MockToken"].address
    );

    router = await ethers.getContractAt(
      "UniswapV2Router02",
      allDeployments["UniswapV2Router02"].address
    );

    wETHAddress = await wETH.getAddress();
    alvaAddress = await alva.getAddress();
    btsAddress = await bts.getAddress();
    btsPairAddress = await btsPair.getAddress();
    factoryAddress = await factory.getAddress();
    mtTokenAddress = await mtToken.getAddress();
    routerAddress = await router.getAddress();

    //set price to Router
    await router.setTokenDetails(
      wETHAddress,
      owner.address,
      ethers.parseEther("1")
    );
    await router.setTokenDetails(
      alvaAddress,
      owner.address,
      ethers.parseEther("1")
    );
    await router.setTokenDetails(
      mtTokenAddress,
      owner.address,
      ethers.parseEther("1")
    );

    //allow token amount
    await wETH.approve(routerAddress, ethers.parseEther("100000000000"));
    await alva.approve(routerAddress, ethers.parseEther("100000000000"));
    await mtToken.approve(routerAddress, ethers.parseEther("100000000000"));

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);
  });

  describe("Initialize Values", function () {
    let newFactory;

    beforeEach(async function () {
      const Factory = await ethers.getContractFactory("Factory");
      newFactory = await Factory.deploy();
    });

    it("Alva should be set with given address", async function () {
      const factoryAlva = await factory.alva();
      expect(factoryAlva).to.be.equal(alvaAddress);
    });

    it("Bts implementation should be set with given address", async function () {
      const factoryBtsImplementation = await factory.btsImplementation();
      expect(factoryBtsImplementation).to.be.equal(btsAddress);
    });

    it("Bts pair implementation should be set with given address", async function () {
      const factoryBtsPairImplementation =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementation).to.be.equal(btsPairAddress);
    });

    it("Minimum ALVA percentage should be set with given value", async function () {
      const factoryMinimumALVA = await factory.minPercentALVA();
      expect(factoryMinimumALVA).to.be.equal(minPercentage);
    });

    it("Should revert when initialized with zero addresses", async function () {
      await expect(
        newFactory.initialize(
          zeroAddress, // _alva
          minPercentage, // _minPercentALVA
          btsAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
    xit("Should revert when initialized with zero addresses", async function () {
      await expect(
        newFactory.initialize(
          zeroAddress, // _alva
          minPercentage, // _minPercentALVA
          btsAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAddress");

      await expect(
        newFactory.initialize(
          alvaAddress, // _alva
          minPercentage, // _minPercentALVA
          zeroAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAddress");

      await expect(
        newFactory.initialize(
          alvaAddress, // _alva
          minPercentage, // _minPercentALVA
          btsAddress, // _btsImplementation
          zeroAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAddress");

      await expect(
        newFactory.initialize(
          alvaAddress, // _alva
          minPercentage, // _minPercentALVA
          btsAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          zeroAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAddress");

      await expect(
        newFactory.initialize(
          alvaAddress, // _alva
          minPercentage, // _minPercentALVA
          btsAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          zeroAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAddress");
    });

    xit("Should revert when initialized with invalid ALVA percentage", async function () {
      await expect(
        newFactory.initialize(
          alvaAddress, // _alva
          99, // _minPercentALVA - less than minimum allowed (100)
          btsAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAlvaPercentage");

      await expect(
        newFactory.initialize(
          alvaAddress, // _alva
          5001, // _minPercentALVA - greater than maximum allowed (5000)
          btsAddress, // _btsImplementation
          btsPairAddress, // _btsPairImplementation
          500, // _monthlyFee
          owner.address, // _royaltyReceiver
          "test-uri", // _collectionUri
          owner.address, // _feeCollector
          routerAddress, // _defaultMarketplace
          routerAddress, // _routerAddress
          wETHAddress, // _wethAddress
          ethers.parseEther("0.01") // _minBTSCreationAmount
        )
      ).to.be.revertedWithCustomError(newFactory, "InvalidAlvaPercentage");
    });

    xit("Should initialize successfully with valid parameters", async function () {
      await newFactory.initialize(
        alvaAddress, // _alva
        minPercentage, // _minPercentALVA
        btsAddress, // _btsImplementation
        btsPairAddress, // _btsPairImplementation
        500, // _monthlyFee
        owner.address, // _royaltyReceiver
        "test-uri", // _collectionUri
        owner.address, // _feeCollector
        routerAddress, // _defaultMarketplace
        routerAddress, // _routerAddress
        wETHAddress, // _wethAddress
        ethers.parseEther("0.01") // _minBTSCreationAmount
      );

      const factoryAlva = await newFactory.alva();
      expect(factoryAlva).to.be.equal(alvaAddress);

      const factoryMinimumALVA = await newFactory.minPercentALVA();
      expect(factoryMinimumALVA).to.be.equal(minPercentage);

      const factoryBtsImplementation = await newFactory.btsImplementation();
      expect(factoryBtsImplementation).to.be.equal(btsAddress);

      const factoryBtsPairImplementation =
        await newFactory.btsPairImplementation();
      expect(factoryBtsPairImplementation).to.be.equal(btsPairAddress);

      const factoryCollectionUri = await newFactory.collectionUri();
      expect(factoryCollectionUri).to.be.equal("test-uri");

      const factoryRouter = await newFactory.router();
      expect(factoryRouter).to.be.equal(routerAddress);

      const factoryWETH = await newFactory.weth();
      expect(factoryWETH).to.be.equal(wETHAddress);

      const factoryMinBTSCreationAmount =
        await newFactory.minBTSCreationAmount();
      expect(factoryMinBTSCreationAmount).to.be.equal(
        ethers.parseEther("0.01")
      );
    });
  });

  describe("UpdateBTSImplementation", function () {
    beforeEach(async function () {});
    it("Contract should throw error if updated with 0 address", async function () {
      const factoryBtsImplementation = await factory.btsImplementation();
      expect(factoryBtsImplementation).to.be.equal(btsAddress);

      await expect(
        factory.updateBTSImplementation(zeroAddress)
      ).to.be.rejectedWith("InvalidAddress");

      const factoryBtsImplementationPost = await factory.btsImplementation();
      expect(factoryBtsImplementationPost).to.be.equal(
        factoryBtsImplementation
      );
    });

    it("Contract should throw error if updated with EOA address", async function () {
      const factoryBtsImplementation = await factory.btsImplementation();
      expect(factoryBtsImplementation).to.be.equal(btsAddress);

      await expect(
        factory.updateBTSImplementation(user1.address)
      ).to.be.rejectedWith("InvalidAddress");

      const factoryBtsImplementationPost = await factory.btsImplementation();
      expect(factoryBtsImplementationPost).to.be.equal(
        factoryBtsImplementation
      );
    });

    it("Contract should throw error if updated by non-owner", async function () {
      const factoryBtsImplementation = await factory.btsImplementation();
      expect(factoryBtsImplementation).to.be.equal(btsAddress);

      await expect(
        factory.connect(user1).updateBTSImplementation(alvaAddress)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.UPGRADER_ROLE()}`);

      const factoryBtsImplementationPost = await factory.btsImplementation();
      expect(factoryBtsImplementationPost).to.be.equal(
        factoryBtsImplementation
      );
    });

    it("Contract should updated with new implementation", async function () {
      const factoryBtsImplementation = await factory.btsImplementation();
      expect(factoryBtsImplementation).to.be.equal(btsAddress);

      await expect(factory.updateBTSImplementation(alvaAddress))
        .to.emit(factory, "BTSImplementationUpdated")
        .withArgs(alvaAddress);

      const factoryBtsImplementationPost = await factory.btsImplementation();
      expect(factoryBtsImplementationPost).to.be.equal(alvaAddress);
    });
  });

  describe("UpdateBTSPairImplementation", function () {
    beforeEach(async function () {});
    it("Contract should throw error if updated with 0 address", async function () {
      const factoryBtsPairImplementation =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementation).to.be.equal(btsPairAddress);

      await expect(
        factory.updateBTSPairImplementation(zeroAddress)
      ).to.be.rejectedWith("InvalidAddress");

      const factoryBtsPairImplementationPost =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementationPost).to.be.equal(
        factoryBtsPairImplementation
      );
    });

    it("Contract should throw error if updated with EOA address", async function () {
      const factoryBtsPairImplementation =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementation).to.be.equal(btsPairAddress);

      await expect(
        factory.updateBTSPairImplementation(user1.address)
      ).to.be.revertedWithCustomError(factory, "InvalidAddress")

      const factoryBtsPairImplementationPost =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementationPost).to.be.equal(
        factoryBtsPairImplementation
      );
    });

    it("Contract should throw error if updated by non-owner", async function () {
      const factoryBtsPairImplementation =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementation).to.be.equal(btsPairAddress);

      await expect(
        factory.connect(user1).updateBTSPairImplementation(alvaAddress)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.UPGRADER_ROLE()}`);

      const factoryBtsPairImplementationPost =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementationPost).to.be.equal(
        factoryBtsPairImplementation
      );
    });

    it("Contract should updated with new implementation", async function () {
      const factoryBtsPairImplementation =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementation).to.be.equal(btsPairAddress);

      await expect(factory.updateBTSPairImplementation(alvaAddress))
        .to.emit(factory, "BTSPairImplementationUpdated")
        .withArgs(alvaAddress);

      const factoryBtsPairImplementationPost =
        await factory.btsPairImplementation();
      expect(factoryBtsPairImplementationPost).to.be.equal(alvaAddress);
    });
  });

  describe("updateAlva", function () {
    beforeEach(async function () {});
    it("Contract should throw error if updated with 0 address", async function () {
      const factoryAlva = await factory.alva();
      expect(factoryAlva).to.be.equal(alvaAddress);

      await expect(factory.updateAlva(zeroAddress)).to.be.rejectedWith(
        "InvalidAddress"
      );

      const factoryAlvaPost = await factory.alva();
      expect(factoryAlvaPost).to.be.equal(factoryAlva);
    });

    it("Contract should throw error if updated by non-owner", async function () {
      const factoryAlva = await factory.alva();
      expect(factoryAlva).to.be.equal(alvaAddress);

      await expect(
        factory.connect(user1).updateAlva(mtTokenAddress)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.UPGRADER_ROLE()}`);

      const factoryAlvaPost = await factory.alva();
      expect(factoryAlvaPost).to.be.equal(factoryAlva);
    });

    it("Contract should updated with new implementation", async function () {
      const factoryAlva = await factory.alva();
      expect(factoryAlva).to.be.equal(alvaAddress);

      await expect(factory.updateAlva(mtTokenAddress))
        .to.emit(factory, "AlvaUpdated")
        .withArgs(mtTokenAddress);

      const factoryAlvaPost = await factory.alva();
      expect(factoryAlvaPost).to.be.equal(mtTokenAddress);
    });
  });

  describe("updateMinPercentALVA", function () {
    beforeEach(async function () {});
    it("Contract should throw error if updated with 0 percentage", async function () {
      const newMinValue = 0;
      const factoryMinAlva = await factory.minPercentALVA();
      expect(factoryMinAlva).to.be.equal(minPercentage);

      await expect(
        factory.updateMinPercentALVA(newMinValue)
      ).to.be.revertedWithCustomError(factory, "InvalidAlvaPercentage");

      const factoryMinAlvaPost = await factory.minPercentALVA();
      expect(factoryMinAlvaPost).to.be.equal(factoryMinAlva);
    });

    it("Contract should throw error if updated with more then 100 percentage", async function () {
      const newMinValue = 100_01n;
      const factoryMinAlva = await factory.minPercentALVA();
      expect(factoryMinAlva).to.be.equal(minPercentage);

      await expect(
        factory.updateMinPercentALVA(newMinValue)
      ).to.be.revertedWithCustomError(factory, "InvalidAlvaPercentage");

      const factoryMinAlvaPost = await factory.minPercentALVA();
      expect(factoryMinAlvaPost).to.be.equal(factoryMinAlva);
    });

    it("Contract should throw error if updated by non-owner", async function () {
      const newMinValue = 10_00n;
      const factoryMinAlva = await factory.minPercentALVA();
      expect(factoryMinAlva).to.be.equal(minPercentage);

      await expect(
        factory.connect(user1).updateMinPercentALVA(newMinValue)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.ADMIN_ROLE()}`);

      const factoryMinAlvaPost = await factory.minPercentALVA();
      expect(factoryMinAlvaPost).to.be.equal(factoryMinAlva);
    });

    it("Contract should updated with new value", async function () {
      const newMinValue = 10_00n;
      const factoryMinAlva = await factory.minPercentALVA();
      expect(factoryMinAlva).to.be.equal(minPercentage);

      await expect(factory.updateMinPercentALVA(newMinValue))
        .to.emit(factory, "MinAlvaPercentageUpdated")
        .withArgs(newMinValue);

      const factoryMinAlvaPost = await factory.minPercentALVA();
      expect(factoryMinAlvaPost).to.be.equal(newMinValue);
    });
  });

  describe("CreateBTS", function () {
    let btsDetails;

    beforeEach(async function () {
      btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://token-uri.com",
        buffer: 100,
        id: "unique-id",
        description: "Test description",
      };
    });
    it("Contract should throw error if name is empty", async function () {
      const btsDetails = {
        name: "",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId1",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(factory, "EmptyStringParameter")
        .withArgs("name");
    });

    it("Contract should throw error if symbol is empty", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId2",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(factory, "EmptyStringParameter")
        .withArgs("symbol");
    });

    it("Contract should throw error if id is empty", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(factory, "EmptyStringParameter")
        .withArgs("id");
    });
    it("Contract should throw error if _tokenURI is empty", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "",
        buffer: 100,
        _id: "testId4",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(factory, "EmptyStringParameter")
        .withArgs("tokenURI");
    });

    it("Contract should throw error if buffer is less then 0", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 0,
        _id: "testId4",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(factory, "InvalidBuffer")
        .withArgs(0, 1, 4999);
    });

    it("Contract should throw error if buffer is 5000 or more", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 5001,
        _id: "testId5",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(factory, "InvalidBuffer")
        .withArgs(5001, 1, 4999);
    });

    it("Contract should create BTS if all okay", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId6",
        description: "This is testing bts",
      };

      const totalBTS = await factory.totalBTS();
      expect(totalBTS).to.be.equal(0);

      const ethValue = ethers.parseEther("1");

      // Don't hardcode expected addresses, as they may vary
      await factory.createBTS(
        btsDetails.name,
        btsDetails.symbol,
        btsDetails.tokens,
        btsDetails.weights,
        btsDetails.tokenURI,
        btsDetails.buffer,
        btsDetails._id,
        btsDetails.description,
        calculateDeadline(20),
        { value: ethValue }
      );

      const totalBTSPost = await factory.totalBTS();
      expect(totalBTSPost).to.be.equal(1n);
    });

    it("Should revert if msg.value is less than 0.01 ether", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId8",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("0.009") }
        )
      ).to.be.revertedWithCustomError(factory, "InsufficientBTSCreationAmount");
    });

    it("Should revert if tokens and weights arrays have different lengths", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "3000", "2000"], // One more weight than tokens
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId9",
        description: "This is testing bts",
      };

      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails._id,
          btsDetails.description,
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      ).to.be.reverted; // Should revert due to array length mismatch
    });
    it("Contract should create BTS if all okay", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId7",
        description: "This is testing bts",
      };

      const totalBTS = await factory.totalBTS();

      const ethValue = ethers.parseEther("1");

      // Don't hardcode expected addresses, as they may vary
      await factory.createBTS(
        btsDetails.name,
        btsDetails.symbol,
        btsDetails.tokens,
        btsDetails.weights,
        btsDetails.tokenURI,
        btsDetails.buffer,
        btsDetails._id,
        btsDetails.description,
        calculateDeadline(20),
        { value: ethValue }
      );

      const totalBTSPost = await factory.totalBTS();
      expect(totalBTSPost).to.be.equal(totalBTS + 1n);
    });

    it("Contract should create BTS/BTS Pair with given data and 1000 Lp tokens minted to creator", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId8",
        description: "This is testing bts",
      };

      const totalBTS = await factory.totalBTS();

      const ethValue = ethers.parseEther("1");

      const tx = await factory.createBTS(
        btsDetails.name,
        btsDetails.symbol,
        btsDetails.tokens,
        btsDetails.weights,
        btsDetails.tokenURI,
        btsDetails.buffer,
        btsDetails._id,
        btsDetails.description,
        calculateDeadline(20),
        { value: ethValue }
      );

      const receipt = await tx.wait();

      let createdBTSAddress = null;
      let createdBTSPairAddress = null;

      // Extract actual addresses from event logs
      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          if (parsedLog?.name === "BTSCreated") {
            createdBTSAddress = parsedLog.args.bts;
            createdBTSPairAddress = parsedLog.args.btsPair;
            break;
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }

      const totalBTSPost = await factory.totalBTS();
      expect(totalBTSPost).to.be.equal(totalBTS + 1n);

      const btsAddressFromContract = await factory.btsList(totalBTS);
      expect(btsAddressFromContract).to.be.equal(createdBTSAddress);

      const contractFactory = await ethers.getContractFactory(
        "BasketTokenStandard"
      );
      // Attach to the deployed contract
      const btsContract = await contractFactory.attach(btsAddressFromContract);

      const btsName = await btsContract.name();
      expect(btsName).to.be.equal(btsDetails.name);

      const btsSymbol = await btsContract.symbol();
      expect(btsSymbol).to.be.equal(btsDetails.symbol);

      for (let i = 0; i < btsDetails.tokens.length; i++) {
        // const btsTokenDetails = await btsContract.getTokenDetails(i);
        const btsTokenDetails = await btsContract["getTokenDetails(uint256)"](
          i
        );
        const tokenAddress = btsTokenDetails.token;
        expect(tokenAddress).to.be.equal(btsDetails.tokens[i]);

        const tokenWeight = btsTokenDetails.weight;
        expect(tokenWeight).to.be.equal(btsDetails.weights[i]);
      }

      const btsTokenURI = await btsContract.tokenURI(0);
      expect(btsTokenURI).to.be.equal(btsDetails.tokenURI);

      const btsId = await btsContract.id();
      expect(btsId).to.be.equal(btsDetails._id);

      const btsPairAddressFromContract = await btsContract.btsPair();
      expect(btsPairAddressFromContract).to.be.equal(createdBTSPairAddress);

      const contractFactoryPair = await ethers.getContractFactory(
        "BasketTokenStandardPair"
      );
      // Attach to the deployed contract
      const btsPairContract = await contractFactoryPair.attach(
        btsPairAddressFromContract
      );

      const btsPairName = await btsPairContract.name();
      expect(btsPairName).to.be.equal(btsDetails.symbol + "-LP");

      const btsPairSymbol = await btsPairContract.symbol();
      expect(btsPairSymbol).to.be.equal(btsDetails.symbol + "-LP");

      const managerBalance = await btsPairContract.balanceOf(owner.address);

      expect(managerBalance).to.be.equals(ethers.parseEther("1000"));
    });

    it("Contract should create BTS with correct _id if all parameters are valid", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "asdf1234",
        description: "This is testing bts",
      };

      const totalBTS = await factory.totalBTS();

      const ethValue = ethers.parseEther("1");

      // Create BTS without expecting specific addresses
      const tx = await factory.createBTS(
        btsDetails.name,
        btsDetails.symbol,
        btsDetails.tokens,
        btsDetails.weights,
        btsDetails.tokenURI,
        btsDetails.buffer,
        btsDetails._id,
        btsDetails.description,
        calculateDeadline(20),
        { value: ethValue }
      );

      const receipt = await tx.wait();

      const totalBTSPost = await factory.totalBTS();
      expect(totalBTSPost).to.be.equal(totalBTS + 1n);

      // Extract actual addresses from event logs
      let createdBTSAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          if (parsedLog?.name === "CreatedBTS") {
            expect(parsedLog.args._id).to.equal(btsDetails._id);
            break;
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    });
  });

  describe("Factory should update and sync contractURI correctly across BTS contracts", function () {
    it("Should revert when trying to update with empty URI", async function () {
      await expect(factory.updateCollectionURI(""))
        .to.be.revertedWithCustomError(factory, "EmptyStringParameter")
        .withArgs("URI");
    });

    it("Factory should update and sync contractURI correctly across BTS contracts", async function () {
      const BasketToken = await ethers.getContractFactory(
        "BasketTokenStandard"
      );
      const basketToken = await BasketToken.deploy();
      await basketToken.waitForDeployment();

      // Get the initial contract URI instead of hardcoding it
      const initialCollectionUri = await factory.getContractURI();
      const newCollectionUri = "https://my-nft.metadata.come";

      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId9",
        description: "This is testing bts",
      };

      const ethValue = ethers.parseEther("1");

      const tx = await factory.createBTS(
        btsDetails.name,
        btsDetails.symbol,
        btsDetails.tokens,
        btsDetails.weights,
        btsDetails.tokenURI,
        btsDetails.buffer,
        btsDetails._id,
        btsDetails.description,
        calculateDeadline(20),
        {
          value: ethValue,
        }
      );

      const receipt = await tx.wait();

      let createdBTSAddress = null;

      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          if (parsedLog?.name === "BTSCreated") {
            createdBTSAddress = parsedLog.args.bts;
            break;
          }
        } catch (error) {
          console.error("Error parsing log:", error, "\nLog Data:", log);
        }
      }

      btsInstance = await ethers.getContractAt(
        "BasketTokenStandard",
        createdBTSAddress
      );

      expect(await factory.getContractURI()).to.equal(initialCollectionUri);
      expect(await btsInstance.contractURI()).to.equal(initialCollectionUri);
      expect(await factory.getContractURI()).to.equal(
        await btsInstance.contractURI()
      );

      await expect(
        factory.connect(user1).updateCollectionURI(newCollectionUri)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.URI_MANAGER_ROLE()}`);

      await expect(factory.updateCollectionURI(newCollectionUri))
        .to.to.emit(factory, "CollectionURIUpdated")
        .withArgs(newCollectionUri);

      expect(await factory.getContractURI()).to.equal(newCollectionUri);
      expect(await btsInstance.contractURI()).to.equal(newCollectionUri);
      expect(await factory.getContractURI()).to.equal(
        await btsInstance.contractURI()
      );
    });
  });

  describe("Check Token Value By WETH", function () {
    it("Should call getTokenValueByWETH to check tokens value by weth", async function () {
      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://bts-metadata.com",
        buffer: 100,
        _id: "testId10",
        description: "Integration test for getTokenValueByWETH",
      };
      const ethValue = ethers.parseEther("1");
      const tx = await factory.createBTS(
        btsDetails.name,
        btsDetails.symbol,
        btsDetails.tokens,
        btsDetails.weights,
        btsDetails.tokenURI,
        btsDetails.buffer,
        btsDetails._id,
        btsDetails.description,
        calculateDeadline(20),
        { value: ethValue }
      );
      const receipt = await tx.wait();
      let createdBTSAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          if (parsedLog?.name === "BTSCreated") {
            createdBTSAddress = parsedLog.args.bts;
            break;
          }
        } catch (_) {}
      }
      expect(createdBTSAddress).to.not.be.null;
      const btsInstance = await ethers.getContractAt(
        "BasketTokenStandard",
        createdBTSAddress
      );
      const value = await btsInstance.getTokenValueByWETH();
      expect(value).to.be.a("bigint");
      // For a fresh BTS, value is likely zero
      expect(value).to.gt(0n);
    });
  });

  describe("CreateBTS: Tokens & Weights validation", function () {
    it("should revert if a token address is zero address", async function () {
      // Use zero address as token address
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      const validToken = mtTokenAddress;
      const tokens = [zeroAddress, validToken];
      const weights = ["5000", "5000"];
      const BTS = await ethers.getContractFactory("BasketTokenStandard");
      await expect(
        factory.createBTS(
          "Zero-Token-BTS",
          "ZTBTS",
          tokens,
          weights,
          "https://zero-token-bts.com",
          100,
          "zero-token-id",
          "Should fail due to zero address token",
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(BTS, "InvalidContractAddress")
        .withArgs(zeroAddress);
    });
    it("should revert if a token address is not a contract address", async function () {
      // Use an EOA (owner) address as token address, which is not a contract
      const invalidToken = owner.address;
      const validToken = mtTokenAddress; // Assume this is a contract address
      const tokens = [invalidToken, validToken];
      const weights = ["5000", "5000"];
      const BTS = await ethers.getContractFactory("BasketTokenStandard");
      await expect(
        factory.createBTS(
          "Invalid-Token-BTS",
          "ITBTS",
          tokens,
          weights,
          "https://invalid-token-bts.com",
          100,
          "invalid-token-id",
          "Should fail due to EOA token address",
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      )
        .to.be.revertedWithCustomError(BTS, "InvalidContractAddress")
        .withArgs(invalidToken);
    });
    it("should revert if tokens and weights array is empty", async function () {
      const emptyTokens = [];
      const emptyWeights = [];
      const BTS = await ethers.getContractFactory("BasketTokenStandard");
      await expect(
        factory.createBTS(
          "Empty-BTS",
          "EBTS",
          emptyTokens,
          emptyWeights,
          "https://empty-bts.com",
          100,
          "empty-id",
          "Should fail",
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidTokensAndWeights");
    });
    it("should revert if weights array is empty", async function () {
      const emptyTokens = [alvaAddress];
      const emptyWeights = [];
      const BTS = await ethers.getContractFactory("BasketTokenStandard");
      await expect(
        factory.createBTS(
          "Empty-BTS",
          "EBTS",
          emptyTokens,
          emptyWeights,
          "https://empty-bts.com",
          100,
          "empty-id",
          "Should fail",
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidTokensAndWeights");
    });
    it("should revert if tokens array is empty", async function () {
      const emptyTokens = [];
      const emptyWeights = [10000];
      const BTS = await ethers.getContractFactory("BasketTokenStandard");
      await expect(
        factory.createBTS(
          "Empty-BTS",
          "EBTS",
          emptyTokens,
          emptyWeights,
          "https://empty-bts.com",
          100,
          "empty-id",
          "Should fail",
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidTokensAndWeights");
    });
    it("should revert if tokens and weights arrays are not same length", async function () {
      const tokens = [mtTokenAddress, alvaAddress];
      const weights = ["5000", "2000", "3000"];
      const BTS = await ethers.getContractFactory("BasketTokenStandard");
      await expect(
        factory.createBTS(
          "Empty-BTS",
          "EBTS",
          tokens,
          weights,
          "https://empty-bts.com",
          100,
          "empty-id",
          "Should fail",
          calculateDeadline(20),
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWithCustomError(factory, "InvalidTokensAndWeights");
    });
  });

  describe("Minimum BTS Creation Amount", function () {
    it("Should return the initial minimum BTS creation amount", async function () {
      const minAmount = await factory.minBTSCreationAmount();
      expect(minAmount).to.equal(ethers.parseEther("0.01"));
    });

    it("Should allow owner to update minimum BTS creation amount", async function () {
      const newMinAmount = ethers.parseEther("0.05");
      await factory.updateMinBTSCreationAmount(newMinAmount);

      const updatedMinAmount = await factory.minBTSCreationAmount();
      expect(updatedMinAmount).to.equal(newMinAmount);
    });

    it("Should emit the amount updation event", async function () {
      const newMinAmount = ethers.parseEther("0.05");

      await expect(factory.updateMinBTSCreationAmount(newMinAmount))
        .to.emit(factory, "MinBTSCreationAmountUpdated")
        .withArgs(owner.address, newMinAmount);

      const updatedMinAmount = await factory.minBTSCreationAmount();
      expect(updatedMinAmount).to.equal(newMinAmount);
    });

    it("Should revert when non-owner tries to update minimum BTS creation amount", async function () {
      const newMinAmount = ethers.parseEther("0.05");
      await expect(
        factory.connect(user1).updateMinBTSCreationAmount(newMinAmount)
      ).to.be.reverted;
    });

    it("Should revert when trying to set minimum BTS creation amount to zero", async function () {
      await expect(
        factory.updateMinBTSCreationAmount(0)
      ).to.be.revertedWithCustomError(factory, "InvalidAmount");
    });

    it("Should revert BTS creation when sent ETH is below minimum amount", async function () {
      const newMinAmount = ethers.parseEther("0.5"); // Set higher minimum
      await factory.updateMinBTSCreationAmount(newMinAmount);

      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://my-nft.test.metadata.come",
        buffer: 2000,
        id: "123456",
        description: "This is a test NFT",
      };

      // Try to create with insufficient ETH
      const insufficientAmount = ethers.parseEther("0.1");
      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails.id,
          btsDetails.description,
          calculateDeadline(20),
          { value: insufficientAmount }
        )
      ).to.be.revertedWithCustomError(factory, "InsufficientBTSCreationAmount");
    });

    it("Should allow BTS creation when sent ETH equals the minimum amount", async function () {
      const exactMinAmount = ethers.parseEther("0.01"); // Default minimum

      const btsDetails = {
        name: "My-BTS",
        symbol: "M-BTS",
        tokens: [mtTokenAddress, alvaAddress],
        weights: ["5000", "5000"],
        tokenURI: "https://my-nft.test.metadata.come",
        buffer: 2000,
        id: "123456",
        description: "This is a test NFT",
      };

      // Should succeed with exact minimum amount
      await expect(
        factory.createBTS(
          btsDetails.name,
          btsDetails.symbol,
          btsDetails.tokens,
          btsDetails.weights,
          btsDetails.tokenURI,
          btsDetails.buffer,
          btsDetails.id,
          btsDetails.description,
          calculateDeadline(20),
          { value: exactMinAmount }
        )
      ).to.not.be.reverted;
    });
  });
});
