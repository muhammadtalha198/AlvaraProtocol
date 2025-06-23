const { network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat.config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments, upgrades }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;

  var alvaAddress, veAlvaAddress;

  /** Need to make it dynamic according to chain-id*/
  if (!developmentChains.includes(networkConfig[chainId].name)) {
    alvaAddress = "0x0fc4580f70C517B148a141f3721C5138f74401b1";
    veAlvaAddress = "0xDA5B1441350dba448f812BD7394736f1bf301275";
  } else {
    const avlaContract = await deployments.get("Alvara");
    alvaAddress = avlaContract.address;

    const veAlvaContract = await deployments.get("veALVA");
    veAlvaAddress = veAlvaContract.address;
  }

  const decayInterval = 1 * 24 * 60 * 60; //(1 day in seconds) // for testing 40

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
  ]; // forever always at first index

  const rewards = [
    5000000, 0, 0, 50000, 125000, 275000, 450000, 850000, 1250000, 2000000,
  ]; // sequence same as pools

  const veTokenRatio = [
    200000000, 1000000, 5000000, 20000000, 50000000, 100000000, 200000000,
    400000000, 800000000, 1000000000,
  ]; // sequence same as pools

  const duration = [
    0, 604800, 2592000, 7776000, 15552000, 31104000, 46656000, 62208000,
    93312000, 124416000,
  ];
  // for testing [0, 200, 300, 800, 1000, 1200, 1400, 1600, 1800, 2000,]
  // sequence same as pools

  const startTime = Math.trunc(Date.now() / 1000); // Start time depend on client date/time

  const rewardPeriords = [0, 1, 4, 12, 25, 51, 77, 102, 154, 205]; //

  const staking = await deploy("AlvaStaking", {
    from: deployer,
    waitConfirmations: 1,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [
            alvaAddress,
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
  });

  let stakingAddress = staking.address;
  log(`Staking01 deployed at ${stakingAddress}`);

  //Adds staking as admin in veALva
  const veAlvaContract = await hre.ethers.getContractAt(
    "veALVA",
    veAlvaAddress
  );

  await veAlvaContract.grantRole(
    "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775",
    stakingAddress
  );

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(stakingAddress, [
      alvaAddress,
      veAlvaAddress,
      decayInterval,
      startTime,
      pools,
      rewards,
      veTokenRatio,
      duration,
      rewardPeriords,
    ]);
  }
};

module.exports.tags = ["all-eth", "staking01", "staking-module"];
