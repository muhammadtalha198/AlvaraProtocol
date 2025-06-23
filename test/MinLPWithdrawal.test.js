const { ethers, deployments } = require("hardhat");
const { expect } = require("chai");

describe.only("LP Withdrawal Range", function () {
  let owner, user1;
  let factory;

  let user2, bts, btsPair, wETH, alva, mtToken, router;
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
  const buffer = 100;
  const _id = "test-withdrawal-bts";
  const CREATION_AMOUNT = 10;
  let tokens;
  function calculateDeadline(minutes = 20) {
    const currentTime = Math.floor(Date.now() / 1000);
    const buffer = minutes * 60;
    return currentTime + buffer;
  }

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const allDeployments = await deployments.fixture(["all-eth"]);
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

    wETHAddress = await wETH.getAddress();
    btsAddress = await bts.getAddress();
    btsPairAddress = await btsPair.getAddress();
    factoryAddress = await factory.getAddress();
    alvaAddress = await alva.getAddress();
    mtTokenAddress = await mtToken.getAddress();
    routerAddress = await router.getAddress();

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

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);


    await wETH.mint(owner.address, ethers.parseEther("100000000000"));
    await wETH.approve(routerAddress, ethers.parseEther("100000000000"));
    await alva.approve(routerAddress, ethers.parseEther("100000000000"));
    await mtToken.approve(routerAddress, ethers.parseEther("100000000000"));

    await alva.setListingTimestamp("100");
    tokens = [mtTokenAddress, alvaAddress];

    // Create a new BTS
    const weights = ["5000", "5000"];
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
      { value: ethers.parseEther(CREATION_AMOUNT.toString()) }
    );
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
      } catch (error) {}
    }
    bts = await ethers.getContractAt("BasketTokenStandard", newBtsAddress);
    btsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress
    );
    btsAddress = newBtsAddress;
    btsPairAddress = newBtsPairAddress;
    await factory.setFeeCollector(user2.address);
    await bts.connect(user1).contribute(buffer, calculateDeadline(20), {
      value: ethers.parseEther("10"),
    });
  });

  it("should return the default minLpWithdrawal value of 100000000000 after deployment", async function () {
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(100000000000); // Default value set during deployment
  });

  it("should allow setting minLpWithdrawal to 0 and emit MinLpWithdrawalUpdated event", async function () {
    const tx = await factory.setMinLpWithdrawal(0);
    await expect(tx).to.emit(factory, "MinLpWithdrawalUpdated").withArgs(0);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(0);
  });

  it("should allow setting minLpWithdrawal to 1 and emit MinLpWithdrawalUpdated event", async function () {
    let newMin = 1;
    const tx = await factory.setMinLpWithdrawal(newMin);
    await expect(tx)
      .to.emit(factory, "MinLpWithdrawalUpdated")
      .withArgs(newMin);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(newMin);
  });

  it("should allow setting minLpWithdrawal to 1000 * 10^18", async function () {
    let newMin = ethers.parseEther("1000");
    const tx = await factory.setMinLpWithdrawal(newMin);
    await expect(tx)
      .to.emit(factory, "MinLpWithdrawalUpdated")
      .withArgs(newMin);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(newMin);
  });

  it("should allow setting minLpWithdrawal to 1000000000000 * 10^18", async function () {
    let newMin = ethers.parseEther("1000000000000");
    const tx = await factory.setMinLpWithdrawal(newMin);
    await expect(tx)
      .to.emit(factory, "MinLpWithdrawalUpdated")
      .withArgs(newMin);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(newMin);
  });

  it("should revert if non-owner tries to set minLpWithdrawal", async function () {
    let newMin = ethers.parseEther("10000");
    await expect(
      factory.connect(user1).setMinLpWithdrawal(newMin)
    ).to.be.revertedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.ADMIN_ROLE()}`);
  });

  it("should withdraw 1000 *10^18 LPs, and deduct 0.5% Platform Fee", async function () {
    // Selected user gets 1000 LPs against 10 ETH on creation
    // Creation amount is 10

    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = 1000;

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = 1000;

    const LP_VALUE = CREATION_AMOUNT / TOTAL_LP_SUPPLY;
    const WITHDRAWAL_AMOUNT_ETH = LP_VALUE * WITHDRAWAL_LP_AMOUNT;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get selectedUser LP token balance
    const userBalance = await btsPair.balanceOf(selectedUser.address);
    await btsPair
      .connect(selectedUser)
      .approve(btsAddress, ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()));

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(selectedUser)
      .withdraw(
        ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()),
        buffer,
        calculateDeadline(20)
      );
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be  close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (ethers.parseEther(WITHDRAWAL_AMOUNT_ETH.toString()) * BigInt(NEW_FEE)) /
      BigInt(10000);

    const delta = ethers.parseEther("0.0005"); // Acceptable error margin
    expect(feeReceived).to.be.closeTo(expectedFee, delta);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("should withdraw 100 *10^18 LPs, and deduct 0.5% Platform Fee", async function () {
    // Selected user gets 1000 LPs against 10 ETH on creation
    // Creation amount is 10

    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = 100;

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = 1000;

    const LP_VALUE = CREATION_AMOUNT / TOTAL_LP_SUPPLY;
    const WITHDRAWAL_AMOUNT_ETH = LP_VALUE * WITHDRAWAL_LP_AMOUNT;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get selectedUser LP token balance
    const userBalance = await btsPair.balanceOf(selectedUser.address);
    await btsPair
      .connect(selectedUser)
      .approve(btsAddress, ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()));

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(selectedUser)
      .withdraw(
        ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()),
        buffer,
        calculateDeadline(20)
      );
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be  close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (ethers.parseEther(WITHDRAWAL_AMOUNT_ETH.toString()) * BigInt(NEW_FEE)) /
      BigInt(10000);

    const delta = ethers.parseEther("0.0005"); // Acceptable error margin
    expect(feeReceived).to.be.closeTo(expectedFee, delta);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("should withdraw 10 *10^18 LPs, and deduct 0.5% Platform Fee", async function () {
    // Selected user gets 1000 LPs against 10 ETH on creation
    // Creation amount is 10

    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = 10;

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = 1000;

    const LP_VALUE = CREATION_AMOUNT / TOTAL_LP_SUPPLY;
    const WITHDRAWAL_AMOUNT_ETH = LP_VALUE * WITHDRAWAL_LP_AMOUNT;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get selectedUser LP token balance
    const userBalance = await btsPair.balanceOf(selectedUser.address);
    await btsPair
      .connect(selectedUser)
      .approve(btsAddress, ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()));

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(selectedUser)
      .withdraw(
        ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()),
        buffer,
        calculateDeadline(20)
      );
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be  close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (ethers.parseEther(WITHDRAWAL_AMOUNT_ETH.toString()) * BigInt(NEW_FEE)) /
      BigInt(10000);

    const delta = ethers.parseEther("0.0005"); // Acceptable error margin
    expect(feeReceived).to.be.closeTo(expectedFee, delta);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("should withdraw 1 *10^18 LPs, and deduct 0.5% Platform Fee", async function () {
    // Selected user gets 1000 LPs against 10 ETH on creation
    // Creation amount is 10

    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = 1;

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = 1000;

    const LP_VALUE = CREATION_AMOUNT / TOTAL_LP_SUPPLY;
    const WITHDRAWAL_AMOUNT_ETH = LP_VALUE * WITHDRAWAL_LP_AMOUNT;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get selectedUser LP token balance
    const userBalance = await btsPair.balanceOf(selectedUser.address);
    await btsPair
      .connect(selectedUser)
      .approve(btsAddress, ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()));

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(selectedUser)
      .withdraw(
        ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()),
        buffer,
        calculateDeadline(20)
      );
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be  close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (ethers.parseEther(WITHDRAWAL_AMOUNT_ETH.toString()) * BigInt(NEW_FEE)) /
      BigInt(10000);

    const delta = ethers.parseEther("0.0005"); // Acceptable error margin
    expect(feeReceived).to.be.closeTo(expectedFee, delta);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("should withdraw 0.1 LPs, and deduct 0.5% Platform Fee", async function () {
    // Selected user gets 1000 LPs against 10 ETH on creation
    // Creation amount is 10

    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = 0.1;

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = 1000;

    const LP_VALUE = CREATION_AMOUNT / TOTAL_LP_SUPPLY;
    const WITHDRAWAL_AMOUNT_ETH = LP_VALUE * WITHDRAWAL_LP_AMOUNT;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get selectedUser LP token balance
    const userBalance = await btsPair.balanceOf(selectedUser.address);
    await btsPair
      .connect(selectedUser)
      .approve(btsAddress, ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()));

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(selectedUser)
      .withdraw(
        ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()),
        buffer,
        calculateDeadline(20)
      );
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be  close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (ethers.parseEther(WITHDRAWAL_AMOUNT_ETH.toString()) * BigInt(NEW_FEE)) /
      BigInt(10000);

    const delta = ethers.parseEther("0.0005"); // Acceptable error margin
    expect(feeReceived).to.be.closeTo(expectedFee, delta);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("should withdraw 0.01 LPs, and deduct 0.5% Platform Fee", async function () {
    // Selected user gets 1000 LPs against 10 ETH on creation
    // Creation amount is 10

    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = 0.1;

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = 1000;

    const LP_VALUE = CREATION_AMOUNT / TOTAL_LP_SUPPLY;
    const WITHDRAWAL_AMOUNT_ETH = LP_VALUE * WITHDRAWAL_LP_AMOUNT;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Get selectedUser LP token balance
    const userBalance = await btsPair.balanceOf(selectedUser.address);
    await btsPair
      .connect(selectedUser)
      .approve(btsAddress, ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()));

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await bts
      .connect(selectedUser)
      .withdraw(
        ethers.parseEther(WITHDRAWAL_LP_AMOUNT.toString()),
        buffer,
        calculateDeadline(20)
      );
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    // Check if tokens were received
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be  close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (ethers.parseEther(WITHDRAWAL_AMOUNT_ETH.toString()) * BigInt(NEW_FEE)) /
      BigInt(10000);

    const delta = ethers.parseEther("0.0005"); // Acceptable error margin
    expect(feeReceived).to.be.closeTo(expectedFee, delta);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = bts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("LARGE BASKET: should withdraw (min) 0.0000001 LPs, and deduct 0.01% Platform Fee", async function () {
    const NEW_FEE = 1;
    const WITHDRAWAL_LP_AMOUNT = ethers.parseEther("0.0000001"); // 0.0000000000001 LP in wei

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = ethers.parseEther("1000"); // 1000 LP in wei
    const CREATION_AMOUNT = ethers.parseEther("9000"); // 9000 ETH in wei
    const DELTA = ethers.parseEther("0.00000000001"); // 0.00000002$
    // Create a new BTS with 9000 ETH using owner address
    const weights = ["5000", "5000"];
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id + "-large-basket", // unique _id for this test
      description,
      calculateDeadline(20),
      { value: CREATION_AMOUNT }
    );
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
      } catch (error) {}
    }
    const newBts = await ethers.getContractAt(
      "BasketTokenStandard",
      newBtsAddress
    );
    const newBtsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress
    );

    // Calculate ETH value for the withdrawn LPs
    const WITHDRAWAL_AMOUNT_ETH =
      (WITHDRAWAL_LP_AMOUNT * CREATION_AMOUNT) / TOTAL_LP_SUPPLY;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Approve withdrawal
    await newBtsPair
      .connect(selectedUser)
      .approve(newBtsAddress, WITHDRAWAL_LP_AMOUNT);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await newBts
      .connect(selectedUser)
      .withdraw(WITHDRAWAL_LP_AMOUNT, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (WITHDRAWAL_AMOUNT_ETH * BigInt(NEW_FEE)) / BigInt(10000);

    expect(feeReceived).to.be.closeTo(expectedFee, DELTA);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = newBts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("LARGE BASKET: should withdraw (min) 0.0000001 LPs, and deduct 0.5% Platform Fee", async function () {
    const NEW_FEE = 50;
    const WITHDRAWAL_LP_AMOUNT = ethers.parseEther("0.0000001"); // 0.0000000000001 LP in wei

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = ethers.parseEther("1000"); // 1000 LP in wei
    const CREATION_AMOUNT = ethers.parseEther("9000"); // 9000 ETH in wei
    const DELTA = ethers.parseEther("0.000001"); // 
    // Create a new BTS with 9000 ETH using owner address
    const weights = ["5000", "5000"];
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id + "-large-basket", // unique _id for this test
      description,
      calculateDeadline(20),
      { value: CREATION_AMOUNT }
    );
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
      } catch (error) {}
    }
    const newBts = await ethers.getContractAt(
      "BasketTokenStandard",
      newBtsAddress
    );
    const newBtsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress
    );

    // Calculate ETH value for the withdrawn LPs
    const WITHDRAWAL_AMOUNT_ETH =
      (WITHDRAWAL_LP_AMOUNT * CREATION_AMOUNT) / TOTAL_LP_SUPPLY;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Approve withdrawal
    await newBtsPair
      .connect(selectedUser)
      .approve(newBtsAddress, WITHDRAWAL_LP_AMOUNT);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await newBts
      .connect(selectedUser)
      .withdraw(WITHDRAWAL_LP_AMOUNT, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (WITHDRAWAL_AMOUNT_ETH * BigInt(NEW_FEE)) / BigInt(10000);

    expect(feeReceived).to.be.closeTo(expectedFee, DELTA);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = newBts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("LARGE BASKET: should revert with InvalidWithdrawalAmount() when withdrawing less than minLpWithdrawal (100 < 10000)", async function () {
    const NEW_MIN_LP = ethers.parseEther("10000");
    const WITHDRAWAL_LP_AMOUNT = ethers.parseEther("100"); // less than min, should revert

    // Set the minimum LP withdrawal to 100000
    await expect(factory.setMinLpWithdrawal(NEW_MIN_LP))
      .to.emit(factory, "MinLpWithdrawalUpdated")
      .withArgs(NEW_MIN_LP);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(NEW_MIN_LP);

    // Create a new BTS with 9000 ETH using owner address
    const weights = ["5000", "5000"];
    const CREATION_AMOUNT = ethers.parseEther("9000");
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id + "-large-basket-min-lp", // unique _id for this test
      description,
      calculateDeadline(20),
      { value: CREATION_AMOUNT }
    );
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
      } catch (error) {}
    }
    const newBts = await ethers.getContractAt(
      "BasketTokenStandard",
      newBtsAddress,
      owner // ensure correct signer
    );
    const newBtsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress,
      owner // ensure correct signer
    );

    // Approve withdrawal using the correct owner signer
    await newBtsPair.approve(newBtsAddress, WITHDRAWAL_LP_AMOUNT);

    // Expect revert with custom error using the correct owner signer
    await expect(
      newBts.withdraw(WITHDRAWAL_LP_AMOUNT, buffer, calculateDeadline(20))
    ).to.be.revertedWithCustomError(newBts, "InvalidWithdrawalAmount");
  });

  it("SMALL BASKET: should withdraw (min) 0.0000001 LPs, and deduct 0.01% Platform Fee", async function () {
    const NEW_FEE = 1;

    const WITHDRAWAL_LP_AMOUNT = ethers.parseEther("0.0000001");
    let newMin = ethers.parseEther("0.0000001");

    await factory.setMinLpWithdrawal(newMin);

    const selectedUser = owner;
    const TOTAL_LP_SUPPLY = ethers.parseEther("1000"); // LP VALUE depends on creation amount
    const CREATION_AMOUNT = ethers.parseEther("0.01");
    const DELTA = ethers.parseEther("0.00000000001"); // 0.00000002$
    // Create a new BTS with 9000 ETH using owner address
    const weights = ["5000", "5000"];
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id + "-large-basket", // unique _id for this test
      description,
      calculateDeadline(20),
      { value: CREATION_AMOUNT }
    );
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
      } catch (error) {}
    }
    const newBts = await ethers.getContractAt(
      "BasketTokenStandard",
      newBtsAddress
    );
    const newBtsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress
    );

    // Calculate ETH value for the withdrawn LPs
    const WITHDRAWAL_AMOUNT_ETH =
      (WITHDRAWAL_LP_AMOUNT * CREATION_AMOUNT) / TOTAL_LP_SUPPLY;

    // Set platform fee
    await factory.setPlatformFeeConfig(NEW_FEE, NEW_FEE, NEW_FEE);

    // Get the updated fee collector address and withdrawal fee
    const feeConfig = await factory.getPlatformFeeConfig();
    const feeCollector = feeConfig[3];
    const withdrawalFee = feeConfig[2];
    expect(withdrawalFee).to.equal(NEW_FEE);

    // Get fee collector ETH balance before withdrawal
    const feeCollectorBalanceBefore = await ethers.provider.getBalance(
      feeCollector
    );

    // Approve withdrawal
    await newBtsPair
      .connect(selectedUser)
      .approve(newBtsAddress, WITHDRAWAL_LP_AMOUNT);

    // Get token balances before withdrawal
    const mtTokenBalanceBefore = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceBefore = await alva.balanceOf(selectedUser.address);

    // Perform the withdrawal
    const withdrawTx = await newBts
      .connect(selectedUser)
      .withdraw(WITHDRAWAL_LP_AMOUNT, buffer, calculateDeadline(20));
    const withdrawReceipt = await withdrawTx.wait();

    // Get fee collector ETH balance after withdrawal
    const feeCollectorBalanceAfter = await ethers.provider.getBalance(
      feeCollector
    );

    // Get Token Balances
    const mtTokenBalanceAfter = await mtToken.balanceOf(selectedUser.address);
    const alvaTokenBalanceAfter = await alva.balanceOf(selectedUser.address);

    // Calculated received amounts
    const mtTokenReceived = mtTokenBalanceAfter - mtTokenBalanceBefore;
    const alvaTokenReceived = alvaTokenBalanceAfter - alvaTokenBalanceBefore;
    expect(mtTokenReceived).to.be.gt(0, "No MT tokens received");
    expect(alvaTokenReceived).to.be.gt(0, "No ALVA tokens received");

    // Verify fee collector received some amount
    const feeReceived = feeCollectorBalanceAfter - feeCollectorBalanceBefore;
    expect(feeReceived).to.be.gt(0);

    // Fee must be close to NEW_FEE% of WITHDRAWAL_AMOUNT_ETH
    const expectedFee =
      (WITHDRAWAL_AMOUNT_ETH * BigInt(NEW_FEE)) / BigInt(10000);

    expect(feeReceived).to.be.closeTo(expectedFee, DELTA);

    // Check for PlatformFeeDeducted event
    let feePaidEvent = null;
    for (const log of withdrawReceipt.logs) {
      try {
        const parsedLog = newBts.interface.parseLog(log);
        if (parsedLog?.name === "PlatformFeeDeducted") {
          feePaidEvent = parsedLog;
          break;
        }
      } catch (error) {}
    }
    expect(feePaidEvent).to.not.be.null;
    expect(feePaidEvent.args.feeAmount.toString()).to.not.equal("0");
    expect(feePaidEvent.args.feePercent).to.equal(withdrawalFee.toString());
    expect(feePaidEvent.args.feeCollector).to.equal(feeCollector);
    expect(feePaidEvent.args.action).to.equal("withdrawTokens");
  });

  it("SMALL BASKET: should revert with InvalidWithdrawalAmount() when withdrawing less than minLpWithdrawal (100 < 10000)", async function () {
    const NEW_MIN_LP = ethers.parseEther("10000");
    const WITHDRAWAL_LP_AMOUNT = ethers.parseEther("100"); // less than min, should revert

    // Set the minimum LP withdrawal to 100000
    await expect(factory.setMinLpWithdrawal(NEW_MIN_LP))
      .to.emit(factory, "MinLpWithdrawalUpdated")
      .withArgs(NEW_MIN_LP);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(NEW_MIN_LP);

    // Create a new BTS with 9000 ETH using owner address
    const weights = ["5000", "5000"];
    const CREATION_AMOUNT = ethers.parseEther("0.01");
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id + "-large-basket-min-lp", // unique _id for this test
      description,
      calculateDeadline(20),
      { value: CREATION_AMOUNT }
    );
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
      } catch (error) {}
    }
    const newBts = await ethers.getContractAt(
      "BasketTokenStandard",
      newBtsAddress,
      owner // ensure correct signer
    );
    const newBtsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress,
      owner // ensure correct signer
    );

    // Approve withdrawal using the correct owner signer
    await newBtsPair.approve(newBtsAddress, WITHDRAWAL_LP_AMOUNT);

    // Expect revert with custom error using the correct owner signer
    await expect(
      newBts.withdraw(WITHDRAWAL_LP_AMOUNT, buffer, calculateDeadline(20))
    ).to.be.revertedWithCustomError(newBts, "InvalidWithdrawalAmount");
  });

  it("SMALL BASKET: should revert with InvalidWithdrawalAmount() when withdrawing less than minLpWithdrawal (9999 < 10000)", async function () {
    const NEW_MIN_LP = ethers.parseEther("10000");
    const WITHDRAWAL_LP_AMOUNT = ethers.parseEther("9999"); // less than min, should revert

    // Set the minimum LP withdrawal to 100000
    await expect(factory.setMinLpWithdrawal(NEW_MIN_LP))
      .to.emit(factory, "MinLpWithdrawalUpdated")
      .withArgs(NEW_MIN_LP);
    const min = await factory.minLpWithdrawal();
    expect(min).to.equal(NEW_MIN_LP);

    // Create a new BTS with 9000 ETH using owner address
    const weights = ["5000", "5000"];
    const CREATION_AMOUNT = ethers.parseEther("0.01");
    const createBTSTx = await factory.createBTS(
      name,
      symbol,
      tokens,
      weights,
      tokenURI,
      buffer,
      _id + "-large-basket-min-lp", // unique _id for this test
      description,
      calculateDeadline(20),
      { value: CREATION_AMOUNT }
    );
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
      } catch (error) {}
    }
    const newBts = await ethers.getContractAt(
      "BasketTokenStandard",
      newBtsAddress,
      owner // ensure correct signer
    );
    const newBtsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      newBtsPairAddress,
      owner // ensure correct signer
    );

    // Approve withdrawal using the correct owner signer
    await newBtsPair.approve(newBtsAddress, WITHDRAWAL_LP_AMOUNT);

    // Expect revert with custom error using the correct owner signer
    await expect(
      newBts.withdraw(WITHDRAWAL_LP_AMOUNT, buffer, calculateDeadline(20))
    ).to.be.revertedWithCustomError(newBts, "InvalidWithdrawalAmount");
  });
});
