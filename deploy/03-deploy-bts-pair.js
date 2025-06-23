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

  const btsPair = await deploy("BasketTokenStandardPair", {
    from: deployer,
    args: [],
    waitConfirmations: 1,
  });

  let btsPairAddress = btsPair.address;
  log(`BTS Pair deployed at ${btsPairAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(btsPairAddress, []);
  }
};

module.exports.tags = ["all-eth", "bts-pair", "all-custom-test", "bts-pair-implementation"];