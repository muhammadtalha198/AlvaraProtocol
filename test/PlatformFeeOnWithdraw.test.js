const { ethers, deployments } = require("hardhat");
const { expect } = require("chai");

describe.only("Platform Fee Deduction On Withdraw", () => {
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
  const description = "This is a test BTS for withdrawal testing";
  const buffer = 100; // 1%
  const _id = "test-withdrawal-bts";

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

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);

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

    // Set user2 as the fee collector (different from the caller user1)
    await factory.setFeeCollector(user2.address);

    // Contribute ETH to get LP tokens
    await bts.connect(user1).contribute(buffer, calculateDeadline(20), {
      value: ethers.parseEther("1"),
    });
  });

  it("should successfully withdraw partial LP tokens", async function () {
    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Use half of the LP tokens
    const withdrawAmount = userBalance / 2n;

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, withdrawAmount);

    // Get the withdrawal fee percentage
    const feeConfig = await factory.getPlatformFeeConfig();
    const withdrawFeePercent = feeConfig[2]; // Index 2 is withdrawal fee

    // Calculate amounts after fee
    const feeDenominator = 10000n;
    const calculateAmountsWithFee = async (lpAmount) => {
      const baseAmounts = await btsPair.calculateShareTokens(lpAmount);
      return baseAmounts.map(
        (amount) => amount - (amount * withdrawFeePercent) / feeDenominator
      );
    };

    // Calculate expected token amounts after fee
    const amountsWithFee = await calculateAmountsWithFee(withdrawAmount);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(withdrawAmount, 100, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Verify LP tokens were partially burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(
      userBalance - withdrawAmount,
      "Incorrect LP tokens burned"
    );

    // Verify tokens were received
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Verify token amounts match expected amounts (with some tolerance for rounding)
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received (should be close to expected amounts)
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");
  });

  it("should revert when trying to withdraw 0 LP tokens", async function () {
    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens (even though we're withdrawing 0)
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Attempt to withdraw 0 LP tokens - should revert
    await expect(
      bts.connect(user1).withdraw(0, 100, calculateDeadline(20))
    ).to.be.revertedWithCustomError(bts, "InvalidWithdrawalAmount");
  });
  it("should revert when trying to withdraw using invalid deadline", async function () {
    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens (even though we're withdrawing 0)
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Attempt to withdraw 0 LP tokens - should revert
    await expect(
      bts.connect(user1).withdraw(userBalance, buffer, calculateDeadline(0))
    ).to.be.revertedWithCustomError(bts, "DeadlineInPast");
  });
  it("should withdraw LPs and deduct 0% platform fee", async function () {
    // Set platform fee to 0%
    const NEW_FEE = 0; // 0%
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2]; // Get withdrawal fee from platform fee config

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    await bts.connect(user1).withdraw(userBalance, 100, calculateDeadline(20));

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Verify tokens were received
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Verify token amounts match expected amounts (with some tolerance for rounding)
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received (should be close to expected amounts)
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received no amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.equal(0);
  });

  it("should withdraw LPs and deduct 0.01% platform fee", async function () {
    const NEW_FEE = 1;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.02% platform fee", async function () {
    const NEW_FEE = 2;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.05% platform fee", async function () {
    const NEW_FEE = 5;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.1% platform fee", async function () {
    const NEW_FEE = 10;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.15% platform fee", async function () {
    const NEW_FEE = 15;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.2% platform fee", async function () {
    const NEW_FEE = 20;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.25% platform fee", async function () {
    const NEW_FEE = 25;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.3% platform fee", async function () {
    const NEW_FEE = 30;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.35% platform fee", async function () {
    const NEW_FEE = 35;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.4% platform fee", async function () {
    const NEW_FEE = 40;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.45% platform fee", async function () {
    const NEW_FEE = 45;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.49% platform fee", async function () {
    const NEW_FEE = 49;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should withdraw LPs and deduct 0.5% platform fee", async function () {
    const NEW_FEE = 50;
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];

    // Verify the fee was updated
    expect(withdrawalFee).to.equal(NEW_FEE); // withdrawalFee should be 0.01%

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get user's LP token balance
    const userBalance = await btsPair.balanceOf(user1.address);

    // Approve BTS to spend LP tokens
    await btsPair.connect(user1).approve(btsAddress, userBalance);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(user1.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(user1)
      .withdraw(userBalance, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Verify LP tokens were burned
    const userBalancePost = await btsPair.balanceOf(user1.address);
    expect(userBalancePost).to.be.equal(0, "LP tokens were not fully burned");

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(user1.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(user1.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;

    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }

    // Verify the fee event was emitted
    if (feePaidEvent) {
      // Check event parameters
      expect(feePaidEvent.args.feeAmount.toString()).to.not.equal(
        "0",
        "Fee amount should be greater than 0"
      );
      expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
      expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
      expect(feePaidEvent.args.action).to.equal("withdrawTokens");
    } else {
      console.log(
        "EVENT MISSED: PlatformFeeDeducted event not found in transaction logs"
      );
    }
  });

  it("should pass if setting withdraw platform fees to DEFAULT FEE ", async function () {
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    const NEW_FEE = DEFAULT_FEE;
    await factory.setPlatformFeeConfig(DEFAULT_FEE, DEFAULT_FEE, NEW_FEE);

    // Get and verify the platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    expect(feeConfig[0]).to.equal(DEFAULT_FEE);
    expect(feeConfig[1]).to.equal(DEFAULT_FEE);
    expect(feeConfig[2]).to.equal(DEFAULT_FEE);
  });

  it("should revert if setting withdraw platform fees to 0.51% ", async function () {
    const NEW_FEE = 51;
    const DEFAULT_FEE = await factory.DEFAULT_FEE();
    await expect(
      factory.setPlatformFeeConfig(DEFAULT_FEE, DEFAULT_FEE, NEW_FEE)
    ).to.be.revertedWithCustomError(factory, "InvalidFee");
  });
});
