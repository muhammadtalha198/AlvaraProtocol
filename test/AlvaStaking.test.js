const { expect } = require("chai");
const { ethers, upgrades, deployments, getNamedAccounts } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StakingAlva", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let alva, veAlva, stakingAlva;

  const pools = [
    "FOREVER",
    "ONE_WEEK",
    "ONE_MONTH",
    "THREE_MONTHS",
    "SIX_MONTHS",
    "TWELVE_MONTHS",
    "EIGHTEEN_MONTHS",
    "TWENTYFOUR_MONTHS",
    "THIRTYSIX_MONTHS",
    "FORTYEIGHT_MONTHS",
  ];

  const veTokenRatio = [
    200000000, 1000000, 5000000, 20000000, 50000000, 100000000, 200000000,
    400000000, 800000000, 1000000000,
  ]; // sequence same as pools

  const rewards = [
    5000000, 0, 0, 50000, 125000, 275000, 450000, 850000, 1250000, 2000000,
  ]; // sequence same as pools

  const duration = [
    0, 604800, 2592000, 7776000, 15552000, 31104000, 46656000, 62208000,
    93312000, 124416000,
  ];
  // for testing [0, 200, 300, 800, 1000, 1200, 1400, 1600, 1800, 2000,]
  // sequence same as pools

  const startTime = Math.trunc(Date.now() / 1000);

  const rewardPeriords = [0, 1, 4, 12, 25, 51, 77, 102, 154, 205]; //

  const minimumRewardTime = 1 * 7 * 24 * 60 * 60;

  const zeroAddress = "0x0000000000000000000000000000000000000000";

  const batchSize = 10;

  const decayInterval = 1 * 24 * 60 * 60;

  let allDeployments;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    allDeployments = await deployments.fixture(["staking-module"]);

    alva = await ethers.getContractAt(
      "Alvara",
      allDeployments["Alvara"].address
    );

    veAlva = await ethers.getContractAt(
      "veALVA",
      allDeployments["veALVA"].address
    );

    stakingAlva = await ethers.getContractAt(
      "AlvaStaking",
      allDeployments["AlvaStaking"].address
    );

    await alva.setListingTimestamp(100);
  });

  describe("Initialize Values", function () {
    it(`currentIdLock should be set to 0`, async function () {
      let currentIdLock = await stakingAlva.currentIdLock();

      expect(currentIdLock).to.be.equal(0);
    });

    it(`currentIdRewards should be set to 0`, async function () {
      let currentIdRewards = await stakingAlva.currentIdRewards();

      expect(currentIdRewards).to.be.equal(0);
    });

    it("DecayInterval should be set to given value", async function () {
      const decayInterval = (1 * 24 * 60 * 60).toString(); // 40 for testing
      let stakingV1DecayInterval = await stakingAlva.decayInterval();

      expect(stakingV1DecayInterval).to.be.equal(decayInterval);
    });

    // it("totalAmountLocked should be set to 0", async function () {
    //   let totalAmountLocked = await stakingAlva.totalAmountLocked();
    //   expect(totalAmountLocked).to.be.equal(0);
    // });

    it("StartTime should be set to given value", async function () {
      let stakingV1startTime = await stakingAlva.startTime();

      //10 sec to add for transaction execution
      expect(stakingV1startTime + 10n).to.be.greaterThanOrEqual(startTime);
    });

    it("Minimum staking amount should be set to 1", async function () {
      let minStakingAmount = await stakingAlva.minimumStakingAmount();

      expect(minStakingAmount).to.be.equal(1);
    });

    it("Pools should be set to given value and FOREVER and all elements are on same index", async function () {
      for (var i = 0; i < pools.length; i++) {
        let stakingPool = await stakingAlva.Pools(i);
        expect(stakingPool).to.be.equals(pools[i]);
      }

      //Only usable if there no getter method
      await expect(stakingAlva.Pools(pools.length)).to.be.rejectedWith();
    });

    it("Pool data should be added as expected", async function () {
      for (var i = 0; i < pools.length; i++) {
        const poolDetails = await stakingAlva.poolToPoolData(pools[i]);

        expect(poolDetails.length).to.be.equals(6);

        //status should be true byDafault
        const poolStatus = poolDetails.status;
        expect(poolStatus).to.be.equals(true);

        //veTokenRatio should be same as given byDafault
        const poolVeTokenRatio = poolDetails.veAlvaRatio;
        expect(poolVeTokenRatio.toString()).to.be.equals(
          veTokenRatio[i].toString()
        );

        //rewardsPercentage should be same as given byDafault
        const poolRewardsPercentage = poolDetails.poolPercentage;
        expect(poolRewardsPercentage.toString()).to.be.equals(
          rewards[i].toString()
        );

        //duration should be same as given byDafault
        const poolDuration = poolDetails.duration;
        expect(poolDuration.toString()).to.be.equals(duration[i].toString());

        //amountLocked should be 0 at start
        const poolAmountLocked = poolDetails.amountLocked;
        expect(poolAmountLocked).to.be.equals(0);

        //rewardPeriods should be same as given
        const poolRewardPeriods = poolDetails.rewardPeriods;
        expect(poolRewardPeriods).to.be.equals(rewardPeriords[i]);
      }
    });

    it("Initialize can not be called after deployment through implementation", async function () {
      const newAlvaAddress = user1.address;
      const newVeAlvaAddress = user2.address;
      const decayInterval = 10;

      const AlvaStaking_Implementation = await ethers.getContractAt(
        "AlvaStaking",
        allDeployments["AlvaStaking_Implementation"].address
      );

      const oldDecayIntervalAlvaStaking_Implementation =
        await AlvaStaking_Implementation.decayInterval();
      expect(oldDecayIntervalAlvaStaking_Implementation).to.be.equal(0);

      await expect(
        AlvaStaking_Implementation.initialize(
          newAlvaAddress,
          newVeAlvaAddress,
          decayInterval,
          startTime,
          pools,
          rewards,
          veTokenRatio,
          duration,
          rewardPeriords
        )
      ).to.be.rejectedWith("Initializable: contract is already initialized");

      const newDecayIntervalAlvaStaking_Implementation =
        await AlvaStaking_Implementation.decayInterval();
      expect(newDecayIntervalAlvaStaking_Implementation).to.be.equal(0);
    });

    it("Initialize not be called after deployment through proxy", async function () {
      const newAlvaAddress = user1.address;
      const newVeAlvaAddress = user2.address;
      const decayInterval = 10;

      await expect(
        stakingAlva.initialize(
          newAlvaAddress,
          newVeAlvaAddress,
          decayInterval,
          startTime,
          pools,
          rewards,
          veTokenRatio,
          duration,
          rewardPeriords
        )
      ).to.rejectedWith("Initializable: contract is already initialized");
    });

    it("Deployer holds all roles", async function () {
      const deployerAddress = owner.address;

      const DEFAULT_ADMIN_ROLE = await stakingAlva.DEFAULT_ADMIN_ROLE();
      expect(
        await stakingAlva.hasRole(DEFAULT_ADMIN_ROLE, deployerAddress)
      ).to.be.equal(true);

      const PAUSER_ROLE = await stakingAlva.PAUSER_ROLE();
      expect(
        await stakingAlva.hasRole(PAUSER_ROLE, deployerAddress)
      ).to.be.equal(true);

      const ADMIN_ROLE = await stakingAlva.ADMIN_ROLE();
      expect(
        await stakingAlva.hasRole(ADMIN_ROLE, deployerAddress)
      ).to.be.equal(true);

      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      expect(
        await stakingAlva.hasRole(REWARDS_ALLOCATOR_ROLE, deployerAddress)
      ).to.be.equal(true);
    });

    it("0x address validation should be added for alva and veAlva address", async function () {
      const AlvaStaking = await ethers.getContractFactory(
        "AlvaStaking"
      );
      const decayInterval = 10;
      const alvaAddress = await alva.getAddress();
      const veAlvaAddress = await veAlva.getAddress();

      const { deployer } = await getNamedAccounts();

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  zeroAddress,
                  veAlvaAddress,
                  decayInterval,
                  startTime,
                  pools,
                  rewards,
                  veTokenRatio,
                  duration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.rejectedWith("Invalid ALVA token address");

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  alvaAddress,
                  zeroAddress,
                  decayInterval,
                  startTime,
                  pools,
                  rewards,
                  veTokenRatio,
                  duration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.rejectedWith("Invalid veALVA token address");
    });

    it("Decay interval shouldn't be zero", async function () {
      const AlvaStaking = await ethers.getContractFactory(
        "AlvaStaking"
      );
      const alvaAddress = await alva.getAddress();
      const veAlvaAddress = await veAlva.getAddress();

      const { deployer } = await getNamedAccounts();

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  alvaAddress,
                  veAlvaAddress,
                  0,
                  startTime,
                  pools,
                  rewards,
                  veTokenRatio,
                  duration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.rejectedWith("Interval should be within the valid range");
    });
    it("Decay interval shouldn't be more than a week", async function () {
      const AlvaStaking = await ethers.getContractFactory(
        "AlvaStaking"
      );
      const alvaAddress = await alva.getAddress();
      const veAlvaAddress = await veAlva.getAddress();

      const { deployer } = await getNamedAccounts();

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  alvaAddress,
                  veAlvaAddress,
                  1 * 8 * 24 * 60 * 60, // 8 days
                  startTime,
                  pools,
                  rewards,
                  veTokenRatio,
                  duration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.rejectedWith("Interval should be within the valid range");
    });

    it("If Forever pool is not on first index then contract should throw an erro", async function () {
      const AlvaStaking = await ethers.getContractFactory(
        "AlvaStaking"
      );
      const alvaAddress = await alva.getAddress();
      const veAlvaAddress = await veAlva.getAddress();
      let reservePool = pools.slice();
      reservePool.reverse();

      //just confirm Forever is not at 1st index
      expect(reservePool[0]).not.equal("FOREVER");

      const { deployer } = await getNamedAccounts();

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  alvaAddress,
                  veAlvaAddress,
                  decayInterval, // 8 days
                  startTime,
                  reservePool,
                  rewards,
                  veTokenRatio,
                  duration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.be.rejectedWith("Forever pool should at 1st index");
    });

    it("If Forever pool duration is not 0 then contract should throw an error", async function () {
      const AlvaStaking = await ethers.getContractFactory(
        "AlvaStaking"
      );
      const alvaAddress = await alva.getAddress();
      const veAlvaAddress = await veAlva.getAddress();
      let reserveDurration = duration.slice();
      reserveDurration.reverse();

      //just confirm Forever is not at 1st index
      expect(reserveDurration[0]).not.equal(0);

      const { deployer } = await getNamedAccounts();

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  alvaAddress,
                  veAlvaAddress,
                  1 * 7 * 24 * 60 * 60, // 7 days
                  startTime,
                  pools,
                  rewards,
                  veTokenRatio,
                  reserveDurration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.rejectedWith("Invalid Durations");
    });

    it("If rewards sum is not 100 then contract should throw an error", async function () {
      const AlvaStaking = await ethers.getContractFactory(
        "AlvaStaking"
      );
      const alvaAddress = await alva.getAddress();
      const veAlvaAddress = await veAlva.getAddress();
      let newRewards = rewards.slice();
      newRewards.pop(0);
      newRewards.push(110);

      const { deployer } = await getNamedAccounts();

      await expect(
        deployments.deploy("AlvaStaking", {
          from: deployer,
          proxy: {
            execute: {
              init: {
                methodName: "initialize",
                args: [
                  alvaAddress,
                  veAlvaAddress,
                  1 * 7 * 24 * 60 * 60, // 7 days
                  startTime,
                  pools,
                  newRewards,
                  veTokenRatio,
                  duration,
                  rewardPeriords,
                ],
                owner: deployer,
              },
            },
            proxyContract: "OpenZeppelinTransparentProxy",
          },
        })
      ).to.rejectedWith("Invalid Rewards");
    });
  });

  describe("Stake", function () {
    beforeEach(async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);
      await getAlvaTokens(user2.address, tokens);
      await getAlvaTokens(user3.address, tokens);
      await getAlvaTokens(user4.address, tokens);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const allowVeAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await veAlva.allowance(
        user.address,
        spenderAddress
      );

      await veAlva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await veAlva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    it("Staking method will give an error if amount is 0", async function () {
      const stakingAmount = ethers.parseEther("0");
      const pool = pools[0];

      await expect(stakingAlva.stake(stakingAmount, pool)).to.be.rejectedWith(
        "Amount is below the minimum required"
      );
    });

    it("Staking method will give an error if staking amount is less then minimum amount after updating", async function () {
      const stakingAmount = ethers.parseEther("100");
      const pool = pools[0];

      await stakingAlva.updateMinStakingAmount(stakingAmount + 10n);

      await expect(stakingAlva.stake(stakingAmount, pool)).to.be.rejectedWith(
        "Amount is below the minimum required"
      );
    });

    it("Staking method will give an error if pool is invalid", async function () {
      const stakingAmount = ethers.parseEther("10");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, stakingAmount);
      const pool = "TWO_WEEK";

      await expect(
        stakingAlva.connect(user1).stake(stakingAmount, pool)
      ).to.be.rejectedWith("The pool is not available for staking");
    });

    it("Staking method will give an error if amount approved is lower then staking amount", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("5");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "ONE_WEEK";

      await expect(
        stakingAlva.connect(user1).stake(stakingAmount, pool)
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("User can stake alva tokens for ONE_WEEK and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "ONE_WEEK";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("1"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[1]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[1]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for ONE_MONTH and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "ONE_MONTH";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("5"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[2]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[2]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for THREE_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "THREE_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("20"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[3]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[3]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for SIX_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "SIX_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("50"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[4]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[4]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for TWELVE_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "TWELVE_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("100"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[5]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[5]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for EIGHTEEN_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "EIGHTEEN_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("200"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[6]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[6]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for TWENTYFOUR_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "TWENTYFOUR_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("400"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[7]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[7]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for THIRTYSIX_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "THIRTYSIX_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("800"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[8]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[8]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for FORTYEIGHT_MONTHS and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "FORTYEIGHT_MONTHS";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("1000"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[9]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[9]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva tokens for FOREVER and contract updates states accordingly", async function () {
      const stakingAmount = ethers.parseEther("100");
      const allowanceAmount = ethers.parseEther("100");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "FOREVER";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      //on 100 aval staking veALva should be followen
      expect(expextedVotingPower).to.be.equal(ethers.parseEther("200"));

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      //Alva tokens should be burnt
      expect(contractPostAlvaBalance).to.be.equal(contractInitialAlvaBalance);

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(true);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[0]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[0]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //Staked event will emiited
    });

    it("User can stake alva 2 times, 1 for time base and 1 for forever", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("20");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool1 = "ONE_WEEK";

      let initialExpectedVotingPower, currentIdLockInitial;

      initialExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool1
      );

      currentIdLockInitial = await stakingAlva.currentIdLock();

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool1))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool1,
          initialExpectedVotingPower
        );

      let userVeAlavPostBalance;

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(initialExpectedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Now stake again for forever pool
      const pool2 = "FOREVER";

      nextExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool2
      );

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool2))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 2,
          user1.address,
          stakingAmount,
          pool2,
          nextExpectedVotingPower
        );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(
        initialExpectedVotingPower + nextExpectedVotingPower
      );

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 2
      );
    });

    it("User can stake alva 2 times, 1 for forever and 1 for any timebase pool", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("20");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool1 = "FOREVER";

      let initialExpectedVotingPower, currentIdLockInitial;

      initialExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool1
      );

      currentIdLockInitial = await stakingAlva.currentIdLock();

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool1))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool1,
          initialExpectedVotingPower
        );

      let userVeAlavPostBalance;

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(initialExpectedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Now stake again for forever pool
      const pool2 = "ONE_WEEK";

      nextExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool2
      );

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool2))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 2,
          user1.address,
          stakingAmount,
          pool2,
          nextExpectedVotingPower
        );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(
        initialExpectedVotingPower + nextExpectedVotingPower
      );

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 2
      );
    });

    it("User can't stake twice for timebase stake", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("20");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool1 = "ONE_WEEK";

      let initialExpectedVotingPower, currentIdLockInitial;

      initialExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool1
      );

      currentIdLockInitial = await stakingAlva.currentIdLock();

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool1))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool1,
          initialExpectedVotingPower
        );

      let userVeAlavPostBalance;

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(initialExpectedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Now stake again for forever pool
      const pool2 = "ONE_MONTH";

      nextExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool2
      );

      await expect(
        stakingAlva.connect(user1).stake(stakingAmount, pool2)
      ).to.be.rejectedWith("Timebase lock already exists");
    });

    it("User can't stake 2 times for forever stake", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("20");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool1 = "FOREVER";

      let initialExpectedVotingPower, currentIdLockInitial;

      initialExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool1
      );

      currentIdLockInitial = await stakingAlva.currentIdLock();

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool1))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool1,
          initialExpectedVotingPower
        );

      let userVeAlavPostBalance;

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(initialExpectedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Now stake again for forever pool
      const pool2 = "FOREVER";

      nextExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool2
      );

      await expect(
        stakingAlva.connect(user1).stake(stakingAmount, pool2)
      ).to.be.rejectedWith("Forever lock already exists");
    });

    it("User can stake 2 times for timebase if first one is already expired and unstaked", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("20");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool1 = "ONE_WEEK";

      let initialExpectedVotingPower, currentIdLockInitial;

      initialExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool1
      );

      currentIdLockInitial = await stakingAlva.currentIdLock();

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool1))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool1,
          initialExpectedVotingPower
        );

      let userVeAlavPostBalance;

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(initialExpectedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      nextExpectedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool1
      );

      //increase the time
      await time.increase(duration[2]);

      //allow veAlvaToken
      await allowVeAlvaTokens(
        user1,
        stakingContractAddress,
        userVeAlavPostBalance
      );

      //unstake token
      await expect(stakingAlva.connect(user1).unstake()).to.emit(
        stakingAlva,
        "Withdrawn"
      );

      await expect(
        stakingAlva.connect(user1).stake(stakingAmount, pool1)
      ).to.emit(stakingAlva, "TokensStaked");

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 2
      );
    });

    it("Staking will done if all parms are correct and states are updated accordingly", async function () {
      const stakingAmount = ethers.parseEther("10");
      const allowanceAmount = ethers.parseEther("10");
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, allowanceAmount);
      const pool = "ONE_WEEK";

      let userInitialAlvaBalance,
        contractInitialAlvaBalance,
        userVeAlavInitialBalance,
        currentIdLockInitial,
        expextedVotingPower,
        initialTotalAmountLocked;

      userInitialAlvaBalance = await alva.balanceOf(user1.address);
      contractInitialAlvaBalance = await alva.balanceOf(stakingContractAddress);

      userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(0);

      currentIdLockInitial = await stakingAlva.currentIdLock();

      // initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user1).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          currentIdLockInitial.toString() + 1,
          user1.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      let userPostAlvaBalance,
        contractPostAlvaBalance,
        userVeAlavPostBalance,
        postCurrentIdLock,
        postTotalAmountLocked;

      //Alva transferred from user address to contract
      userPostAlvaBalance = await alva.balanceOf(user1.address);
      contractPostAlvaBalance = await alva.balanceOf(stakingContractAddress);

      expect(userPostAlvaBalance).to.be.equal(
        userInitialAlvaBalance - stakingAmount
      );
      expect(contractPostAlvaBalance).to.be.equal(
        contractInitialAlvaBalance + stakingAmount
      );

      //User will get veAlvaToken
      //veAlva token amount should be same as expected
      userVeAlavPostBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavPostBalance).to.be.equal(expextedVotingPower);

      //currentIdLock should be incremented
      postCurrentIdLock = await stakingAlva.currentIdLock();
      expect(postCurrentIdLock).to.be.equal(
        currentIdLockInitial.toString() + 1
      );

      //Need to discuss accountToLockIds condition with Hamza ?

      // //accountToLockIds should be updated
      // let postAccountToLockIds = await stakingAlva.accountToLockIds(
      //   user1.address
      // );
      // console.log("postAccountToLockIds : ", postAccountToLockIds);

      //lockIdToLockData will be updated
      let postLockdata = await stakingAlva.lockIdToLockData(postCurrentIdLock);

      expect(postLockdata.pool).to.be.equal(pool);
      // expect(postLockdata.account).to.be.equal(user1.address);
      expect(postLockdata.amount).to.be.equal(stakingAmount);
      expect(postLockdata.isForever).to.be.equal(false);
      // do we need duration here ?
      expect(postLockdata.duration).to.be.equal(duration[1]);

      //get currentTime
      let timeNow = Math.trunc(Date.now() / 1000);

      expect(postLockdata.startTime).to.be.lessThanOrEqual(timeNow + 20);
      expect(postLockdata.endTime).to.be.lessThanOrEqual(
        timeNow + 20 + duration[1]
      );
      expect(postLockdata.votingPower).to.be.equal(userVeAlavPostBalance);
      expect(postLockdata.isActive).to.be.equal(true);

      //Need information regarding other parms

      // //totalAmount locked will be updated
      // postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + stakingAmount
      // );

      // //poolToPoolData will be updated
      // let postPoolDetails = await stakingAlva.poolToPoolData(pool);
      // expect(postPoolDetails.amountLocked).to.be.equal(stakingAmount);

      //TokensStaked event will emiited
    });
  });

  describe("Increase Staking Amount", function () {
    const defaultPool = "ONE_WEEK";
    const defaultAmount = "10";
    let initialVotingPower;

    beforeEach(async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);

      initialVotingPower = await staking(defaultAmount, defaultPool, user1);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    it("Increase amount method will give error if amount is 0", async function () {
      const newAmount = ethers.parseEther("0");
      const isForever = false;

      await expect(
        stakingAlva.connect(user1).increaseAmount(newAmount, isForever)
      ).to.be.rejectedWith("Amount is below the minimum required");
    });

    it("Increase amount method will give error if staking(timebase) is not exists", async function () {
      const newAmount = ethers.parseEther("2");
      const isForever = false;

      await getAlvaTokens(user2.address, newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user2, stakingContractAddress, newAmount);

      await expect(
        stakingAlva.connect(user2).increaseAmount(newAmount, isForever)
      ).to.be.rejectedWith("No Active lock exists");
    });

    it("Increase amount method will give error if staking(forever) is not exists", async function () {
      const newAmount = ethers.parseEther("2");
      const isForever = true;

      await getAlvaTokens(user2.address, newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user2, stakingContractAddress, newAmount);

      await expect(
        stakingAlva.connect(user2).increaseAmount(newAmount, isForever)
      ).to.be.rejectedWith("No active forever lock exists for the user");
    });

    it("Increase forever-pool amount method will give error if staking(timebase) exists but forever not exists", async function () {
      const newAmount = ethers.parseEther("2");
      const isForever = true;

      await getAlvaTokens(user1.address, newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      await expect(
        stakingAlva.connect(user1).increaseAmount(newAmount, isForever)
      ).to.be.rejectedWith("No active forever lock exists for the user");
    });

    it("Increase timebase-pool amount method will give error if staking(forever) exists but timebase not exists", async function () {
      const newAmount = ethers.parseEther("4");
      const stakingAmount = ethers.parseEther("2");
      const forverPool = "FOREVER";
      const isForever = false;

      await getAlvaTokens(user2.address, newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await staking("2", forverPool, user2);

      await allowAlvaTokens(user2, stakingContractAddress, stakingAmount);

      await expect(
        stakingAlva.connect(user2).increaseAmount(stakingAmount, isForever)
      ).to.be.rejectedWith("No Active lock exists");
    });

    it("Increase method will give error if amount is increased for a exipred timebase staking", async function () {
      const newAmount = ethers.parseEther("2");
      const isForever = false;

      await getAlvaTokens(user1.address, newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      await time.increase(duration[1]);

      await expect(
        stakingAlva.connect(user1).increaseAmount(newAmount, isForever)
      ).to.be.rejectedWith("No Active lock exists");
    });

    it("Increase method will give error if amount is not approved", async function () {
      const newAmount = ethers.parseEther("2");
      const isForever = false;

      await getAlvaTokens(user1.address, newAmount);

      await expect(
        stakingAlva.connect(user1).increaseAmount(newAmount, isForever)
      ).to.be.rejectedWith("ERC20: insufficient allowance");
    });

    it("Increase method will increase staking amount and contract update states accordingly for timebase-pool", async function () {
      const newAmount = ethers.parseEther("2");
      const isForever = false;

      await getAlvaTokens(user1.address, newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expectedVotingPower = await stakingAlva.getveAlvaAmount(
        newAmount,
        defaultPool
      );

      let userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);
      expect(initialVotingPower).to.be.equal(userVeAlavInitialBalance);

      // let initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      let totalAmount = ethers.parseEther(defaultAmount) + newAmount;

      let totalVotingPower = initialVotingPower + expectedVotingPower;

      await expect(
        stakingAlva.connect(user1).increaseAmount(newAmount, isForever)
      )
        .to.emit(stakingAlva, "StakedAmountIncreased")
        .withArgs(currentIdLock, totalAmount, totalVotingPower);

      //rewarding pending should be updated ?

      //veAlva token should be received
      let userVeAlavPostBalance = await veAlva.balanceOf(user1.address);
      expect(userVeAlavPostBalance).to.be.equal(totalVotingPower);

      // //totalAmountLocked should be updated
      // let postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + newAmount
      // );

      //loclIdToData should be updated
      let postLockData = await stakingAlva.lockIdToLockData(currentIdLock);
      expect(postLockData.amount).to.be.equal(totalAmount);
      expect(postLockData.votingPower).to.be.equal(totalVotingPower);

      // //Pool data should be updated with new amount
      // let postPoolData = await stakingAlva.poolToPoolData(defaultPool);
      // expect(postPoolData.amountLocked).to.be.equal(totalAmount);
    });

    it("Increase method will increase staking amount and contract update states accordingly for forever-pool", async function () {
      const newAmount = ethers.parseEther("2");
      const forverPool = "FOREVER";

      const isForever = true;

      await getAlvaTokens(user1.address, newAmount + newAmount);
      const stakingContractAddress = await stakingAlva.getAddress();
      await staking("2", forverPool, user1);

      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expectedVotingPowerInitialForever = await stakingAlva.getveAlvaAmount(
        newAmount,
        forverPool
      );

      let userVeAlavInitialBalance = await veAlva.balanceOf(user1.address);

      expect(userVeAlavInitialBalance).to.be.equal(
        initialVotingPower + expectedVotingPowerInitialForever
      );

      // let initialTotalAmountLocked = await stakingAlva.totalAmountLocked();

      let totalAmount = newAmount + newAmount;

      let totalVotingPower =
        initialVotingPower +
        expectedVotingPowerInitialForever +
        expectedVotingPowerInitialForever;

      await expect(
        stakingAlva.connect(user1).increaseAmount(newAmount, isForever)
      )
        .to.emit(stakingAlva, "StakedAmountIncreased")
        .withArgs(
          currentIdLock,
          totalAmount,
          totalVotingPower - initialVotingPower
        );

      //rewarding pending should be updated ?

      //veAlva token should be received
      let userVeAlavPostBalance = await veAlva.balanceOf(user1.address);
      expect(userVeAlavPostBalance).to.be.equal(totalVotingPower);

      // //totalAmountLocked should be updated
      // let postTotalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(postTotalAmountLocked).to.be.equal(
      //   initialTotalAmountLocked + newAmount
      // );

      //loclIdToData should be updated
      let postLockData = await stakingAlva.lockIdToLockData(currentIdLock);
      expect(postLockData.amount).to.be.equal(totalAmount);
      expect(postLockData.votingPower).to.be.equal(
        totalVotingPower - initialVotingPower
      );

      // //Pool data should be updated with new amount
      // let postPoolData = await stakingAlva.poolToPoolData(forverPool);
      // expect(postPoolData.amountLocked).to.be.equal(totalAmount);
    });
  });

  describe("Renew Staking", function () {
    const defaultPool = "ONE_MONTH";
    const defaultPool2 = "FOREVER";
    const defaultAmount = "10";
    let initialVotingPower, initialVotingPower2;

    beforeEach(async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);
      await getAlvaTokens(user2.address, tokens);

      initialVotingPower = await staking(defaultAmount, defaultPool, user1);
      initialVotingPower2 = await staking(defaultAmount, defaultPool2, user2);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    it("Renew method will give error if any less duration timebase pool is given", async function () {
      const newAmount = ethers.parseEther("10");
      const newPool = "ONE_WEEK";

      await expect(
        stakingAlva.connect(user1).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("Lock duration cannot be less than existing lock");
    });

    it("Renew method will give error if there's no any staking done already", async function () {
      const newAmount = ethers.parseEther("10");
      const newPool = "THREE_MONTHS";

      await expect(
        stakingAlva.connect(user3).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("No active lock found");
    });

    it("Renew method will give error if user want to extended any FOREVER Poll to timebase", async function () {
      const newAmount = ethers.parseEther("10");
      const newPool = "THREE_MONTHS";

      await expect(
        stakingAlva.connect(user2).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("No active lock found");
    });

    it("User can resume their staking with new start-time without changing pool duration or amount", async function () {
      const newAmount = ethers.parseEther("0");

      const oldPoolId = "1"; //await stakingAlva.accountToLockIds(user1.address);

      let newPoolId = (await stakingAlva.currentIdLock()) + BigInt(1);

      const initialAlvaBalance = await alva.balanceOf(user1.address);
      const initialVeAlvaBalance = await veAlva.balanceOf(user1.address);
      // const initialAmountLocked = await stakingAlva.totalAmountLocked();

      await expect(
        stakingAlva.connect(user1).renewStaking(newAmount, defaultPool)
      )
        .to.emit(stakingAlva, "LockRenewed")
        .withArgs(oldPoolId, newPoolId);

      //Total amount locked will be same
      // const postAmountLocked = await stakingAlva.totalAmountLocked();
      //Need to check ?
      // expect(postAmountLocked).to.be.equal(initialAmountLocked);

      //No alva will be deducted in case already more approved
      const postAlvaBalance = await alva.balanceOf(user1.address);
      expect(postAlvaBalance).to.be.equal(initialAlvaBalance);

      //Same Voting Power will be given
      const postVeAlvaBalance = await veAlva.balanceOf(user1.address);
      expect(postVeAlvaBalance).to.be.equal(initialVeAlvaBalance);

      //Old staking should be end
      const oldStaking = await stakingAlva.lockIdToLockData(oldPoolId);
      // expect(oldStaking.account).to.be.equal(user1.address);
      expect(oldStaking.pool).to.be.equal(defaultPool);
      expect(oldStaking.isActive).to.be.equal(false);

      //New staking should be added same as old, only new start time
      const newStaking = await stakingAlva.lockIdToLockData(newPoolId);
      // expect(newStaking.account).to.be.equal(user1.address);
      expect(newStaking.pool).to.be.equal(defaultPool);
      expect(newStaking.isActive).to.be.equal(true);
      expect(newStaking.isForever).to.be.equal(oldStaking.isForever);
      expect(newStaking.duration).to.be.equal(oldStaking.duration);
      expect(newStaking.startTime).to.be.equal(oldStaking.endTime);
    });

    it("User can extend their staking with new start-time and new pool duration", async function () {
      const newAmount = ethers.parseEther("0");
      const newPool = "THREE_MONTHS";

      const oldPoolId = "1"; //await stakingAlva.accountToLockIds(user1.address);

      let newPoolId = (await stakingAlva.currentIdLock()) + BigInt(1);

      const initialAlvaBalance = await alva.balanceOf(user1.address);
      const initialVeAlvaBalance = await veAlva.balanceOf(user1.address);
      // const initialAmountLocked = await stakingAlva.totalAmountLocked();

      await expect(stakingAlva.connect(user1).renewStaking(newAmount, newPool))
        .to.emit(stakingAlva, "LockRenewed")
        .withArgs(oldPoolId, newPoolId);

      // //Total amount locked will be same
      // const postAmountLocked = await stakingAlva.totalAmountLocked();
      //Need to check ?
      // expect(postAmountLocked).to.be.equal(initialAmountLocked);

      //No alva will be deducted in case already more approved
      const postAlvaBalance = await alva.balanceOf(user1.address);
      expect(postAlvaBalance).to.be.equal(initialAlvaBalance);

      //Voting Power will be increased
      const postVeAlvaBalance = await veAlva.balanceOf(user1.address);
      expect(postVeAlvaBalance).to.be.greaterThan(initialVeAlvaBalance);
      const votingPOwer = await stakingAlva.getveAlvaAmount(
        ethers.parseEther(defaultAmount),
        newPool
      );

      expect(postVeAlvaBalance).to.be.equal(votingPOwer);

      //Old staking should be end
      const oldStaking = await stakingAlva.lockIdToLockData(oldPoolId);
      // expect(oldStaking.account).to.be.equal(user1.address);
      expect(oldStaking.pool).to.be.equal(defaultPool);
      expect(oldStaking.isActive).to.be.equal(false);

      //New staking should be added same as old, only new start time
      const newStaking = await stakingAlva.lockIdToLockData(newPoolId);
      // expect(newStaking.account).to.be.equal(user1.address);
      expect(newStaking.pool).to.be.equal(newPool);
      expect(newStaking.isActive).to.be.equal(true);
      expect(newStaking.isForever).to.be.equal(false);
      expect(newStaking.startTime).to.be.equal(oldStaking.endTime);
    });

    it("User can't extend their timebase pool to Forever Pool without changing the staking amount also", async function () {
      const newAmount = ethers.parseEther("0");
      const newPool = "FOREVER";

      const oldPoolId = "1"; //await stakingAlva.accountToLockIds(user1.address);

      let newPoolId = (await stakingAlva.currentIdLock()) + BigInt(1);

      const initialAlvaBalance = await alva.balanceOf(user1.address);
      const initialVeAlvaBalance = await veAlva.balanceOf(user1.address);
      // const initialAmountLocked = await stakingAlva.totalAmountLocked();

      await expect(
        stakingAlva.connect(user1).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("Lock duration cannot be less than existing lock");
    });

    it("User can extend their timebase pool to extended Pool along with new amount", async function () {
      const newAmount = ethers.parseEther("10");

      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      const newPool = "SIX_MONTHS";

      const oldPoolId = "1"; //await stakingAlva.accountToLockIds(user1.address);

      let newPoolId = (await stakingAlva.currentIdLock()) + BigInt(1);

      const initialAlvaBalance = await alva.balanceOf(user1.address);
      const initialVeAlvaBalance = await veAlva.balanceOf(user1.address);
      // const initialAmountLocked = await stakingAlva.totalAmountLocked();

      await expect(stakingAlva.connect(user1).renewStaking(newAmount, newPool))
        .to.emit(stakingAlva, "LockRenewed")
        .withArgs(oldPoolId, newPoolId);

      // //Total amount locked will be same
      // const postAmountLocked = await stakingAlva.totalAmountLocked();
      //Need to check ?
      // expect(postAmountLocked).to.be.equal(initialAmountLocked);

      //No alva will be deducted in case already more approved
      const postAlvaBalance = await alva.balanceOf(user1.address);
      expect(postAlvaBalance).to.be.equal(initialAlvaBalance - newAmount);

      //Voting Power will be increased
      const postVeAlvaBalance = await veAlva.balanceOf(user1.address);
      expect(postVeAlvaBalance).to.be.greaterThan(initialVeAlvaBalance);

      const totalAmount = ethers.parseEther(defaultAmount) + newAmount;

      const votingPOwer = await stakingAlva.getveAlvaAmount(
        totalAmount,
        newPool
      );

      expect(postVeAlvaBalance).to.be.equal(votingPOwer);

      //Old staking should be end
      const oldStaking = await stakingAlva.lockIdToLockData(oldPoolId);
      // expect(oldStaking.account).to.be.equal(user1.address);
      expect(oldStaking.pool).to.be.equal(defaultPool);
      expect(oldStaking.isActive).to.be.equal(false);

      //New staking should be added same as old, only new start time
      const newStaking = await stakingAlva.lockIdToLockData(newPoolId);
      // expect(newStaking.account).to.be.equal(user1.address);
      expect(newStaking.pool).to.be.equal(newPool);
      expect(newStaking.isActive).to.be.equal(true);
      expect(newStaking.isForever).to.be.equal(false);
      expect(newStaking.startTime).to.be.equal(oldStaking.endTime);
    });

    it("User can't extend their timebase pool to Forever Pool with new staking amount", async function () {
      const newAmount = ethers.parseEther("10");

      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      const newPool = "FOREVER";

      const oldPoolId = "1"; //await stakingAlva.accountToLockIds(user1.address);

      let newPoolId = (await stakingAlva.currentIdLock()) + BigInt(1);

      const initialAlvaBalance = await alva.balanceOf(user1.address);
      const initialVeAlvaBalance = await veAlva.balanceOf(user1.address);
      // const initialAmountLocked = await stakingAlva.totalAmountLocked();

      //Sham Need to update the message ?
      await expect(
        stakingAlva.connect(user1).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("Lock duration cannot be less than existing lock");
    });

    it("If user has already a Forever stake then he can't extend timebase staking to Forever", async function () {
      const newAmount = ethers.parseEther("10");

      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user2, stakingContractAddress, newAmount);

      const newPool = "FOREVER";

      const oldPoolId = "1"; //await stakingAlva.accountToLockIds(user2.address);

      let newPoolId = (await stakingAlva.currentIdLock()) + BigInt(1);

      await expect(
        stakingAlva.connect(user2).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("No active lock found");
    });

    it("User can't renew any staking after the expiration", async function () {
      const newAmount = ethers.parseEther("10");

      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user1, stakingContractAddress, newAmount);

      const newPool = "SIX_MONTHS";

      await time.increase(duration[2]);

      await expect(
        stakingAlva.connect(user1).renewStaking(newAmount, newPool)
      ).to.be.rejectedWith("No active lock found");
    });
  });

  describe("Unstake", function () {
    const defaultPool = "ONE_MONTH";
    const defaultPool2 = "FOREVER";
    const defaultAmount = "10";
    let initialVotingPower, initialVotingPower2;

    beforeEach(async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);
      await getAlvaTokens(user2.address, tokens);

      initialVotingPower = await staking(defaultAmount, defaultPool, user1);
      initialVotingPower2 = await staking(defaultAmount, defaultPool2, user2);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    it("User can't unstake if staking is not done already", async function () {
      await expect(stakingAlva.connect(user3).unstake()).to.be.rejectedWith(
        "No active lock found"
      );
    });

    it("User can't unstake any forever lock", async function () {
      await expect(stakingAlva.connect(user2).unstake()).to.be.rejectedWith(
        "No active lock found"
      );
    });

    it("User can't unstake before staking time expiration", async function () {
      await expect(stakingAlva.connect(user1).unstake()).to.be.rejectedWith(
        "Cannot unstake before the lock end time"
      );
    });

    it("User can unstake after completion of duration and contract will updates stats accordingly", async function () {
      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(activeLockId).to.be.equal("1");

      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const userInitialAvlaBalance = await alva.balanceOf(user1.address);
      // const userInitialVeAlvaBalance = await veAlva.balanceOf(user1.address);

      await time.increase(duration[2]);

      await expect(stakingAlva.connect(user1).unstake())
        .to.emit(stakingAlva, "Withdrawn")
        .withArgs(user1.address, activeLockId, lockData.endTime);

      //After unstake contracts states should be updated

      //getActiveTimeBase should return 0
      const newActiveLockId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(newActiveLockId).to.be.equal(0);

      //Lockdata should be updated
      const newLockData = await stakingAlva.lockIdToLockData(activeLockId);
      // expect(newLockData.account).to.be.equal(user1.address);
      expect(newLockData.isActive).to.be.equal(false);

      //veAlva should be burnt
      const userPostVeAlvaBalance = await veAlva.balanceOf(user1.address);
      expect(userPostVeAlvaBalance).to.be.equal(0);

      //User must get all avla token back
      const userPostAvlaBalance = await alva.balanceOf(user1.address);
      expect(userPostAvlaBalance).to.be.equal(
        userInitialAvlaBalance + ethers.parseEther(defaultAmount)
      );
    });

    it("User voting should be decayed after completion of duration", async function () {
      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(activeLockId).to.be.equal("1");

      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const userInitialAvlaBalance = await alva.balanceOf(user1.address);
      // const userInitialVeAlvaBalance = await veAlva.balanceOf(user1.address);

      const userVotingPowerInitial = await stakingAlva.veAlvaBalance(
        user1.address
      );

      await time.increase(duration[2]);

      const userVotingPowerAfterCompletion = await stakingAlva.veAlvaBalance(
        user1.address
      );
      expect(userVotingPowerAfterCompletion).to.be.equal(0);

      await expect(stakingAlva.connect(user1).unstake())
        .to.emit(stakingAlva, "Withdrawn")
        .withArgs(user1.address, activeLockId, lockData.endTime);

      const userVotingPowerAfterUnstake = await stakingAlva.veAlvaBalance(
        user1.address
      );
      expect(userVotingPowerAfterUnstake).to.be.equal(0);
    });
  });

  describe("topUpRewards", function () {
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;
      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(10000000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      // console.log("Allowance : ", userAfterAllowance)

      // expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    it("Admin can't call topUpRewards with 0 amount", async function () {
      const tokens = ethers.parseEther("0");
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);
      await expect(
        stakingAlva.connect(rewardAllocator).topUpRewards()
      ).to.be.rejectedWith("Reward must be at least the minimum amount");
    });

    it("Admin can't call topUpRewards with less then 200 wei which is the minimum amount", async function () {
      const tokens = 199n;
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, tokens);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);
      await expect(
        stakingAlva.connect(rewardAllocator).topUpRewards()
      ).to.be.rejectedWith("Reward must be at least the minimum amount");
    });

    it("Admin can't topUpRewards before the time-period which will be 1 week by default", async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(rewardAllocator.address, tokens);

      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);

      await expect(
        stakingAlva.connect(rewardAllocator).topUpRewards()
      ).to.be.rejectedWith("Cannot process before time");
    });

    it("All unallocted reward should be added to the new rewards if there's no staking done for that specific Pool", async function () {
      const tokens = ethers.parseEther("100");

      const addRewardsAndValidate = async (tokens, oldTokens) => {
        const stakingContractAddress = await stakingAlva.getAddress();
        await getAlvaTokens(rewardAllocator.address, tokens);
        await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);

        const currentRewardId = await stakingAlva.currentIdRewards();
        await time.increase(minimumRewardTime);
        const id = await stakingAlva.rewardPeriodCount();
        const totalTokens = tokens + oldTokens;

        await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
          .to.emit(stakingAlva, "RewardsAdded")
          .withArgs(currentRewardId, totalTokens);

        const newRewardId = await stakingAlva.currentIdRewards();
        expect(newRewardId).to.be.equal(currentRewardId + 1n);

        const dataForRewardId = await stakingAlva.rewardIdToRewardData(
          currentRewardId
        );

        expect(dataForRewardId.amount).to.be.equal(totalTokens);
      };

      await addRewardsAndValidate(tokens, 0n);
      const unalloctedRewardsInitial = await stakingAlva.unallocatedRewards();
      expect(unalloctedRewardsInitial).to.be.equal(tokens);

      //Need to Topup Rewards again
      await addRewardsAndValidate(tokens, unalloctedRewardsInitial);
      const unalloctedRewardsPost = await stakingAlva.unallocatedRewards();
      expect(unalloctedRewardsPost).to.be.equal(
        unalloctedRewardsInitial + tokens
      );

      // const totalAmountLocked = await stakingAlva.totalAmountLocked();
      // expect(dataForRewardId.totalStakings).to.be.equal(totalAmountLocked);
    });

    it("Admin can call topUpRewards with with any valid amount", async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(rewardAllocator.address, tokens);
      const adminAlvaBalanceInitial = await alva.balanceOf(
        rewardAllocator.address
      );
      expect(adminAlvaBalanceInitial).to.be.equal(tokens);
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);

      const currentRewardId = await stakingAlva.currentIdRewards();
      expect(currentRewardId).to.be.equal(0);
      await time.increase(minimumRewardTime);
      await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
        .to.emit(stakingAlva, "RewardsAdded")
        .withArgs(currentRewardId, tokens);

      //100% is withdral, so balance should be zero
      const adminAlvaBalancePost = await alva.balanceOf(
        rewardAllocator.address
      );
      expect(adminAlvaBalancePost).to.be.equal(0);

      const newRewardId = await stakingAlva.currentIdRewards();
      expect(newRewardId).to.be.equal("1");

      const dataForRewardId = await stakingAlva.rewardIdToRewardData(
        currentRewardId
      );

      expect(dataForRewardId.amount).to.be.equal(tokens);

      const poolData = await stakingAlva.getPoolDataByRewardId(
        currentRewardId,
        pools[0]
      );
      expect(poolData[0]).to.be.equal(0n);
      // const totalAmountLocked = await stakingAlva.totalAmountLocked();

      // expect(dataForRewardId.totalStakings).to.be.equal(totalAmountLocked);
    });

    it("Admin can call topUpRewards with updated minimum amount", async function () {
      const tokens = 10000n;
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, tokens);
      await allowAlvaTokens(
        rewardAllocator,
        stakingContractAddress,
        3n * tokens
      );
      // topup with minimum amount
      await time.increase(minimumRewardTime);
      await stakingAlva.connect(rewardAllocator).topUpRewards();

      await time.increase(minimumRewardTime);
      await stakingAlva.updateMinimumRewardAmount(tokens + tokens);
      await getAlvaTokens(rewardAllocator.address, tokens);
      await expect(
        stakingAlva.connect(rewardAllocator).topUpRewards()
      ).to.be.rejectedWith("Reward must be at least the minimum amount");

      await getAlvaTokens(rewardAllocator.address, tokens);
      await stakingAlva.connect(rewardAllocator).topUpRewards();
    });

    it("Admin balance should be deducted according to percentage set", async function () {
      const tokens = 100n; //100 tokens
      const factorMultiplication = 100000n;
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, tokens);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);

      await stakingAlva.updateMinimumRewardAmount(1n);

      for (let i = 0; i < 10; i++) {
        let vaultPercentage = BigInt((i + 1) * 10); //10n;
        await stakingAlva.updateWithdrawalPercentage(
          vaultPercentage * factorMultiplication
        );
        await time.increase(minimumRewardTime);
        await stakingAlva.connect(rewardAllocator).topUpRewards();
        let rewardAllocatorBalance = await alva.balanceOf(rewardAllocator);
        let deductedPercentage = (tokens * vaultPercentage) / 100n;
        expect(rewardAllocatorBalance).to.be.equal(tokens - deductedPercentage);

        //Get back deducted balance tokens
        await getAlvaTokens(rewardAllocator.address, deductedPercentage);
        await allowAlvaTokens(rewardAllocator, stakingContractAddress, tokens);
      }

      let rewardAllocatorBalanceAfter = await alva.balanceOf(rewardAllocator);
      expect(rewardAllocatorBalanceAfter).to.be.equal(tokens);
    });
  });

  // describe("calculateRewards", function () {
  //   const getAlvaTokens = async (userAddress, amount) => {
  //     const userInitialBalance = await alva.balanceOf(userAddress);
  //     await alva.transfer(userAddress, amount);

  //     const userAfterBalance = await alva.balanceOf(userAddress);

  //     expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
  //   };

  //   const allowAlvaTokens = async (user, spenderAddress, amount) => {
  //     const userInitialAllowance = await alva.allowance(
  //       user.address,
  //       spenderAddress
  //     );

  //     await alva.connect(user).approve(spenderAddress, amount);

  //     const userAfterAllowance = await alva.allowance(
  //       user.address,
  //       spenderAddress
  //     );

  //     expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
  //   };

  //   const staking = async (amount, pool, user) => {
  //     const stakingAmount = ethers.parseEther(amount);
  //     //Allow tokens
  //     const stakingContractAddress = await stakingAlva.getAddress();
  //     await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

  //     let currentIdLock = await stakingAlva.currentIdLock();
  //     let expextedVotingPower = await stakingAlva.getveAlvaAmount(
  //       stakingAmount,
  //       pool
  //     );

  //     await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
  //       .to.emit(stakingAlva, "TokensStaked")
  //       .withArgs(
  //         +currentIdLock.toString() + 1,
  //         user.address,
  //         stakingAmount,
  //         pool,
  //         expextedVotingPower
  //       );

  //     return expextedVotingPower;
  //   };

  //   const topUpRewards = async (amount) => {
  //     //Allow amount of alva tokens from owner to stakingContract
  //     const stakingContractAddress = await stakingAlva.getAddress();
  //     await allowAlvaTokens(owner, stakingContractAddress, amount);

  //     const currentRewardId = await stakingAlva.currentIdRewards();

  //     await time.increase(minimumRewardTime);
  //     await expect(stakingAlva.topUpRewards(amount))
  //       .to.emit(stakingAlva, "RewardsAdded")
  //       .withArgs(currentRewardId, amount);
  //   };

  //   it("calculateRewards will throw error if reward and lock-id both not exists", async function () {
  //     const rewardId = 0;
  //     const lockId = 0;
  //     expect(
  //       await stakingAlva.calculateRewards(rewardId, lockId)
  //     ).to.be.rejectedWith("No lock found");
  //   });

  //   it("calculateRewards will throw error if reward not exists but lock-id exists", async function () {
  //     const rewardId = 0;

  //     const defaultPool = "ONE_MONTH";
  //     const defaultAmount = "10";
  //     const tokens = ethers.parseEther("100");
  //     await getAlvaTokens(user1.address, tokens);

  //     await staking(defaultAmount, defaultPool, user1);

  //     const user1LockId = await stakingAlva.getActiveTimeBaseLock(
  //       user1.address
  //     );

  //     expect(
  //       await stakingAlva.calculateRewards(rewardId, user1LockId)
  //     ).to.be.rejectedWith("Reward not exists");
  //   });

  //   it("calculateRewards will throw error if reward exists but lock-id not exists", async function () {
  //     const rewardId = 0;
  //     const lockId = 1;

  //     const rewardAmount = ethers.parseEther("100");
  //     await topUpRewards(rewardAmount);

  //     expect(
  //       await stakingAlva.calculateRewards(rewardId, lockId)
  //     ).to.be.rejectedWith("Lock not found");
  //   });

  //   it("calculateRewards will return proper rewards for each pool", async function () {
  //     const defaultAmount = "100";
  //     const tokens = ethers.parseEther("100");

  //     let [o, u1, u2, u3, u4, u5, u6, u7, u8, u9, u10] =
  //       await ethers.getSigners();
  //     let users = [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10];
  //     let activeLocks = [];

  //     //Stake for each pool
  //     for (i = 0; i < pools.length; i++) {
  //       await getAlvaTokens(users[i].address, tokens);
  //       await staking(defaultAmount, pools[i], users[i]);
  //     }

  //     //Topup Rewards
  //     await topUpRewards(tokens);
  //     const rewardId = 0;

  //     //Check rewards for each pool
  //     for (i = 0; i < pools.length; i++) {
  //       let lockIdForUser = i + 1;
  //       const reward = await stakingAlva.calculateRewards(
  //         rewardId,
  //         lockIdForUser
  //       );

  //       expect(parseFloat(ethers.formatEther(reward))).to.be.equals(
  //         parseFloat(defaultAmount * (rewards[i] / 1e7))
  //       );
  //     }
  //   });
  // });

  describe("countRewards", function () {
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;

      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(10000000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    const topUpRewards = async (amount) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, amount);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
        .to.emit(stakingAlva, "RewardsAdded")
        .withArgs(currentRewardId, amount);
    };

    it("countRewards will throw an error if reward and lock-id both not exists", async function () {
      const rewardId = 0;
      const lockId = 0;
      // let rewardDetails = await stakingAlva.countRewards(lockId);
      // expect(rewardDetails.pendingTotal).to.be.equal(0);
      // expect(rewardDetails.pendingCurrent).to.be.equal(0);
      // expect(rewardDetails.openingRewardId).to.be.equal(0);
      await expect(
        stakingAlva.countRewards(lockId, batchSize)
      ).to.be.rejectedWith("Invalid Lock Id");
    });

    it("countRewards will throw an error if reward exists and but lock-id not exists", async function () {
      const rewardId = 0;
      const lockId = 0;

      const rewardAmount = ethers.parseEther("100");
      await topUpRewards(rewardAmount);

      // let rewardDetails = await stakingAlva.countRewards(lockId);
      // expect(rewardDetails.pendingTotal).to.be.equal(0);
      // expect(rewardDetails.pendingCurrent).to.be.equal(0);
      // expect(rewardDetails.openingRewardId).to.be.equal(0);

      await expect(
        stakingAlva.countRewards(lockId, batchSize)
      ).to.be.rejectedWith("Invalid Lock Id");
    });

    it("countRewards will throw an error if reward not exists and but lock-id exists", async function () {
      const lockId = 1;

      const defaultPool = "ONE_MONTH";
      const defaultAmount = "100";
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);

      await staking(defaultAmount, defaultPool, user1);

      // await expect(
      //   stakingAlva.countRewards(lockId, batchSize)
      // ).to.be.rejectedWith("Reward not exists");

      let rewardDetails = await stakingAlva.countRewards(lockId, batchSize);
      expect(rewardDetails.pendingCurrent).to.be.equal(0);
      expect(rewardDetails.openingRewardId).to.be.equal(0);
      expect(rewardDetails.incrementedAmount).to.be.equal(0);
    });

    it("countRewards will return proper rewards for each pool staking", async function () {
      const defaultAmount = "100";
      const tokens = ethers.parseEther("100");

      let [o, u1, u2, u3, u4, u5, u6, u7, u8, u9, u10] =
        await ethers.getSigners();
      let users = [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10];

      //Stake for each pool
      for (i = 0; i < pools.length; i++) {
        await getAlvaTokens(users[i].address, tokens);
        await staking(defaultAmount, pools[i], users[i]);
      }

      // await time.increase(60 * 60 * 24 * 1);
      await topUpRewards(tokens);
      // await time.increase(60 * 60 * 24 * 1);

      const nextRewardId = await stakingAlva.currentIdRewards();

      //Check rewards for each pool
      for (i = 0; i < pools.length; i++) {
        let lockIdForUser = i + 1;

        let rewardDetails = await stakingAlva.countRewards(
          lockIdForUser,
          batchSize
        );

        //As only 1 Rewards are added therefore only next reward id should be 1
        expect(rewardDetails.openingRewardId).to.be.equal(nextRewardId);

        //As only 1 Rewards are added therefore only single reward percentage will pe added to pending
        expect(
          parseFloat(ethers.formatEther(rewardDetails.pendingCurrent))
        ).to.be.equal(parseFloat(defaultAmount * (rewards[i] / 1e7)));

        // //As only 1 Rewards are added therefore pendingTotal will be same as pendingCurrent
        // expect(rewardDetails.pendingTotal).to.be.equal(
        //   rewardDetails.pendingCurrent
        // );
      }
    });

    it("countRewards will also include all pending rewards too for given staking", async function () {
      const defaultAmount = "100";
      const tokens = ethers.parseEther("100");

      let [o, u1, u2, u3, u4, u5, u6, u7, u8, u9, u10] =
        await ethers.getSigners();
      let users = [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10];

      //Stake for each pool
      for (i = 0; i < pools.length; i++) {
        await getAlvaTokens(users[i].address, tokens);
        await staking(defaultAmount, pools[i], users[i]);
      }

      //Add rewards more then 1 time
      // await time.increase(60 * 60 * 24 * 1);
      await topUpRewards(tokens);
      await topUpRewards(tokens);
      // await time.increase(60 * 60 * 24 * 1);

      const nextRewardId = await stakingAlva.currentIdRewards();

      //Check rewards for each pool
      for (i = 0; i < pools.length; i++) {
        let lockIdForUser = i + 1;

        let rewardDetails = await stakingAlva.countRewards(
          lockIdForUser,
          batchSize
        );

        // expect(rewardDetails.openingRewardId).to.be.equal(nextRewardId);

        //As there are 2 rewards, so pending rewards should be simillar
        expect(
          parseFloat(ethers.formatEther(rewardDetails.pendingCurrent))
        ).to.be.equal(parseFloat(2 * (defaultAmount * (rewards[i] / 1e7))));

        // //As only 1 Rewards are added therefore pendingTotal will be same as pendingCurrent
        // expect(rewardDetails.pendingTotal).to.be.equal(
        //   rewardDetails.pendingCurrent
        // );
      }
    });

    //
    // it("countRewards will not include any reward pending for expired staking", async function () {
    //   const defaultAmount = "100";
    //   const tokens = ethers.parseEther("100");

    //   const exipringPoolIndex = 3;

    //   let [o, u1, u2, u3, u4, u5, u6, u7, u8, u9, u10] =
    //     await ethers.getSigners();
    //   let users = [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10];

    //   //Stake for each pool
    //   for (i = 0; i < pools.length; i++) {
    //     await getAlvaTokens(users[i].address, tokens);
    //     await staking(defaultAmount, pools[i], users[i]);
    //   }

    //   //Increase time to 1 day
    //   // await time.increase(60 * 60 * 24 * 1);
    //   for (i = 0; i < rewardPeriords[exipringPoolIndex]; i++){
    //     await topUpRewards(tokens);
    //     await time.increase(minimumRewardTime);
    //   }

    //   //Increase time to 3 months
    //   // await time.increase(duration[exipringPoolIndex]);
    //   await topUpRewards(tokens);

    //   // await time.increase(60 * 60 * 24 * 1);

    //   let nextRewardId = await stakingAlva.currentIdRewards();
    //   console.log("nextRewardId : ", nextRewardId)

    //   //Check rewards for each pool
    //   for (i = 0; i < pools.length; i++) {
    //     let lockIdForUser = i + 1;

    //     let rewardDetails = await stakingAlva.countRewards(
    //       lockIdForUser,
    //       batchSize
    //     );

    //     console.log(`Pool ${pools[i]} : `, rewardDetails.openingRewardId)

    //     if (i != 0 && i <= exipringPoolIndex) {
    //       expect(rewardDetails.openingRewardId).to.be.equal(
    //         rewardPeriords[i]
    //       );

    //       // Only 1 reward will be included
    //       expect(
    //         parseFloat(ethers.formatEther(rewardDetails.pendingCurrent))
    //       ).to.be.equal(parseFloat(defaultAmount * (rewards[i] / 1e7)));
    //     } else {
    //       expect(rewardDetails.openingRewardId).to.be.equal(nextRewardId-3n);

    //       //As there are 2 rewards, so pending rewards should be simillar
    //       // expect(
    //       //   parseFloat(ethers.formatEther(rewardDetails.pendingCurrent))
    //       // ).to.be.equal(parseFloat(2 * (defaultAmount * (rewards[i] / 1e7))));
    //     }

    //     // //As no any reward is claimed therefore pendingReward will be same as totalPending
    //     // expect(rewardDetails.pendingTotal).to.be.equal(
    //     //   rewardDetails.pendingCurrent
    //     // );
    //   }
    // });
  });

  describe("getRewardsPending", function () {
    const defaultPool = "THREE_MONTHS";
    const defaultFoverPool = "FOREVER";
    const defaultAmount = "100";

    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;
      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(10000000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    const topUpRewards = async (amount) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, amount);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
        .to.emit(stakingAlva, "RewardsAdded")
        .withArgs(currentRewardId, amount);
    };

    it("getRewardsPending will return 0 pending rewards if staking not done by that account", async function () {
      expect(await stakingAlva.getRewardsPending(user1.address)).to.be.equal(0);
    });

    it("getRewardsPending will return 0 pending rewards if staking is done but there is no any reward", async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);

      await staking(defaultAmount, defaultPool, user1);

      expect(await stakingAlva.getRewardsPending(user1.address)).to.be.equal(0);
    });

    it("getRewardsPending will return all pending rewards for user staking for timebase pool", async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);

      await topUpRewards(tokens);

      let userPendingRewardsForTimeBasePool =
        await stakingAlva.getRewardsPending(user1.address);

      expect(
        parseFloat(ethers.formatEther(userPendingRewardsForTimeBasePool))
      ).to.be.equal(
        parseFloat(ethers.formatEther(tokens) * (rewards[3] / 1e7))
      );
    });

    it("getRewardsPending will return all pending rewards for user staking for forever pool", async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultFoverPool, user1);

      await topUpRewards(tokens);

      let userPendingRewardsForTimeBasePool =
        await stakingAlva.getRewardsPending(user1.address);

      expect(
        parseFloat(ethers.formatEther(userPendingRewardsForTimeBasePool))
      ).to.be.equal(
        parseFloat(ethers.formatEther(tokens) * (rewards[0] / 1e7))
      );
    });

    it("getRewardsPending will return all pending rewards for user staking for timebase and forever pool", async function () {
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, ethers.parseEther("200"));
      await staking(defaultAmount, defaultPool, user1);
      await staking(defaultAmount, defaultFoverPool, user1);

      await topUpRewards(tokens);

      let userPendingRewardsForTimeBasePool =
        await stakingAlva.getRewardsPending(user1.address);

      let totalRewards =
        ethers.formatEther(tokens) * (rewards[3] / 1e7) +
        ethers.formatEther(tokens) * (rewards[0] / 1e7);

      expect(
        parseFloat(ethers.formatEther(userPendingRewardsForTimeBasePool))
      ).to.be.equal(parseFloat(totalRewards));
    });
  });

  describe("compoundRewards", function () {
    const defaultPool = "THREE_MONTHS";
    const defaultPool2 = "FOREVER";
    const defaultAmount = "10";
    let initialVotingPower, initialVotingPower2;
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;
      const tokens = ethers.parseEther("100");
      await getAlvaTokens(user1.address, tokens);
      await getAlvaTokens(user2.address, tokens);

      await getAlvaTokens(user4.address, tokens);
      await getAlvaTokens(user4.address, tokens);

      initialVotingPower = await staking(defaultAmount, defaultPool, user1);
      initialVotingPower2 = await staking(defaultAmount, defaultPool2, user2);

      //User 4 with both staking timebase & forever
      await staking(defaultAmount, defaultPool, user4);
      await staking(defaultAmount, defaultPool2, user4);

      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(10000000n);
      await getAlvaTokens(rewardAllocator.address, tokens);

      await topUpRewards(tokens);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    const topUpRewards = async (amount) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
        .to.emit(stakingAlva, "RewardsAdded")
        .withArgs(currentRewardId, amount);
    };

    it("User can't compoundRewards for timebase staking if already timebase staking not exists", async function () {
      const isForever = false;
      await expect(
        stakingAlva.connect(user2).compoundRewards(isForever)
      ).to.be.rejectedWith("No Active lock exists");
    });

    it("User can't compoundRewards for forever staking if already forever staking not exists", async function () {
      const isForever = true;
      await expect(
        stakingAlva.connect(user1).compoundRewards(isForever)
      ).to.be.rejectedWith("No active forever lock exists for the user");
    });

    it("User can't compoundRewards(timebase) if user didn't stake for any pool", async function () {
      const isForever = false;
      await expect(
        stakingAlva.connect(user3).compoundRewards(isForever)
      ).to.be.rejectedWith("No rewards available for claiming");
    });

    it("User can't compoundRewards(forever) if user didn't stake for any pool", async function () {
      const isForever = true;
      await expect(
        stakingAlva.connect(user3).compoundRewards(isForever)
      ).to.be.rejectedWith("No rewards available for claiming");
    });

    it("User can compoundRewards for timebase pool and contract updates all contract states accordingly", async function () {
      const isForever = false;
      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const pendingRewards = await stakingAlva.getRewardsPending(user1.address);

      const newAmount = lockData.amount + pendingRewards;

      let expectedVotingPower = await stakingAlva.getveAlvaAmount(
        pendingRewards,
        defaultPool
      );

      const newVotingPower = lockData.votingPower + expectedVotingPower;

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user1.address);

      await expect(stakingAlva.connect(user1).compoundRewards(isForever))
        .to.emit(stakingAlva, "Compounded")
        .withArgs(activeLockId, newAmount, pendingRewards, newVotingPower);

      //Contract balance should be same as initial
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial
      );

      //User balance should be same as initial
      const userAlvaBalancePost = await alva.balanceOf(user1.address);
      expect(userAlvaBalancePost).to.be.equal(userAlvaBalanceInitial);

      //User pending reward should be 0
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user1.address
      );
      expect(pendingRewardsPost).to.be.equal(0);
    });

    it("User can compoundRewards for forever pool and contract updates all contract states accordingly", async function () {
      const isForever = true;
      const activeLockId = await stakingAlva.accountToForeverId(user2.address);
      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const pendingRewards = await stakingAlva.getRewardsPending(user2.address);

      const newAmount = lockData.amount + pendingRewards;

      let expectedVotingPower = await stakingAlva.getveAlvaAmount(
        pendingRewards,
        defaultPool2
      );

      const newVotingPower = lockData.votingPower + expectedVotingPower;

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user2.address);

      await expect(stakingAlva.connect(user2).compoundRewards(isForever))
        .to.emit(stakingAlva, "Compounded")
        .withArgs(activeLockId, newAmount, pendingRewards, newVotingPower);

      //Reward Alva should be burnt from contract
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial - pendingRewards
      );

      //User balance should be same as initial
      const userAlvaBalancePost = await alva.balanceOf(user2.address);
      expect(userAlvaBalancePost).to.be.equal(userAlvaBalanceInitial);

      //User pending reward should be 0
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user2.address
      );
      expect(pendingRewardsPost).to.be.equal(0);
    });

    it("If user has both staking (Forever and Timebase) and want to compound timebase staking only, then contract should add to that specific lock", async function () {
      const isForever = false;
      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user4.address
      );
      const activeLockIdForever = await stakingAlva.accountToForeverId(
        user4.address
      );

      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const pendingRewardsInitial = await stakingAlva.getRewardsPending(
        user4.address
      );
      const rewardSpecificToTimebasePool = await stakingAlva.countRewards(
        activeLockId,
        batchSize
      );

      const timebaseReward = rewardSpecificToTimebasePool.pendingCurrent;

      const rewardSpecificToFroverPool = await stakingAlva.countRewards(
        activeLockIdForever,
        batchSize
      );

      const foreverReward = rewardSpecificToFroverPool.pendingCurrent;

      const newAmount = lockData.amount + timebaseReward + foreverReward;

      let expectedVotingPower = await stakingAlva.getveAlvaAmount(
        timebaseReward + foreverReward,
        defaultPool
      );

      const pendingRewars = timebaseReward + foreverReward;

      const newVotingPower = lockData.votingPower + expectedVotingPower;

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user4.address);

      await expect(stakingAlva.connect(user4).compoundRewards(isForever))
        .to.emit(stakingAlva, "Compounded")
        .withArgs(activeLockId, newAmount, pendingRewars, newVotingPower);

      //Contract balance should be same as initial
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial
      );

      //User balance should be same as initial
      const userAlvaBalancePost = await alva.balanceOf(user4.address);
      expect(userAlvaBalancePost).to.be.equal(userAlvaBalanceInitial);

      //User pending reward should be updated with deduction of all rewards
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user4.address
      );
      expect(pendingRewardsPost).to.be.equal(0);

      //User pendingTotal reward should be updated with deduction of time-based reward
      const rewardSpecificToTimebasePoolPost = await stakingAlva.countRewards(
        activeLockId,
        batchSize
      );
      expect(rewardSpecificToTimebasePoolPost.pendingCurrent).to.be.equal(0);
    });

    it("If user has both staking (Forever and Timebase) and want to compound forever staking only, then contract should add to that specific lock", async function () {
      const isForever = true;
      const activeLockId = await stakingAlva.accountToForeverId(user4.address);
      const activeLockIdTimebase = await stakingAlva.getActiveTimeBaseLock(
        user4.address
      );

      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const pendingRewardsInitial = await stakingAlva.getRewardsPending(
        user4.address
      );
      const rewardSpecificToForeverPool = await stakingAlva.countRewards(
        activeLockId,
        batchSize
      );

      const foreverReward = rewardSpecificToForeverPool.pendingCurrent;

      const rewardSpecificToTimebasePool = await stakingAlva.countRewards(
        activeLockIdTimebase,
        batchSize
      );

      const timebaseReward = rewardSpecificToTimebasePool.pendingCurrent;

      const newAmount = lockData.amount + foreverReward + timebaseReward;

      let expectedVotingPower = await stakingAlva.getveAlvaAmount(
        foreverReward + timebaseReward,
        defaultPool2
      );

      const newVotingPower = lockData.votingPower + expectedVotingPower;

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user4.address);

      const pendingRewars = timebaseReward + foreverReward;

      await expect(stakingAlva.connect(user4).compoundRewards(isForever))
        .to.emit(stakingAlva, "Compounded")
        .withArgs(activeLockId, newAmount, pendingRewars, newVotingPower);

      //Contract balance should be same as initial
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial - foreverReward - timebaseReward
      );

      //User balance should be same as initial
      const userAlvaBalancePost = await alva.balanceOf(user4.address);
      expect(userAlvaBalancePost).to.be.equal(userAlvaBalanceInitial);

      //User pending reward should be updated with deduction of all rewards
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user4.address
      );
      expect(pendingRewardsPost).to.be.equal(0);

      //User pendingTotal reward should be updated with deduction of time-based reward
      const rewardSpecificToTimebasePoolPost = await stakingAlva.countRewards(
        activeLockId,
        batchSize
      );
      expect(rewardSpecificToTimebasePoolPost.pendingCurrent).to.be.equal(0);
    });
  });

  describe("claimRewards", function () {
    const defaultPool = "THREE_MONTHS";
    const defaultPool2 = "FOREVER";
    const defaultAmount = "10";
    let initialVotingPower, initialVotingPower2;
    const tokens = ethers.parseEther("100");
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;

      await getAlvaTokens(user1.address, tokens);
      await getAlvaTokens(user2.address, tokens);

      await getAlvaTokens(user4.address, tokens);
      await getAlvaTokens(user4.address, tokens);

      initialVotingPower = await staking(defaultAmount, defaultPool, user1);
      initialVotingPower2 = await staking(defaultAmount, defaultPool2, user2);

      //User 4 with both staking timebase & forever
      await staking(defaultAmount, defaultPool, user4);
      await staking(defaultAmount, defaultPool2, user4);

      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(10000000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    const topUpRewards = async (amount) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, amount);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
        .to.emit(stakingAlva, "RewardsAdded")
        .withArgs(currentRewardId, amount);
    };

    it("User can't claim for Rewards if already staking not done", async function () {
      await topUpRewards(tokens);
      await expect(
        stakingAlva.connect(user3).claimRewards()
      ).to.be.rejectedWith("No rewards available for claiming");
    });

    it("User can't claim for Rewards if already rewards are not added", async function () {
      //      await topUpRewards(tokens);
      await expect(
        stakingAlva.connect(user1).claimRewards()
      ).to.be.rejectedWith("No rewards available for claiming");
    });

    it("User can claim Rewards for timebase pool and contract updates all contract states accordingly", async function () {
      await topUpRewards(tokens);
      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const pendingRewards = await stakingAlva.getRewardsPending(user1.address);

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user1.address);

      await expect(stakingAlva.connect(user1).claimRewards())
        .to.emit(stakingAlva, "RewardsClaimed")
        .withArgs(user1.address, pendingRewards);

      //Contract balance should be deducted with reward amount
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial - pendingRewards
      );

      //User balance should be updated with reward amount
      const userAlvaBalancePost = await alva.balanceOf(user1.address);
      expect(userAlvaBalancePost).to.be.equal(
        userAlvaBalanceInitial + pendingRewards
      );

      //User pending reward should be 0
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user1.address
      );
      expect(pendingRewardsPost).to.be.equal(0);
    });

    it("User can claim for forever pool and contract updates all contract states accordingly", async function () {
      await topUpRewards(tokens);

      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );

      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      const pendingRewards = await stakingAlva.getRewardsPending(user2.address);

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user2.address);

      await expect(stakingAlva.connect(user2).claimRewards())
        .to.emit(stakingAlva, "RewardsClaimed")
        .withArgs(user2.address, pendingRewards);

      //Contract balance should be deducted with reward amount
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial - pendingRewards
      );

      //User balance should be updated with reward amount
      const userAlvaBalancePost = await alva.balanceOf(user2.address);
      expect(userAlvaBalancePost).to.be.equal(
        userAlvaBalanceInitial + pendingRewards
      );

      //User pending reward should be 0
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user2.address
      );
      expect(pendingRewardsPost).to.be.equal(0);
    });

    it("If user has both staking (Forever and Timebase) and can claim reward for both pool", async function () {
      await topUpRewards(tokens);

      const activeLockIdTimebase = await stakingAlva.getActiveTimeBaseLock(
        user4.address
      );

      const activeLockIdForever = await stakingAlva.accountToForeverId(
        user4.address
      );

      const lockDataTimebase = await stakingAlva.lockIdToLockData(
        activeLockIdTimebase
      );
      const lockDataForever = await stakingAlva.lockIdToLockData(
        activeLockIdForever
      );

      const pendingRewardsInitial = await stakingAlva.getRewardsPending(
        user4.address
      );

      const rewardSpecificToTimebasePool = await stakingAlva.countRewards(
        activeLockIdTimebase,
        batchSize
      );
      const rewardSpecificToForever = await stakingAlva.countRewards(
        activeLockIdForever,
        batchSize
      );

      expect(pendingRewardsInitial).to.be.equal(
        rewardSpecificToTimebasePool.pendingCurrent +
          rewardSpecificToForever.pendingCurrent
      );

      const stakingContractAddress = await stakingAlva.getAddress();
      //Fetching Alva balance of Contract
      const initialAlvaBalanceOfContractInitial = await alva.balanceOf(
        stakingContractAddress
      );

      const userAlvaBalanceInitial = await alva.balanceOf(user4.address);

      await expect(stakingAlva.connect(user4).claimRewards())
        .to.emit(stakingAlva, "RewardsClaimed")
        .withArgs(user4.address, pendingRewardsInitial);

      //Contract balance should be deducted
      const initialAlvaBalanceOfContractPost = await alva.balanceOf(
        stakingContractAddress
      );
      expect(initialAlvaBalanceOfContractPost).to.be.equal(
        initialAlvaBalanceOfContractInitial - pendingRewardsInitial
      );

      //User balance should be updated
      const userAlvaBalancePost = await alva.balanceOf(user4.address);
      expect(userAlvaBalancePost).to.be.equal(
        userAlvaBalanceInitial + pendingRewardsInitial
      );

      //User pending reward should be updated with deduction of all rewards
      const pendingRewardsPost = await stakingAlva.getRewardsPending(
        user4.address
      );
      expect(pendingRewardsPost).to.be.equal(0);
    });
  });

  describe("Pause/Unpause", function () {
    const defaultPool = "THREE_MONTHS";
    const defaultPool2 = "FOREVER";
    const defaultAmount = "10";
    let initialVotingPower, initialVotingPower2;
    const tokens = ethers.parseEther("100");
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;
      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(100000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      //expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user, error) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      if (!error) {
        await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
          .to.emit(stakingAlva, "TokensStaked")
          .withArgs(
            +currentIdLock.toString() + 1,
            user.address,
            stakingAmount,
            pool,
            expextedVotingPower
          );
      } else {
        await expect(
          stakingAlva.connect(user).stake(stakingAmount, pool)
        ).to.rejectedWith(error);
      }

      return expextedVotingPower;
    };

    const topUpRewards = async (amount, error) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, amount);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      if (!error) {
        await expect(
          stakingAlva.connect(rewardAllocator).topUpRewards()
        ).to.emit(stakingAlva, "RewardsAdded");
        //.withArgs(currentRewardId, amount);
      } else {
        await expect(
          stakingAlva.connect(rewardAllocator).topUpRewards()
        ).to.rejectedWith(error);
      }
    };

    it("User can't stake if contract is paused", async function () {
      //User can stake before pause
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);

      //Pause Contract functionality
      await stakingAlva.pause();

      //Check staking
      const error = "Pausable: paused";
      await getAlvaTokens(user2.address, tokens);
      await staking(defaultAmount, defaultPool, user2, error);
      let user2StakingId = await stakingAlva.getActiveTimeBaseLock(
        user2.address
      );
      expect(user2StakingId).to.be.equal(0);

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check staking
      await staking(defaultAmount, defaultPool, user2);
      user2StakingId = await stakingAlva.getActiveTimeBaseLock(user2.address);
      expect(user2StakingId).to.be.greaterThan(0);
    });

    it("User can't increase if contract is paused", async function () {
      const defaultAmountInWei = ethers.parseEther(defaultAmount);
      const isForever = false;
      const stakingContractAddress = await stakingAlva.getAddress();

      //User can stake before pause
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);
      let lockData = await stakingAlva.lockIdToLockData(user1StakingId);

      expect(lockData.amount).to.be.equal(defaultAmountInWei);

      //Increase amount before pause
      await allowAlvaTokens(user1, stakingContractAddress, defaultAmountInWei);
      await stakingAlva
        .connect(user1)
        .increaseAmount(defaultAmountInWei, isForever);

      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.amount).to.be.equal(2n * defaultAmountInWei);

      //Pause Contract functionality
      await stakingAlva.pause();

      //Check Increase
      const error = "Pausable: paused";
      await allowAlvaTokens(user1, stakingContractAddress, defaultAmountInWei);
      await expect(
        stakingAlva.connect(user1).increaseAmount(defaultAmountInWei, isForever)
      ).to.rejectedWith(error);

      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.amount).to.be.equal(2n * defaultAmountInWei);

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check Increase
      await stakingAlva
        .connect(user1)
        .increaseAmount(defaultAmountInWei, isForever);

      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.amount).to.be.equal(3n * defaultAmountInWei);
    });

    it("User can't renew staking if contract is paused", async function () {
      const isForever = false;
      const stakingContractAddress = await stakingAlva.getAddress();
      const newPool1 = pools[5];
      const newPool2 = pools[6];

      //User can stake before pause
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);
      let lockData = await stakingAlva.lockIdToLockData(user1StakingId);

      expect(lockData.pool).to.be.equal(defaultPool);

      //Renew staking before pause
      await stakingAlva.connect(user1).renewStaking(0n, newPool1);

      user1StakingId = await stakingAlva.getActiveTimeBaseLock(user1.address);
      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.pool).to.be.equal(newPool1);

      //Pause Contract functionality
      await stakingAlva.pause();

      //Check Increase
      const error = "Pausable: paused";
      await expect(
        stakingAlva.connect(user1).renewStaking(0n, newPool2)
      ).to.rejectedWith(error);

      user1StakingId = await stakingAlva.getActiveTimeBaseLock(user1.address);
      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.pool).to.be.equal(newPool1);

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check Increase
      await stakingAlva.connect(user1).renewStaking(0n, newPool2);

      user1StakingId = await stakingAlva.getActiveTimeBaseLock(user1.address);
      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.pool).to.be.equal(newPool2);
    });

    it("User can't unstake if contract is paused", async function () {
      //User can stake before pause
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);
      let lockData = await stakingAlva.lockIdToLockData(user1StakingId);

      expect(lockData.pool).to.be.equal(defaultPool);

      //Unstake staking before pause
      await time.increase(duration[3] + 10);
      await stakingAlva.connect(user1).unstake();

      user1StakingId = await stakingAlva.getActiveTimeBaseLock(user1.address);
      expect(user1StakingId).to.be.equal(0);

      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      user1StakingId = await stakingAlva.getActiveTimeBaseLock(user1.address);
      expect(user1StakingId).to.be.greaterThan(0);

      //Pause Contract functionality
      await stakingAlva.pause();

      //Check Increase
      const error = "Pausable: paused";
      await expect(stakingAlva.connect(user1).unstake()).to.rejectedWith(error);

      const user1StakingIdAfterPause = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.equal(user1StakingIdAfterPause);

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check Increase
      await time.increase(duration[3] + 10);
      await stakingAlva.connect(user1).unstake();

      user1StakingId = await stakingAlva.getActiveTimeBaseLock(user1.address);
      expect(user1StakingId).to.be.equal(0);
    });

    it("User can't claim rewards if contract is paused", async function () {
      const defaultAmountInWei = ethers.parseEther(defaultAmount);

      //User can stake before pause
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);
      let lockData = await stakingAlva.lockIdToLockData(user1StakingId);

      expect(lockData.pool).to.be.equal(defaultPool);

      await topUpRewards(defaultAmountInWei);

      //Unstake staking before pause
      await stakingAlva.connect(user1).claimRewards();

      await topUpRewards(defaultAmountInWei);
      //Pause Contract functionality
      await stakingAlva.pause();

      //Check Increase
      const error = "Pausable: paused";
      await expect(stakingAlva.connect(user1).claimRewards()).to.rejectedWith(
        error
      );

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check Increase
      await stakingAlva.connect(user1).claimRewards();
    });

    it("User can't compund rewards if contract is paused", async function () {
      const defaultAmountInWei = ethers.parseEther(defaultAmount);
      const isForever = false;

      //User can stake before pause
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);
      let lockData = await stakingAlva.lockIdToLockData(user1StakingId);

      expect(lockData.pool).to.be.equal(defaultPool);

      await topUpRewards(defaultAmountInWei);

      //Unstake staking before pause
      await stakingAlva.connect(user1).compoundRewards(isForever);

      await topUpRewards(defaultAmountInWei);
      //Pause Contract functionality
      await stakingAlva.pause();

      //Check Increase
      const error = "Pausable: paused";
      await expect(
        stakingAlva.connect(user1).compoundRewards(isForever)
      ).to.rejectedWith(error);

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check Increase
      await stakingAlva.connect(user1).compoundRewards(isForever);
    });

    it("Admin can't topup rewards if contract is paused", async function () {
      const defaultAmountInWei = ethers.parseEther(defaultAmount);

      //User can stake before pause
      await topUpRewards(defaultAmountInWei);

      //Pause Contract functionality
      await stakingAlva.pause();

      //Check Increase
      const error = "Pausable: paused";
      await topUpRewards(defaultAmountInWei, error);

      //Unpause Contract functionality
      await stakingAlva.unpause();

      //Check Increase
      await topUpRewards(defaultAmountInWei);
    });
  });

  describe("Restricted functionalities", function () {
    const defaultPool = "THREE_MONTHS";
    const defaultPool2 = "FOREVER";
    const defaultAmount = "10";
    let initialVotingPower, initialVotingPower2;
    const tokens = ethers.parseEther("100");
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;
      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );
      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(100000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      const userInitialAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      //expect(userAfterAllowance).to.be.equals(userInitialAllowance + amount);
    };

    const staking = async (amount, pool, user, error) => {
      const stakingAmount = ethers.parseEther(amount);
      //Allow tokens
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      if (!error) {
        await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
          .to.emit(stakingAlva, "TokensStaked")
          .withArgs(
            +currentIdLock.toString() + 1,
            user.address,
            stakingAmount,
            pool,
            expextedVotingPower
          );
      } else {
        await expect(
          stakingAlva.connect(user).stake(stakingAmount, pool)
        ).to.rejectedWith(error);
      }

      return expextedVotingPower;
    };

    const topUpRewards = async (amount, error) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, amount);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      if (!error) {
        await expect(
          stakingAlva.connect(rewardAllocator).topUpRewards()
        ).to.emit(stakingAlva, "RewardsAdded");
        //.withArgs(currentRewardId, amount);
      } else {
        await expect(
          stakingAlva.connect(rewardAllocator).topUpRewards()
        ).to.rejectedWith(error);
      }
    };

    it("Only reward-allocator can toptup rewards", async function () {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      const amount = ethers.parseEther("10");

      await getAlvaTokens(user1.address, amount);
      await allowAlvaTokens(user1, stakingContractAddress, amount);

      await time.increase(minimumRewardTime);

      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();

      await expect(stakingAlva.connect(user1).topUpRewards()).to.rejectedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${REWARDS_ALLOCATOR_ROLE}`
      );

      await stakingAlva.grantRole(REWARDS_ALLOCATOR_ROLE, user1.address);

      await expect(stakingAlva.connect(user1).topUpRewards()).to.emit(
        stakingAlva,
        "RewardsAdded"
      );
      //.withArgs(currentRewardId, amount);
    });

    it("Only admin can update minimum reward amount", async function () {
      //Allow amount of alva tokens from owner to stakingContract
      const ADMIN_ROLE = await stakingAlva.ADMIN_ROLE();

      await expect(
        stakingAlva.connect(user1).updateMinimumRewardAmount(100n)
      ).to.rejectedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );

      await stakingAlva.grantRole(ADMIN_ROLE, user1.address);

      await expect(
        stakingAlva.connect(user1).updateMinimumRewardAmount(100n)
      ).not.to.be.rejectedWith();
    });

    it("Only admin can update pool status", async function () {
      //Allow amount of alva tokens from owner to stakingContract
      const ADMIN_ROLE = await stakingAlva.ADMIN_ROLE();

      await expect(
        stakingAlva.connect(user1).updatePoolStatus(defaultPool, false)
      ).to.rejectedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );

      await stakingAlva.grantRole(ADMIN_ROLE, user1.address);

      await expect(
        stakingAlva.connect(user1).updatePoolStatus(defaultPool, false)
      ).not.to.be.rejectedWith();
    });

    it("User can't stake if pool status is set to un-active", async function () {
      //User can stake before updating status
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);

      //Update status of pool
      await stakingAlva.updatePoolStatus(defaultPool, false);

      //Check staking
      const error = "The pool is not available for staking";
      await getAlvaTokens(user2.address, tokens);
      await staking(defaultAmount, defaultPool, user2, error);
      let user2StakingId = await stakingAlva.getActiveTimeBaseLock(
        user2.address
      );
      expect(user2StakingId).to.be.equal(0);

      //Active pool status
      await stakingAlva.updatePoolStatus(defaultPool, true);

      //Check staking
      await staking(defaultAmount, defaultPool, user2);
      user2StakingId = await stakingAlva.getActiveTimeBaseLock(user2.address);
      expect(user2StakingId).to.be.greaterThan(0);
    });

    it("User can't increase if pool status is set to un-active", async function () {
      const defaultAmountInWei = ethers.parseEther(defaultAmount);
      const isForever = false;
      const stakingContractAddress = await stakingAlva.getAddress();

      //User can stake before
      await getAlvaTokens(user1.address, tokens);
      await staking(defaultAmount, defaultPool, user1);
      let user1StakingId = await stakingAlva.getActiveTimeBaseLock(
        user1.address
      );
      expect(user1StakingId).to.be.greaterThan(0);
      let lockData = await stakingAlva.lockIdToLockData(user1StakingId);

      expect(lockData.amount).to.be.equal(defaultAmountInWei);

      //Increase amount before status update
      await allowAlvaTokens(user1, stakingContractAddress, defaultAmountInWei);
      await stakingAlva
        .connect(user1)
        .increaseAmount(defaultAmountInWei, isForever);

      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.amount).to.be.equal(2n * defaultAmountInWei);

      //Update pool status
      await stakingAlva.updatePoolStatus(defaultPool, false);

      //Check Increase
      const error = "Pool is currently disabled";
      await allowAlvaTokens(user1, stakingContractAddress, defaultAmountInWei);
      await expect(
        stakingAlva.connect(user1).increaseAmount(defaultAmountInWei, isForever)
      ).to.rejectedWith(error);

      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.amount).to.be.equal(2n * defaultAmountInWei);

      //Update pool status
      await stakingAlva.updatePoolStatus(defaultPool, true);

      //Check Increase
      await stakingAlva
        .connect(user1)
        .increaseAmount(defaultAmountInWei, isForever);

      lockData = await stakingAlva.lockIdToLockData(user1StakingId);
      expect(lockData.amount).to.be.equal(3n * defaultAmountInWei);
    });

    it("Only admin can update minimum staking amount", async function () {
      //Allow amount of alva tokens from owner to stakingContract
      const ADMIN_ROLE = await stakingAlva.ADMIN_ROLE();

      await expect(
        stakingAlva.connect(user1).updateMinStakingAmount(100n)
      ).to.rejectedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );

      await stakingAlva.grantRole(ADMIN_ROLE, user1.address);

      await expect(
        stakingAlva.connect(user1).updateMinStakingAmount(100n)
      ).not.to.be.rejectedWith();
    });

    it("Admin can't update minimum staking amount to 0", async function () {
      await expect(stakingAlva.updateMinStakingAmount(0n)).to.be.rejectedWith(
        "Minimum amount must be at least 1"
      );
    });

    it("Only admin can update withdrawal percentage", async function () {
      //Allow amount of alva tokens from owner to stakingContract
      const ADMIN_ROLE = await stakingAlva.ADMIN_ROLE();

      await expect(
        stakingAlva.connect(user1).updateWithdrawalPercentage(100n)
      ).to.rejectedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );

      await stakingAlva.grantRole(ADMIN_ROLE, user1.address);

      await expect(
        stakingAlva.connect(user1).updateWithdrawalPercentage(100n)
      ).not.to.be.rejectedWith();
    });

    it("Admin can't update withdrawal percentage to 0", async function () {
      await expect(
        stakingAlva.updateWithdrawalPercentage(0n)
      ).to.be.rejectedWith("Minimum amount must be at least 1");
    });

    it("Admin can't update withdrawal percentage to more then 100%", async function () {
      await expect(
        stakingAlva.updateWithdrawalPercentage(10000001n)
      ).to.be.rejectedWith("Invalid percentage value");
    });

    it("Only admin can update updateDecayInterval", async function () {
      //Allow amount of alva tokens from owner to stakingContract
      const ADMIN_ROLE = await stakingAlva.ADMIN_ROLE();

      await expect(
        stakingAlva.connect(user1).updateDecayInterval(100n)
      ).to.rejectedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${ADMIN_ROLE}`
      );

      await stakingAlva.grantRole(ADMIN_ROLE, user1.address);

      await expect(
        stakingAlva.connect(user1).updateDecayInterval(100n)
      ).not.to.be.rejectedWith();
    });

    it("Admin can't update updateDecayInterval to 0", async function () {
      await expect(stakingAlva.updateDecayInterval(0n)).to.be.rejectedWith(
        "Interval should be within the valid range"
      );
    });

    it("Admin can't update updateDecayInterval to more then 1 week", async function () {
      await expect(
        stakingAlva.updateDecayInterval(1 * 8 * 24 * 60 * 60)
      ).to.be.rejectedWith("Interval should be within the valid range");
    });

    it("Admin can't add new pool via updating status", async function () {
      const newPool = "Sham";

      await expect(
        stakingAlva.updatePoolStatus(newPool, true)
      ).to.be.rejectedWith("Pool does not exist");
    });
  });

  describe("Scenrio based testing", function () {
    let rewardAllocator;

    beforeEach(async function () {
      rewardAllocator = user5;

      const REWARDS_ALLOCATOR_ROLE = await stakingAlva.REWARDS_ALLOCATOR_ROLE();
      await stakingAlva.grantRole(
        REWARDS_ALLOCATOR_ROLE,
        rewardAllocator.address
      );

      //update reward percentage to 100%
      await stakingAlva.updateWithdrawalPercentage(10000000n);
    });

    const getAlvaTokens = async (userAddress, amount) => {
      const userInitialBalance = await alva.balanceOf(userAddress);
      await alva.transfer(userAddress, amount);

      const userAfterBalance = await alva.balanceOf(userAddress);

      expect(userAfterBalance).to.be.equals(userInitialBalance + amount);
    };

    const allowAlvaTokens = async (user, spenderAddress, amount) => {
      await alva.connect(user).approve(spenderAddress, amount);

      const userAfterAllowance = await alva.allowance(
        user.address,
        spenderAddress
      );

      expect(userAfterAllowance).to.be.equals(amount);
    };

    const staking = async (stakingAmount, pool, user) => {
      const stakingContractAddress = await stakingAlva.getAddress();
      await allowAlvaTokens(user, stakingContractAddress, stakingAmount);

      let currentIdLock = await stakingAlva.currentIdLock();
      let expextedVotingPower = await stakingAlva.getveAlvaAmount(
        stakingAmount,
        pool
      );

      await expect(stakingAlva.connect(user).stake(stakingAmount, pool))
        .to.emit(stakingAlva, "TokensStaked")
        .withArgs(
          +currentIdLock.toString() + 1,
          user.address,
          stakingAmount,
          pool,
          expextedVotingPower
        );

      return expextedVotingPower;
    };

    const topUpRewards = async (amount) => {
      //Allow amount of alva tokens from owner to stakingContract
      const stakingContractAddress = await stakingAlva.getAddress();
      await getAlvaTokens(rewardAllocator.address, amount);
      await allowAlvaTokens(rewardAllocator, stakingContractAddress, amount);

      const currentRewardId = await stakingAlva.currentIdRewards();

      await time.increase(minimumRewardTime);
      await expect(stakingAlva.connect(rewardAllocator).topUpRewards())
        .to.emit(stakingAlva, "RewardsAdded");
    };

    const unstaking = async (user) => {
      const activeLockId = await stakingAlva.getActiveTimeBaseLock(
        user.address
      );

      const lockData = await stakingAlva.lockIdToLockData(activeLockId);

      await expect(stakingAlva.connect(user).unstake())
        .to.emit(stakingAlva, "Withdrawn")
        .withArgs(user.address, activeLockId, lockData.endTime);

      //getActiveTimeBase should return 0
      const newActiveLockId = await stakingAlva.getActiveTimeBaseLock(
        user.address
      );
      expect(newActiveLockId).to.be.equal(0);

      //Lockdata should be updated
      const newLockData = await stakingAlva.lockIdToLockData(activeLockId);
      expect(newLockData.isActive).to.be.equal(false);
    };

    it("Check limitation for pending reward methods", async function () {
      // A specific amount used for staking
      const tokenAmount = ethers.parseEther("100");

      //Need a user who use staking
      const user = user1;

      //Get tokens and stake in forver pool
      const forverStakingPoolName = "FOREVER";
      const stakingContractAddress = await stakingAlva.getAddress();

      await getAlvaTokens(user1.address, tokenAmount);
      await staking(tokenAmount, forverStakingPoolName, user);

      //Now stake for timebase pool for given times
      const stakingIterations = 1; //number to perform staking iterations
      const timebasePool = "FORTYEIGHT_MONTHS"; //Pool in which staking would be taken;
      const durationForPool = 124416000;
      const currentTime = Date.now() / 1000;

      for (let i = 0; i < stakingIterations; i++) {
        //Get tokens & stake
        await getAlvaTokens(user1.address, tokenAmount);
        await staking(tokenAmount, timebasePool, user);

        //Need to distribute rewards
        const rewardDuration = 1 * 7 * 24 * 60 * 60; // 1 week
        const totalRewards = 1//durationForPool / rewardDuration;

        for (let j = 0; j < totalRewards; j++) {
          //Increase time for reward distribution
          await time.increase(rewardDuration);

          //topup rewards
          await topUpRewards(tokenAmount);

          const pendingRewards = await stakingAlva.getRewardsPending(user.address);
          console.log(`Week-${ (j + (i*totalRewards)).toFixed(0) }: `, (+ethers.formatEther(pendingRewards)).toFixed(4) )
        }

        //Unstake staing
        await unstaking(user);
      }
    });
  });
});
