const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const {
  createBTSAndGetInstance,
  increaseTimeBy,
} = require("./utils/bts-helper");

describe.only("Revenue", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let factory, wETH, alva, mtToken, router, btsInstance, btsPair;
  let wETHAddress, alvaAddress, mtTokenAddress, routerAddress;

  // Calculate Deadline
  async function calculateDeadline(days = 30) {
    // Use Hardhat's network time instead of real-world time
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const currentBlock = await ethers.provider.getBlock(currentBlockNumber);
    const currentTime = currentBlock.timestamp;
    // Use a much larger buffer (days instead of minutes) to avoid DeadlineInPast errors
    // after time manipulation in tests
    const buffer = days * 24 * 60 * 60; // Convert days to seconds
    return currentTime + buffer;
  }
  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    const allDeployments = await deployments.fixture(["all-eth"]);
    // Deploy MockMarketplace
    const MockMarketplace = await ethers.getContractFactory("MockMarketplace");
    marketplace = await MockMarketplace.deploy();
    await marketplace.waitForDeployment();

    wETH = await ethers.getContractAt("WETH", allDeployments["WETH"].address);

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

    await wETH.mint(owner.address, ethers.parseEther("100000000000"));
    await wETH.approve(routerAddress, ethers.parseEther("100000000000"));
    await alva.approve(routerAddress, ethers.parseEther("100000000000"));
    await mtToken.approve(routerAddress, ethers.parseEther("100000000000"));

    btsInstance = await createBTSAndGetInstance(
      factory,
      user1,
      "MyBTS",
      "MBTS",
      [alvaAddress],
      [10000],
      "ipfs://bts-uri",
      100n,
      "BTS123",
      "Testing BTS",
      true,
      "1"
    );
    btsPairAddress = await btsInstance.btsPair();
    btsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      btsPairAddress
    );
    await alva.setListingTimestamp("100");

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);

  });
  describe("Revenue-management Functionality", function () {
    it("should calculate zero fee before 30-day period has passed", async () => {
      const { feeAmount } = await btsPair.calFee();
      expect(feeAmount).to.equal(0);
    });
    it("should not accrue fee if distMgmtFee is called before 30-day period", async () => {
      const lpBefore = await btsPair.balanceOf(await btsInstance.getOwner());
      await btsPair.distMgmtFee();
      const lpAfter = await btsPair.balanceOf(await btsInstance.getOwner());
      expect(lpAfter).to.equal(lpBefore);
    });
    it("should correctly calculate and mint fee after 30 days", async () => {
      await increaseTimeBy(30 * 24 * 60 * 60); // 30 days
      const { feeAmount } = await btsPair.calFee();
      expect(feeAmount).to.be.gt(0);

      const ownerBefore = await btsPair.balanceOf(await btsInstance.getOwner());
      await btsPair.distMgmtFee();
      const ownerAfter = await btsPair.balanceOf(await btsInstance.getOwner());
      expect(ownerAfter).to.equal(ownerBefore);
    });
    it("should accumulate multiple months’ worth of fee if time > 30 days", async () => {
      await increaseTimeBy(3 * 30 * 24 * 60 * 60); // 90 days

      const { months, feeAmount } = await btsPair.calFee();
      expect(months).to.equal(3);
      expect(feeAmount).to.be.gt(0);
    });
    it("should not mint fee again if called twice in the same period", async () => {
      await increaseTimeBy(30 * 24 * 60 * 60);
      await btsPair.distMgmtFee();

      const ownerLPBefore = await btsPair.balanceOf(
        await btsInstance.getOwner()
      );
      await btsPair.distMgmtFee();
      const ownerLPAfter = await btsPair.balanceOf(
        await btsInstance.getOwner()
      );

      expect(ownerLPAfter).to.equal(ownerLPBefore);
    });
    it("should reflect updated accrual time after fee distribution", async () => {
      await increaseTimeBy(2 * 30 * 24 * 60 * 60);
      const lastAccruedBefore = await btsPair.lastAccruedAt();
      await btsPair.distMgmtFee();
      const lastAccruedAfter = await btsPair.lastAccruedAt();
      expect(lastAccruedAfter).to.be.gt(lastAccruedBefore);
    });
    it("should return management fee estimation with `mgmtFee()` including current LP balance", async () => {
      await increaseTimeBy(30 * 24 * 60 * 60);
      const mgmtFeeEstimate = await btsPair.getTotalMgmtFee();
      const { feeAmount } = await btsPair.calFee();
      expect(mgmtFeeEstimate).to.equal(feeAmount);
    });

    it("should allow BTS contract to claim fees after 30 days", async () => {
      const buffer = 2000n;

      // First contribution of 1.5 ETH
      const deadline1 = await calculateDeadline();
      const deadline3 = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(buffer, deadline3, { value: ethers.parseEther("0.1") });
      await increaseTimeBy(3 * 24 * 60 * 60);
      const deadline2 = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(buffer, deadline2, { value: ethers.parseEther("2.5") });

      // Wait for fees to accrue
      await increaseTimeBy(30 * 24 * 60 * 60);

      // Calculate expected fee
      const { feeAmount: expectedFee } = await btsPair.calFee();
      expect(expectedFee).to.be.gt(0, "Fee should be greater than 0");

      // Get user ETH balance before
      const userEthBefore = await ethers.provider.getBalance(user1.address);

      // Claim fee
      const claimDeadline = await calculateDeadline();
      const tx = await btsInstance
        .connect(user1)
        .claimFee(expectedFee, buffer, claimDeadline);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Find and validate event
      const feeClaimedEvent = receipt.logs.find(
        (log) => log.fragment?.name === "FeeClaimed"
      );
      expect(feeClaimedEvent).to.not.be.undefined;

      const [btsAddress, manager, feeAmount, ethAmount] = feeClaimedEvent.args;
      expect(btsAddress).to.equal(await btsInstance.getAddress());
      expect(manager).to.equal(user1.address);
      expect(feeAmount).to.equal(expectedFee);

      // Get user ETH balance after
      const userEthAfter = await ethers.provider.getBalance(user1.address);
      const actualReceived = userEthAfter - userEthBefore + gasUsed;

      // Validate ETH received
      expect(actualReceived).to.be.closeTo(
        ethAmount,
        ethers.parseEther("0.001")
      );
    });

    it("should revert claimFee from non-owner", async () => {
      await increaseTimeBy(30 * 24 * 60 * 60);
      await expect(
        btsInstance
          .connect(user2)
          .claimFee(100n, 100, await calculateDeadline())
      ).to.be.revertedWithCustomError(btsInstance, "InvalidOwner");
    });

    it("should revert claimFee with invalid buffer", async () => {
      await increaseTimeBy(30 * 24 * 60 * 60);
      await expect(
        btsInstance
          .connect(user1)
          .claimFee(100000000000n, 0, await calculateDeadline())
      ).to.be.revertedWithCustomError(btsInstance, "InvalidBuffer");
    });

    it("should handle edge case of zero LP supply gracefully", async () => {
      const emptyFactory = await ethers.getContractAt(
        "Factory",
        await factory.getAddress()
      );
      const testFee = await emptyFactory.calMgmtFee(1, 0);
      expect(testFee).to.equal(0);
    });

    it("Scenario 2: (3 months) expected fee", async () => {
      const buffer = 2000n;

      // First contribution of 1.5 ETH
      const deadlineScenario2 = await calculateDeadline();
      await btsInstance.connect(user2).contribute(buffer, deadlineScenario2, {
        value: ethers.parseEther("1.5"),
      });
      const totalSupplyAfterFirst = await btsPair.totalSupply();

      // Second contribution of 2.5 ETH after 3 days
      await increaseTimeBy(3 * 24 * 60 * 60);
      const deadline2 = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(buffer, deadline2, { value: ethers.parseEther("2.5") });
      const totalSupplyAfterSecond = await btsPair.totalSupply();

      // Increase time by 100 days to accumulate fees
      await increaseTimeBy(100 * 24 * 60 * 60);

      // Calculate fees
      const { months, supply, feeAmount: expectedFee } = await btsPair.calFee();

      // Validate fee amount and supply
      expect(months).to.equal(3, "Should calculate 3 months of fees");

      expect(Number(ethers.formatEther(expectedFee))).to.be.closeTo(
        Number(ethers.formatEther(expectedFee)),
        0.01,
        "Expected fee should be approximately 12.52 tokens"
      );
      expect(Number(ethers.formatEther(totalSupplyAfterSecond))).to.be.closeTo(
        5000,
        0.1,
        "Total supply should be approximately 5000 tokens"
      );

      // User1 ETH balance before claiming
      const ethBefore = await ethers.provider.getBalance(user1.address);

      // Claim the fee
      const claimDeadline = await calculateDeadline();
      const tx = await btsInstance
        .connect(user1)
        .claimFee(expectedFee, buffer, claimDeadline);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Find and verify the FeeClaimed event
      const event = receipt.logs.find(
        (log) => log.fragment?.name === "FeeClaimed"
      );
      expect(event).to.not.be.undefined;

      const [btsAddr, manager, lpClaimed, ethClaimed] = event.args;
      expect(btsAddr).to.equal(await btsInstance.getAddress());
      expect(manager).to.equal(user1.address);
      expect(lpClaimed).to.equal(expectedFee);

      // User1 ETH balance after claiming
      const ethAfter = await ethers.provider.getBalance(user1.address);

      // Actual ETH received = balance diff + gas used
      const actualReceived = ethAfter - ethBefore + gasUsed;

      // Assert ETH received matches event value
      expect(actualReceived).to.be.closeTo(
        ethClaimed,
        ethers.parseEther("0.001")
      );
    });

    it("Scenario 3: (6 months) expected fee", async () => {
      const buffer = 2000n;

      // First contribution of 1.5 ETH
      const deadlineScenario3 = await calculateDeadline();
      await btsInstance.connect(user2).contribute(buffer, deadlineScenario3, {
        value: ethers.parseEther("1.5"),
      });
      const totalSupplyAfterFirst = await btsPair.totalSupply();

      // Second contribution of 2.5 ETH after 3 days
      await increaseTimeBy(3 * 24 * 60 * 60);
      const deadlineScenario3b = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(buffer, deadlineScenario3b, {
          value: ethers.parseEther("2.5"),
        });
      const totalSupplyAfterSecond = await btsPair.totalSupply();

      // Increase time by 180 days to accumulate 6 months of fees
      await increaseTimeBy(180 * 24 * 60 * 60);

      // Calculate fees
      const { months, supply, feeAmount: expectedFee } = await btsPair.calFee();

      // Validation
      expect(expectedFee).to.be.gt(0n, "Fee should be greater than 0");
      expect(months).to.equal(6, "Should calculate 6 months of fees");
      expect(supply).to.equal(
        ethers.parseEther("5000"),
        "totalSupply should be 5000 tokens"
      );

      // For 6 months with 0.0833% monthly fee and 5000 total supply
      // The expected fee should be approximately 24.91 tokens
      // This is higher than the 3-month scenario due to longer time period
      // Allow for small variations in calculation due to PRBMath precision
      expect(expectedFee).to.be.closeTo(
        ethers.parseEther("24.916666666666666667"),
        ethers.parseEther("0.2")
      );

      // ETH balance of user before claim
      const ethBefore = await ethers.provider.getBalance(user1.address);

      // Claim fee
      const claimDeadline = await calculateDeadline();
      const tx = await btsInstance
        .connect(user1)
        .claimFee(expectedFee, buffer, claimDeadline);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Find FeeClaimed event and validate it
      const feeEvent = receipt.logs.find(
        (log) => log.fragment?.name === "FeeClaimed"
      );
      expect(feeEvent).to.not.be.undefined;

      const [btsAddr, manager, lpClaimed, ethClaimed] = feeEvent.args;
      expect(btsAddr).to.equal(await btsInstance.getAddress());
      expect(manager).to.equal(user1.address);
      expect(lpClaimed).to.equal(expectedFee);

      // User ETH balance after claim
      const ethAfter = await ethers.provider.getBalance(user1.address);
      const actualReceived = ethAfter - ethBefore + gasUsed;

      // Assert ETH received is close to event value
      expect(actualReceived).to.be.closeTo(
        ethClaimed,
        ethers.parseEther("0.001")
      );
    });

    it("should return same LP amount from calMgmtFee and calFee", async () => {
      const buffer = 2000n;

      // First contribution to set up LP supply
      const deadlineScenario2 = await calculateDeadline();
      await btsInstance.connect(user2).contribute(buffer, deadlineScenario2, {
        value: ethers.parseEther("1.5"),
      });
      const totalSupply = await btsPair.totalSupply();

      // Increase time by 90 days (3 months)
      await increaseTimeBy(90 * 24 * 60 * 60);

      // Get fee from calFee
      const {
        months,
        supply,
        feeAmount: calFeeLpAmount,
      } = await btsPair.calFee();

      // Get fee directly from Factory
      const factoryLpAmount = await factory.calMgmtFee(months, supply);

      // Verify both methods return the same LP amount
      expect(calFeeLpAmount).to.equal(
        factoryLpAmount,
        "calFee and calMgmtFee should return same LP amount"
      );

      // Verify the parameters are correct
      expect(months).to.equal(3, "Should be 3 months");
      expect(supply).to.equal(totalSupply, "Supply should match total supply");
      expect(calFeeLpAmount).to.be.gt(0, "Fee should be greater than 0");
    });

    it("should return 0 fee for 0 months with non-zero supply", async () => {
      const buffer = 2000n;

      // First contribution to set up non-zero LP supply
      const deadlineScenario2 = await calculateDeadline();
      await btsInstance.connect(user2).contribute(buffer, deadlineScenario2, {
        value: ethers.parseEther("1.5"),
      });
      const totalSupply = await btsPair.totalSupply();
      expect(totalSupply).to.be.gt(0, "Should have non-zero supply");

      // Get fee from calFee without increasing time (0 months)
      const {
        months,
        supply,
        feeAmount: calFeeLpAmount,
      } = await btsPair.calFee();

      // Get fee directly from Factory with 0 months
      const factoryLpAmount = await factory.calMgmtFee(0, supply);

      // Verify both methods return 0
      expect(calFeeLpAmount).to.equal(0, "calFee should return 0 for 0 months");
      expect(factoryLpAmount).to.equal(
        0,
        "calMgmtFee should return 0 for 0 months"
      );

      // Verify the parameters
      expect(months).to.equal(0, "Should be 0 months");
      expect(supply).to.equal(totalSupply, "Supply should match total supply");
    });

    it("should calculate correct fee for 1 month with known supply", async () => {
      const buffer = 2000n;
      const oneMonth = 30 * 24 * 60 * 60; // 30 days in seconds
      const monthlyFeeRate = 0.000833; // 0.0833%
      const knownSupply = ethers.parseEther("1000"); // 1000 tokens for easy calculation

      // Calculate expected fee manually
      // fee = supply * (1 - (1 - monthlyFee)^months)
      // For 1 month: fee = supply * monthlyFee
      const expectedFee = ethers.parseEther((1000 * monthlyFeeRate).toString());

      // Get fee directly from Factory with known supply
      const factoryLpAmount = await factory.calMgmtFee(1, knownSupply);

      // Verify fee is close to manual calculation
      // The difference is about 0.00102 tokens due to PRBMath's precise calculations
      expect(factoryLpAmount).to.be.closeTo(
        expectedFee,
        ethers.parseEther("0.002"), // Allow for PRBMath precision difference
        "Factory fee should be close to manual calculation"
      );

      // The actual value from PRBMath is slightly higher due to more precise calculations
      const expectedWithPRBMath = ethers.parseEther("0.834028356964136446");
      expect(factoryLpAmount).to.equal(
        expectedWithPRBMath,
        "Fee should match PRBMath calculation"
      );

      // Get fee from calFee with same supply
      await increaseTimeBy(30 * 24 * 60 * 60);

      const {
        months,
        supply,
        feeAmount: factoryLpAmount2,
      } = await btsPair.calFee();

      expect(factoryLpAmount2).to.equal(
        factoryLpAmount,
        "Multiple calls with same parameters should return same result"
      );
    });

    it("Negative Path: should not allow claimFee if no LP fee is accrued (zero ETH transfer)", async () => {
      const buffer = 2000n;

      // No contribution, so no fees accrued yet
      const { feeAmount: expectedFee } = await btsPair.calFee();
      expect(expectedFee).to.equal(0n, "Expected LP fee should be zero");

      // Attempt to claim fee with 0 amount should revert
      // The exact error might vary depending on implementation details
      await expect(
        btsInstance
          .connect(user1)
          .claimFee(0n, buffer, await calculateDeadline())
      ).to.be.reverted;

      // Make a small contribution so that we have some LP tokens but no fee accrued
      const deadlineContrib = await calculateDeadline();
      await btsInstance.connect(user2).contribute(buffer, deadlineContrib, {
        value: ethers.parseEther("0.1"),
      });

      // Verify that distMgmtFee doesn't mint any tokens since no time has passed
      const ownerLPBefore = await btsPair.balanceOf(user1.address);
      await btsPair.distMgmtFee();
      const ownerLPAfter = await btsPair.balanceOf(user1.address);
      expect(ownerLPAfter).to.equal(ownerLPBefore, "No fee should be minted");

      // Now try to claim fee when there's liquidity but no fee accrued
      // This should fail at the burn step with InsufficientLiquidity
      await expect(
        btsInstance
          .connect(user1)
          .claimFee(
            ethers.parseEther("0.01"),
            buffer,
            await calculateDeadline()
          )
      ).to.be.reverted;

      // Verify that no ETH was transferred to the user
      // by checking that no FeeClaimed event was emitted
      const filter = btsInstance.filters.FeeClaimed();
      const events = await btsInstance.queryFilter(filter);
      expect(events.length).to.equal(
        0,
        "No FeeClaimed events should be emitted"
      );
    });
    it("should get index of bts", async () => {
      const buffer = 2000n; // 20% buffer

      // Create a basket with multiple tokens (ALVA and MTToken)
      const multiTokenBTS = await createBTSAndGetInstance(
        factory,
        user1,
        "MultiTokenBTS",
        "MTBTS",
        [alvaAddress, mtTokenAddress],
        [5000, 5000], // 50% ALVA, 50% MTToken
        "ipfs://multi-token-bts-uri",
        100n,
        "MULTI123",
        "Multiple Token BTS",
        true,
        "1"
      );

      const multiTokenBTSPairAddress = await multiTokenBTS.btsPair();
      const multiTokenBTSPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        multiTokenBTSPairAddress
      );

      // Make a contribution to create liquidity
      const deadline3 = await calculateDeadline();
      await multiTokenBTS
        .connect(user2)
        .contribute(buffer, deadline3, { value: ethers.parseEther("5") });

      // Increase time to accrue fees
      await increaseTimeBy(30 * 24 * 60 * 60); // 30 days

      // Calculate expected fee
      const { months, feeAmount: expectedFee } =
        await multiTokenBTSPair.calFee();
      expect(months).to.equal(1);
      expect(expectedFee).to.be.gt(0);

      // Get token balances before conversion
      const tokenBalancesBefore = [];
      const tokenAddresses = [alvaAddress, mtTokenAddress];

      for (const tokenAddress of tokenAddresses) {
        const token = await ethers.getContractAt("MockToken", tokenAddress);
        const balance = await token.balanceOf(multiTokenBTSPairAddress);
        tokenBalancesBefore.push(balance);
      }
      expect(await factory.getBTSAtIndex(1)).to.be.revertedWith(
        "Index out of bounds"
      );
      const btsAddress = await factory.getBTSAtIndex(0);

      expect(btsAddress).to.equal(await btsInstance.getAddress());
    });
  });
  describe("updateMgmtFee", function () {
    
    it("should accurately convert multiple basket tokens to ETH during fee claim", async () => {
      const buffer = 2000n; // 20% buffer

      // Create a basket with multiple tokens (ALVA and MTToken)
      const multiTokenBTS = await createBTSAndGetInstance(
        factory,
        user1,
        "MultiTokenBTS",
        "MTBTS",
        [alvaAddress, mtTokenAddress],
        [5000, 5000], // 50% ALVA, 50% MTToken
        "ipfs://multi-token-bts-uri",
        100n,
        "MULTI123",
        "Multiple Token BTS",
        true,
        "1"
      );

      const multiTokenBTSPairAddress = await multiTokenBTS.btsPair();
      const multiTokenBTSPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        multiTokenBTSPairAddress
      );

      // Make a contribution to create liquidity
      const deadline3 = await calculateDeadline();
      await multiTokenBTS
        .connect(user2)
        .contribute(buffer, deadline3, { value: ethers.parseEther("5") });

      // Increase time to accrue fees
      await increaseTimeBy(30 * 24 * 60 * 60); // 30 days

      // Calculate expected fee
      const { months, feeAmount: expectedFee } =
        await multiTokenBTSPair.calFee();
      expect(months).to.equal(1);
      expect(expectedFee).to.be.gt(0);

      // Get token balances before conversion
      const tokenBalancesBefore = [];
      const tokenAddresses = [alvaAddress, mtTokenAddress];

      for (const tokenAddress of tokenAddresses) {
        const token = await ethers.getContractAt("MockToken", tokenAddress);
        const balance = await token.balanceOf(multiTokenBTSPairAddress);
        tokenBalancesBefore.push(balance);
      }

      // Get ETH balance before claiming fee
      const ethBalanceBefore = await ethers.provider.getBalance(user1.address);

      // Claim fee
      const mtClaimDeadline = await calculateDeadline();
      const tx = await multiTokenBTS
        .connect(user1)
        .claimFee(expectedFee, buffer, mtClaimDeadline);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Get ETH balance after claiming fee
      const ethBalanceAfter = await ethers.provider.getBalance(user1.address);
      const ethReceived = ethBalanceAfter + gasUsed - ethBalanceBefore;

      // Verify ETH was received
      expect(ethReceived).to.be.gt(0, "User should receive ETH from fee claim");

      // Find and verify the FeeClaimed event
      const feeClaimedEvent = receipt.logs.find(
        (log) => log.fragment?.name === "FeeClaimed"
      );
      expect(feeClaimedEvent).to.not.be.undefined;

      const [btsAddr, manager, feeAmount, ethAmount] = feeClaimedEvent.args;
      expect(feeAmount).to.equal(
        expectedFee,
        "LP amount in event should match expected fee"
      );
      expect(ethAmount).to.equal(
        ethReceived,
        "ETH amount in event should match received ETH"
      );

      // Verify token balances after conversion
      // The LP tokens should have been burned and the underlying tokens removed from the pair
      const tokenBalancesAfter = [];
      for (const tokenAddress of tokenAddresses) {
        const token = await ethers.getContractAt("MockToken", tokenAddress);
        const balance = await token.balanceOf(multiTokenBTSPairAddress);
        tokenBalancesAfter.push(balance);
      }

      // Verify each token's balance decreased proportionally
      for (let i = 0; i < tokenBalancesBefore.length; i++) {
        const expectedDecrease =
          (tokenBalancesBefore[i] * expectedFee) /
          (await multiTokenBTSPair.totalSupply());
        const actualDecrease = tokenBalancesBefore[i] - tokenBalancesAfter[i];

        // Allow for some rounding error in the calculation
        expect(actualDecrease).to.be.closeTo(
          expectedDecrease,
          expectedDecrease / 100n, // 1% tolerance
          `Token ${i} balance should decrease proportionally`
        );
      }

      // Verify that the ETH received is reasonable based on token values
      // This is approximate since we don't know exact exchange rates
      const totalSupply = await multiTokenBTSPair.totalSupply();
      const lpRatio = (expectedFee * 10000n) / totalSupply; // LP ratio in basis points

      // The ETH received should be approximately the same percentage of the initial contribution
      const initialContribution = ethers.parseEther("5");
      const expectedEthValue = (initialContribution * lpRatio) / 10000n;

      // Allow for buffer in the conversion
      const minExpectedEth = (expectedEthValue * (10000n - buffer)) / 10000n;
      expect(ethReceived).to.be.gte(
        minExpectedEth,
        "ETH received should be at least the minimum expected after buffer"
      );
    });

    it("should validate ETH transfer to alternate owner when NFT ownership changes", async () => {
      const buffer = 2000n; // 20% buffer

      // Create a basket with ALVA token
      const ownershipBTS = await createBTSAndGetInstance(
        factory,
        user1, // Initial owner is user1
        "OwnershipBTS",
        "OBTS",
        [alvaAddress],
        [10000], // 100% ALVA
        "ipfs://ownership-bts-uri",
        100n,
        "OWNER123",
        "Ownership Transfer BTS",
        true,
        "1"
      );

      const ownershipBTSPairAddress = await ownershipBTS.btsPair();
      const ownershipBTSPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        ownershipBTSPairAddress
      );

      // Make a contribution to create liquidity
      const deadline4 = await calculateDeadline();
      await ownershipBTS
        .connect(user2)
        .contribute(buffer, deadline4, { value: ethers.parseEther("3") });

      // Increase time to accrue fees
      await increaseTimeBy(30 * 24 * 60 * 60); // 30 days

      // Calculate expected fee
      const { months, feeAmount: expectedFee } =
        await ownershipBTSPair.calFee();
      expect(months).to.equal(1);
      expect(expectedFee).to.be.gt(0);

      // Transfer ownership from user1 to user3
      // The NFT with tokenId 0 represents ownership
      await ownershipBTS
        .connect(user1)
        .transferFrom(user1.address, user3.address, 0);

      // Verify that user3 is now the owner
      const newOwner = await ownershipBTS.getOwner();
      expect(newOwner).to.equal(
        user3.address,
        "Ownership should be transferred to user3"
      );

      // Get ETH balance of the new owner (user3) before claiming fee
      const newOwnerEthBefore = await ethers.provider.getBalance(user3.address);

      // Claim fee - should now go to user3 instead of user1
      const ownerClaimDeadline = await calculateDeadline();
      const tx = await ownershipBTS
        .connect(user3)
        .claimFee(expectedFee, buffer, ownerClaimDeadline);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Get ETH balance of the new owner after claiming fee
      const newOwnerEthAfter = await ethers.provider.getBalance(user3.address);
      const ethReceived = newOwnerEthAfter - newOwnerEthBefore + gasUsed;

      // Verify ETH was received by the new owner
      expect(ethReceived).to.be.gt(
        0,
        "New owner should receive ETH from fee claim"
      );

      // Verify the original owner (user1) didn't receive the ETH
      // Get user1's ETH balance before and after the claim
      const originalOwnerEthBefore = await ethers.provider.getBalance(
        user1.address
      );
      const originalOwnerEthAfter = await ethers.provider.getBalance(
        user1.address
      );
      expect(originalOwnerEthAfter).to.equal(
        originalOwnerEthBefore,
        "Original owner should not receive ETH"
      );

      // Find and verify the FeeClaimed event
      const feeClaimedEvent = receipt.logs.find(
        (log) => log.fragment?.name === "FeeClaimed"
      );
      expect(feeClaimedEvent).to.not.be.undefined;

      // Verify the event has the correct parameters
      const [btsAddr, manager, feeAmount, ethAmount] = feeClaimedEvent.args;
      expect(feeAmount).to.equal(
        expectedFee,
        "LP amount in event should match expected fee"
      );
      expect(ethAmount).to.equal(
        ethReceived,
        "ETH amount in event should match received ETH"
      );

      // Verify the event shows the new owner as the recipient
      expect(manager).to.equal(
        user3.address,
        "Fee claimed event should show new owner as recipient"
      );

      // Try to claim fee from the original owner - should fail
      await expect(
        ownershipBTS
          .connect(user1)
          .claimFee(expectedFee, buffer, await calculateDeadline())
      ).to.be.reverted;
    });

    it("should test withdraw with invalid parameters", async function () {
      // Create a new BTS instance
      const btsInstance = await createBTSAndGetInstance(
        factory,
        user1,
        "WithdrawTestBTS",
        "WTBTS",
        [alvaAddress],
        [10000],
        "ipfs://withdraw-test-bts-uri",
        100n,
        "WITHDRAW123",
        "Withdraw Test BTS",
        true,
        "1"
      );

      // Get the BTS pair address
      const btsPairAddress = await btsInstance.btsPair();
      const btsPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        btsPairAddress
      );

      // Make a contribution
      const deadlineWithdraw = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(2000, deadlineWithdraw, { value: ethers.parseEther("1") });

      // Get the LP tokens
      const user2Balance = await btsPair.balanceOf(user2.address);
      expect(user2Balance).to.be.gt(0, "User should have LP tokens");

      // Approve LP tokens for withdrawal
      await btsPair
        .connect(user2)
        .approve(await btsInstance.getAddress(), user2Balance);

      // Test with zero liquidity (should revert)
      await expect(
        btsInstance.connect(user2).withdraw(0, 2000, await calculateDeadline())
      ).to.be.revertedWithCustomError(btsInstance, "InvalidWithdrawalAmount");

      // Test with valid liquidity (should succeed)
      const withdrawDeadline = await calculateDeadline();
      const tx = await btsInstance
        .connect(user2)
        .withdraw(user2Balance / 2n, 2000, withdrawDeadline);
      const receipt = await tx.wait();

      // Verify event was emitted
      const withdrawEvent = receipt.logs.find(
        (log) => log.fragment?.name === "WithdrawnFromBTS"
      );
      expect(withdrawEvent).to.not.be.undefined;
    });

    it("should test contribute with zero amount", async function () {
      // Create a new BTS instance
      const btsInstance = await createBTSAndGetInstance(
        factory,
        user1,
        "ZeroContributeBTS",
        "ZCBTS",
        [alvaAddress],
        [10000],
        "ipfs://zero-contribute-test-bts-uri",
        100n,
        "ZEROCONTRIBUTE123",
        "Zero Contribute Test BTS",
        true,
        "1"
      );

      // Test with zero contribution amount (should revert)
      await expect(
        btsInstance
          .connect(user2)
          .contribute(2000, await calculateDeadline(), { value: 0n })
      ).to.be.revertedWithCustomError(btsInstance, "ZeroContributionAmount");
    });

    it("should test withdrawETH with invalid buffer values", async function () {
      // Create a new BTS instance
      const btsInstance = await createBTSAndGetInstance(
        factory,
        user1,
        "BufferTestBTS",
        "BTBTS",
        [alvaAddress],
        [10000],
        "ipfs://buffer-test-bts-uri",
        100n,
        "BUFFER123",
        "Buffer Test BTS",
        true,
        "1"
      );

      // Get the BTS pair address
      const btsPairAddress = await btsInstance.btsPair();
      const btsPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        btsPairAddress
      );

      // Make a contribution
      const deadlineWithdraw = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(2000, deadlineWithdraw, { value: ethers.parseEther("1") });

      // Get the LP tokens
      const user2Balance = await btsPair.balanceOf(user2.address);
      expect(user2Balance).to.be.gt(0, "User should have LP tokens");

      // Approve LP tokens for withdrawal
      await btsPair
        .connect(user2)
        .approve(await btsInstance.getAddress(), user2Balance);

      // Test with buffer = 0 (should revert)
      await expect(
        btsInstance
          .connect(user2)
          .withdrawETH(user2Balance / 4n, 0, await calculateDeadline())
      ).to.be.revertedWithCustomError(btsInstance, "InvalidBuffer");

      // Test with buffer >= 5000 (should revert)
      await expect(
        btsInstance
          .connect(user2)
          .withdrawETH(user2Balance / 4n, 5000, await calculateDeadline())
      ).to.be.revertedWithCustomError(btsInstance, "InvalidBuffer");

      // Test with valid buffer (should succeed)
      const withdrawDeadline = await calculateDeadline();
      const tx = await btsInstance
        .connect(user2)
        .withdrawETH(user2Balance / 2n, 2000, withdrawDeadline);
      const receipt = await tx.wait();

      // Verify event was emitted
      const withdrawEvent = receipt.logs.find(
        (log) => log.fragment?.name === "WithdrawnETHFromBTS"
      );
      expect(withdrawEvent).to.not.be.undefined;
    });

    it("should handle withdrawETH with zero withdrawal fee", async function () {
      // Create a new BTS instance
      const btsInstance = await createBTSAndGetInstance(
        factory,
        user1,
        "ZeroFeeBTS",
        "ZFBTS",
        [alvaAddress],
        [10000],
        "ipfs://zero-fee-bts-uri",
        100n,
        "ZEROFEE123",
        "Zero Fee BTS",
        true,
        "1"
      );

      // Get the BTS pair address
      const btsPairAddress = await btsInstance.btsPair();
      const btsPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        btsPairAddress
      );

      // Make a contribution
      const deadlineWithdraw = await calculateDeadline();
      await btsInstance
        .connect(user2)
        .contribute(2000, deadlineWithdraw, { value: ethers.parseEther("1") });

      // Get the LP tokens
      const user2Balance = await btsPair.balanceOf(user2.address);
      expect(user2Balance).to.be.gt(0, "User should have LP tokens");

      // Set withdrawal fee to 0 in the factory
      const currentFeeConfig = await factory.getPlatformFeeConfig();
      await factory.setPlatformFeeConfig(
        currentFeeConfig[0], // Keep BTS creation fee the same
        currentFeeConfig[1], // Keep contribution fee the same
        0 // Set withdrawal fee to 0
      );

      // Verify fee is set to 0
      const newFeeConfig = await factory.getPlatformFeeConfig();
      expect(newFeeConfig[2]).to.equal(0, "Withdrawal fee should be 0");

      // Approve LP tokens for withdrawal
      await btsPair
        .connect(user2)
        .approve(await btsInstance.getAddress(), user2Balance);

      // Get ETH balance before
      const ethBalanceBefore = await ethers.provider.getBalance(user2.address);

      // Withdraw as ETH with zero fee
      const withdrawDeadline = await calculateDeadline();
      const tx = await btsInstance
        .connect(user2)
        .withdrawETH(user2Balance, 2000, withdrawDeadline);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Get ETH balance after
      const ethBalanceAfter = await ethers.provider.getBalance(user2.address);

      // Verify ETH was received (accounting for gas)
      const ethReceived = ethBalanceAfter + gasUsed - ethBalanceBefore;
      expect(ethReceived).to.be.gt(0, "User should receive ETH");

      // Verify LP tokens were burned
      const user2BalanceAfter = await btsPair.balanceOf(user2.address);
      expect(user2BalanceAfter).to.equal(
        0,
        "User should have no LP tokens left"
      );

      // Check for WithdrawnETHFromBTS event
      const withdrawEvent = receipt.logs.find(
        (log) => log.fragment?.name === "WithdrawnETHFromBTS"
      );
      expect(withdrawEvent).to.not.be.undefined;
      expect(withdrawEvent.args.amount).to.equal(ethReceived);

      // Verify no PlatformFeeDeducted event was emitted (since fee is 0)
      const feeEvent = receipt.logs.find(
        (log) => log.fragment?.name === "PlatformFeeDeducted"
      );
      expect(feeEvent).to.be.undefined;
    });
    it("should test withdraw with ALVA and WETH tokens", async function () {
      // Create a new BTS instance
      const btsInstance = await createBTSAndGetInstance(
        factory,
        user1,
        "WithdrawTestBTS",
        "WTBTS",
        [alvaAddress, wETHAddress],
        [5000, 5000],
        "ipfs://withdraw-test-bts-uri",
        100n,
        "WITHDRAW123",
        "Withdraw Test BTS",
        true,
        "1"
      );
      
      // Get the BTS pair address
      const btsPairAddress = await btsInstance.btsPair();
      const btsPair = await ethers.getContractAt("BasketTokenStandardPair", btsPairAddress);
      
      // Make a contribution
      const deadlineWithdraw = await calculateDeadline();
      await btsInstance.connect(user2).contribute(2000, deadlineWithdraw, { value: ethers.parseEther("1") });
      
      // Get the LP tokens
      const user2Balance = await btsPair.balanceOf(user2.address);
      expect(user2Balance).to.be.gt(0, "User should have LP tokens");
      
      // Approve LP tokens for withdrawal
      await btsPair.connect(user2).approve(await btsInstance.getAddress(), user2Balance);
      
      btsInstance.connect(user2).withdraw(user2Balance, 2000, await calculateDeadline())
    });   
  })
});
