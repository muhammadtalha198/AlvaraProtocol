const { network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat.config");
const { verify } = require("../../utils/verify");

module.exports = async ({ getNamedAccounts, deployments, upgrades }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;

  let alvaAddress = "0x8e729198d1C59B82bd6bBa579310C40d740A11C2"; //mainnet alva address (0x8e729198d1C59B82bd6bBa579310C40d740A11C2)
  let veAlvaAddress = "0x07157d55112A6bAdd62099B8ad0BBDfBC81075BD"; //mainnet veAlva adress asdfj

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

  const startTime = 1736744400;//Monday 5am UTC, Date, 13 Jan 2025 //Math.trunc(Date.now() / 1000); // Start time depend on client date/time

  const rewardPeriords = [0, 1, 4, 12, 25, 51, 77, 102, 154, 205]; //

  if (
    veAlvaAddress != "0x" &&
    //alvaAddress == "0x8e729198d1C59B82bd6bBa579310C40d740A11C2" &&
    startTime != 0
  ) {
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
    log(`StakingAlva deployed at ${stakingAddress}`);

    if (!developmentChains.includes(networkConfig[chainId].name)) {
      await verify(stakingAddress, []);
    }
  }
};

module.exports.tags = ["staking-alva-mainnet"];
