const { network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat.config");
const { verify } = require("../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;

  const bts = await deploy("BasketTokenStandard", {
    from: deployer,
    args: [],
    waitConfirmations: 1,
  });

  let btsAddress = bts.address;
  log(`BTS deployed at ${btsAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(btsAddress, []);
  }
};

module.exports.tags = ["all-eth", "bts", "all-custom-test", "bts-implementation"];
