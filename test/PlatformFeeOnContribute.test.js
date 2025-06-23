const { ethers, deployments } = require("hardhat");
const { expect } = require("chai");

describe.only("Platform Fee Deduction On Contribute", () => {
  let owner, user1, user2;
  let bts, btsPair, factory, wETH, alva, mtToken, router;
  let btsAddress,
    btsPairAddress,
    factoryAddress,
    wETHAddress,
    alvaAddress,
    mtTokenAddress,
    routerAddress;
  const name = "MY-Token";
  const symbol = "MYBTS";
  const tokenURI = "https://my-nft.test.metadata.com";
  const description = "This is a test BTS for contribution testing";
  const buffer = 100; // 1%
  const _id = "test-contribution-bts";

  let tokens;
  // Calculate Deadline
  function calculateDeadline(minutes = 20) {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const buffer = minutes * 60; // Convert minutes to seconds
    return currentTime + buffer;
  }

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy all contracts
    const allDeployments = await deployments.fixture(["all-eth"]);

    // Get contract instances
    wETH = await ethers.getContractAt("WETH", allDeployments["WETH"].address);
    bts = await ethers.getContractAt(
      "BasketTokenStandard",
      allDeployments["BasketTokenStandard"].address
    );
    btsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      allDeployments["BasketTokenStandardPair"].address
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

    // Get contract addresses
    wETHAddress = await wETH.getAddress();
    btsAddress = await bts.getAddress();
    btsPairAddress = await btsPair.getAddress();
    factoryAddress = await factory.getAddress();
    alvaAddress = await alva.getAddress();
    mtTokenAddress = await mtToken.getAddress();
    routerAddress = await router.getAddress();

    // Set token prices in the router
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

    // Mint and approve tokens
    await wETH.mint(owner.address, ethers.parseEther("100000000000"));
    await wETH.approve(routerAddress, ethers.parseEther("100000000000"));
    await alva.approve(routerAddress, ethers.parseEther("100000000000"));
    await mtToken.approve(routerAddress, ethers.parseEther("100000000000"));

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);
    
    // Set ALVA listing timestamp
    await alva.setListingTimestamp("100");

    // Set up token array
    tokens = [mtTokenAddress, alvaAddress];

    // Create a new BTS
    const weights = ["5000", "5000"]; // 50% each
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id,
      description,
      calculateDeadline(20),
      { value: ethers.parseEther("1") }
    );

    // Get the BTS and BTSPair addresses from the event
    const receipt = await createBTSTx.wait();
    let newBtsAddress, newBtsPairAddress;

    for (const log of receipt.logs) {
      try {
        const parsedLog = factory.interface.parseLog(log);
        if (parsedLog?.name === "BTSCreated") {
          newBtsAddress = parsedLog.args.bts;
          newBtsPairAddress = parsedLog.args.btsPair;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Update contract instances with the new addresses
    bts = await ethers.getContractAt("BasketTokenStandard", newBtsAddress);
    btsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress
    );
    btsAddress = newBtsAddress;
    btsPairAddress = newBtsPairAddress;
  });

  it("should revert if tries to contribute 0 ETH", async function () {
    // Get the BTS contract instance
    const btsContract = await ethers.getContractAt(
      "BasketTokenStandard",
      btsAddress
    );

    // Attempt to contribute 0 ETH - should revert
    await expect(
      btsContract.contribute(buffer, calculateDeadline(20), { value: 0 })
    ).to.be.revertedWithCustomError(btsContract, "ZeroContributionAmount");
  });
  it("should revert if tries to pass invalid deadline", async function () {
    // Get the BTS contract instance
    const btsContract = await ethers.getContractAt(
      "BasketTokenStandard",
      btsAddress
    );

    // Attempt to contribute with invalid deadline
    await expect(
      btsContract.contribute(buffer, calculateDeadline(0), {
        value: ethers.parseEther("1"),
      })
    ).to.be.revertedWithCustomError(btsContract, "DeadlineInPast");
  });

  it("should contribute to BTS with 0% platform fee", async function () {
    const NEW_FEE = 0;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector balances
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.01% platform fee", async function () {
    const NEW_FEE = 1;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.02% platform fee", async function () {
    const NEW_FEE = 2;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.05% platform fee", async function () {
    const NEW_FEE = 5;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.1% platform fee", async function () {
    const NEW_FEE = 10;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.2% platform fee", async function () {
    const NEW_FEE = 20;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.29% platform fee", async function () {
    const NEW_FEE = 29;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.3% platform fee", async function () {
    const NEW_FEE = 30;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.35% platform fee", async function () {
    const NEW_FEE = 35;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.39% platform fee", async function () {
    const NEW_FEE = 39;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.4% platform fee", async function () {
    const NEW_FEE = 40;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.45% platform fee", async function () {
    const NEW_FEE = 45;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.49% platform fee", async function () {
    const NEW_FEE = 49;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should contribute to BTS and deduct 0.5% platform fee", async function () {
    const NEW_FEE = 50;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 1ETH for the contribution
    const contributionAmount = ethers.parseEther("1");

    expect(contributionFee).to.equal(NEW_FEE);

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS and check for event emission
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    const contributionReceipt = await contributionTx.wait();

    // Check if the ContributedToBTS event was emitted
    let contributedAmount = null;
    for (const log of contributionReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "ContributedToBTS") {
          contributedAmount = parsedLog.args.amount;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the contribution event
    expect(contributedAmount).to.not.be.null;

    // Check fee collector received fee
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should handle large contribution of 9000 ETH and deduct 0.5% platform fee", async function () {
    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 100 ETH for the contribution
    const contributionAmount = ethers.parseEther("9000");

    // Calculate expected fee amount (0.5% of 100 ETH = 0.5 ETH)
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    await contributionTx.wait();

    // Check fee collector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should handle large contribution of 9000 ETH and deduct 0.01% platform fee", async function () {
    const NEW_FEE = 1;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);
    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 100 ETH for the contribution
    const contributionAmount = ethers.parseEther("9000");

    // Calculate expected fee amount (0.5% of 100 ETH = 0.5 ETH)
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    await contributionTx.wait();

    // Check fee collector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should handle medium contribution of 100 ETH and deduct 0.5% platform fee", async function () {
    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1]; // Get contribution fee from platform fee config

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 100 ETH for the contribution
    const contributionAmount = ethers.parseEther("100");

    // Calculate expected fee amount (0.5% of 100 ETH = 0.5 ETH)
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    await contributionTx.wait();

    // Check fee collector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount - exactly 0.5% of 100 ETH (0.5 ETH)
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should handle very small contribution of 0.00001 ETH and deduct 0.5% platform fee", async function () {
    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1];

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 100 ETH for the contribution
    const contributionAmount = ethers.parseEther("0.00001");

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    await contributionTx.wait();

    // Check fee collector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });

  it("should handle very small contribution of 0.00001 ETH and deduct 0.01% platform fee", async function () {
    const NEW_FEE = 1;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);
    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const contributionFee = feeConfig[1];

    // Get fee collector balance before contribution
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get initial LP token balance
    const initialLpTokenBalance = await btsPair.balanceOf(owner.address);

    // Use 100 ETH for the contribution
    const contributionAmount = ethers.parseEther("0.00001");

    // Calculate expected fee amount
    const expectedFeeAmount =
      (contributionAmount * BigInt(contributionFee)) / BigInt(10000);

    // Contribute to the BTS
    const contributionTx = await bts.contribute(
      buffer,
      calculateDeadline(20),
      {
        value: contributionAmount,
      }
    );

    // Verify the PlatformFeeDeducted event was emitted
    await expect(contributionTx)
      .to.emit(bts, "PlatformFeeDeducted")
      .withArgs(expectedFeeAmount, contributionFee, feeCollector, "contribute");

    // Wait for transaction to be mined
    await contributionTx.wait();

    // Check fee collector received exactly 0.5% of the ETH value
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );
    const actualFeeReceived =
      feeCollectorBalanceAfter - feeCollectorBalanceBefore;

    // Verify the fee amount
    expect(actualFeeReceived).to.equal(expectedFeeAmount);

    // Check that LP tokens were received
    const finalLpTokenBalance = await btsPair.balanceOf(owner.address);
    const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;

    // Verify that LP tokens were received
    expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
  });
});
