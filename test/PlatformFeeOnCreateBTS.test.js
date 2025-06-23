const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe.only("Platform Fee Deduction on Create BTS", function () {
  let owner, user1, user2, user3, user4, user5, user6;
  let bts, btsPair, factory, wETH, alva, mtToken, router;
  let btsAddress,
    btsPairAddress,
    factoryAddress,
    wETHAddress,
    alvaAddress,
    mtTokenAddress,
    routerAddress;

  // Calculate Deadline
  function calculateDeadline(minutes = 20) {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const buffer = minutes * 60; // Convert minutes to seconds
    return currentTime + buffer;
  }

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    const allDeployments = await deployments.fixture(["all-eth"]);

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

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);

    // Set token price in router
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

    // Allow token amount
    await wETH.approve(routerAddress, ethers.parseEther("100000000000"));
    await alva.approve(routerAddress, ethers.parseEther("100000000000"));
    await mtToken.approve(routerAddress, ethers.parseEther("100000000000"));
  });

  it("should return DEFAULT_FEE for all platform fee config values", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    expect(feeConfig[0]).to.equal(DEFAULT_FEE); // btsCreationFee
    expect(feeConfig[1]).to.equal(DEFAULT_FEE); // contributionFee
    expect(feeConfig[2]).to.equal(DEFAULT_FEE); // withdrawalFee
  });

  it("should revert when trying to create BTS with less than minimum required amount", async function () {
    // Get the minimum BTS creation amount from the factory
    const minBTSCreationAmount = await factory.minBTSCreationAmount();

    // Define BTS details
    const btsDetails = {
      name: "Min-Amount-Test",
      symbol: "MAT",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/min-amount",
      buffer: 100,
      _id: "min-amount-test",
      description: "Testing minimum amount requirement",
    };

    // Use an amount that is 1 wei less than the minimum required
    const insufficientAmount = minBTSCreationAmount - 1n;

    // Attempt to create a BTS with insufficient amount - should revert
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
        { value: insufficientAmount }
      )
    )
      .to.be.revertedWithCustomError(factory, "InsufficientBTSCreationAmount")
      .withArgs(insufficientAmount, minBTSCreationAmount);
  });

  it("should revert when trying to create BTS with invalid deadline", async function () {
    // Get the minimum BTS creation amount from the factory
    const minBTSCreationAmount = await factory.minBTSCreationAmount();

    // Define BTS details
    const btsDetails = {
      name: "Min-Amount-Test",
      symbol: "MAT",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/min-amount",
      buffer: 100,
      _id: "min-amount-test",
      description: "Testing minimum amount requirement",
    };

    // Attempt to create a BTS with insufficient amount - should revert
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
        calculateDeadline(0),
        { value: ethers.parseEther("0.1") }
      )
    ).to.be.revertedWithCustomError(factory, "DeadlineInPast");
  });

  it("should create BTS with minimum amount and deduct 0.5% platform fee", async function () {
    // First, ensure the fee collector is not the same as the caller
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];

    // Make sure fee collector is not the same as the caller (owner)
    expect(feeCollector.toLowerCase()).to.not.equal(
      owner.address.toLowerCase()
    );

    // If they are the same, update the fee collector to user1
    if (feeCollector.toLowerCase() === owner.address.toLowerCase()) {
      await factory.updateFeeCollector(user1.address);
      const updatedFeeConfig = await factory.getPlatformFeeConfig();
      expect(updatedFeeConfig[3].toLowerCase()).to.equal(
        user1.address.toLowerCase()
      );
    }

    // Get the updated fee collector address
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    const updatedFeeCollector = updatedFeeConfig[3];

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      updatedFeeCollector
    );

    // Define BTS details
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

    // Use exactly 0.11 ETH for the test
    const ethValue = ethers.parseEther("0.1");

    // Get the current BTS creation fee percentage (should be 0.5% = 50)
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    expect(DEFAULT_FEE).to.equal(50); // 0.5%

    // Calculate expected fee amount
    const expectedFeeAmount = (ethValue * BigInt(DEFAULT_FEE)) / BigInt(10000);

    // Create BTS and check for event emission
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

    // Verify the event was emitted
    await expect(tx).to.emit(factory, "BTSCreationFeeDeducted");

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Extract the created BTS address and BTS pair address from the event
    let newBTSAddress = null;
    let newBTSPairAddress = null;

    for (const log of receipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);

        // Check for CreatedBTS event
        if (parsedLog?.name === "BTSCreated") {
          newBTSAddress = parsedLog.args.bts;
          newBTSPairAddress = parsedLog.args.btsPair;

          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify BTS addresses were extracted
    expect(newBTSAddress).to.not.be.null;
    expect(newBTSPairAddress).to.not.be.null;

    // Save both addresses to module-level variables for the next test
    createdBTSAddress = newBTSAddress;
    createdBTSPairAddress = newBTSPairAddress;

    // Check feeCollector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      updatedFeeCollector
    );

    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.5% of 1 ETH (0.005 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.01% creation fee and transfer the expected amount", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee to 0.01%
    const NEW_FEE = 1; // 0.01%
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector received exactly 0.1% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.1% of 1 ETH (0.001 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.02% creation fee and transfer the expected amount", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee
    const NEW_FEE = 2;
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.05% creation fee and transfer the expected amount", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee
    const NEW_FEE = 5;
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.09% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 9;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.1% creation fee and transfer the expected amount", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee to 0.1%
    const NEW_FEE = 10; // 0.1%
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.1% of 1 ETH = 0.001 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector received exactly 0.1% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.1% of 1 ETH (0.001 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.15% creation fee and transfer the expected amount", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee to 0.15%
    const NEW_FEE = 15; // 0.15%
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector received exactly 0.1% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.1% of 1 ETH (0.001 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.2% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 20;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.25% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 25;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.29% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 29;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.3% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 30;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.35% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 35;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.39% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 39;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.40% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 40;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.45% creation fee and transfer the expected amount", async function () {
    // Set BTS creation fee
    const NEW_FEE = 45;

    const feeConfig = await factory.getPlatformFeeConfig();
    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.15% of 1 ETH = 0.0015 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector balance
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.49% creation fee and transfer the expected amount", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee to 0.49%
    const NEW_FEE = 49; // 0.49%
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0.49% of 1 ETH = 0.0049 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    const createBTSReceipt = await createBTSTx.wait();

    // Check if the PlatformFeeDeducted event was emitted
    let feeDeductedEvent = null;
    for (const log of createBTSReceipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreationFeeDeducted") {
          feeDeductedEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    expect(feeDeductedEvent).to.not.be.null;
    expect(feeDeductedEvent.args.feeAmount).to.equal(expectedFeeAmount);
    expect(feeDeductedEvent.args.feePercent).to.equal(NEW_FEE);
    expect(feeDeductedEvent.args.feeCollector).to.equal(feeCollector);

    // Check fee collector received exactly 0.1% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.1% of 1 ETH (0.001 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0.5% creation fee and transfer the expected amount", async function () {
    // First, ensure the fee collector is not the same as the caller
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];

    // Make sure fee collector is not the same as the caller (owner)
    expect(feeCollector.toLowerCase()).to.not.equal(
      owner.address.toLowerCase()
    );

    // If they are the same, update the fee collector to user1
    if (feeCollector.toLowerCase() === owner.address.toLowerCase()) {
      await factory.updateFeeCollector(user1.address);
      const updatedFeeConfig = await factory.getPlatformFeeConfig();
      expect(updatedFeeConfig[3].toLowerCase()).to.equal(
        user1.address.toLowerCase()
      );
    }

    // Get the updated fee collector address
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    const updatedFeeCollector = updatedFeeConfig[3];

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      updatedFeeCollector
    );

    // Define BTS details
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

    // Use exactly 0.1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Get the current BTS creation fee percentage (should be 0.5% = 50)
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    expect(DEFAULT_FEE).to.equal(50); // 0.5%

    // Calculate expected fee amount
    const expectedFeeAmount = (ethValue * BigInt(DEFAULT_FEE)) / BigInt(10000);

    // Create BTS and check for event emission
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

    // Verify the event was emitted
    await expect(tx).to.emit(factory, "BTSCreationFeeDeducted");

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    // Extract the created BTS address and BTS pair address from the event
    let newBTSAddress = null;
    let newBTSPairAddress = null;

    for (const log of receipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);

        // Check for CreatedBTS event
        if (parsedLog?.name === "BTSCreated") {
          newBTSAddress = parsedLog.args.bts;
          newBTSPairAddress = parsedLog.args.btsPair;

          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify BTS addresses were extracted
    expect(newBTSAddress).to.not.be.null;
    expect(newBTSPairAddress).to.not.be.null;

    // Save both addresses to module-level variables for the next test
    createdBTSAddress = newBTSAddress;
    createdBTSPairAddress = newBTSPairAddress;

    // Check feeCollector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      updatedFeeCollector
    );

    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });

  it("should create BTS with 0% creation fee", async function () {
    const feeConfig = await factory.getPlatformFeeConfig();

    const contributionFee = feeConfig[1];
    const withdrawalFee = feeConfig[2];

    // Set BTS creation fee to 0%
    const NEW_FEE = 0; // 0%
    await factory.setPlatformFeeConfig(NEW_FEE, contributionFee, withdrawalFee);

    // Set fee collector to user1 address
    const feeCollector = user1.address;
    await factory.setFeeCollector(user1.address);

    // Get fee collector balance before BTS creation
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee and feeCollector was updated
    const updatedFeeConfig = await factory.getPlatformFeeConfig();
    expect(updatedFeeConfig[0]).to.equal(NEW_FEE);
    expect(updatedFeeConfig[3]).to.equal(feeCollector);

    // Define BTS details
    const btsDetails = {
      name: "Custom-Fee-BTS",
      symbol: "CFBTS",
      tokens: [mtTokenAddress, alvaAddress],
      weights: ["5000", "5000"],
      tokenURI: "https://bts-metadata.com/custom-fee",
      buffer: 100,
      _id: "custom-fee-test",
      description: "Testing custom fee BTS creation",
    };

    // Use exactly 1 ETH for the test
    const ethValue = ethers.parseEther("1");

    // Calculate expected fee amount (0% of 1 ETH = 0 ETH)
    const expectedFeeAmount = (ethValue * BigInt(NEW_FEE)) / BigInt(10000);

    // Create BTS with 1 ETH
    const createBTSTx = await factory.createBTS(
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

    // Wait for transaction to be mined
    await createBTSTx.wait();

    // Check fee collector received exactly 0.1% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.1% of 1 ETH (0.001 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);
  });
});
