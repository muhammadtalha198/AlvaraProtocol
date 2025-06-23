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

  const alvaraAvax = await deploy("AlvaraAvax", {
    from: deployer,
    args: [],
    waitConfirmations: 1,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [],
          owner: deployer,
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  });

  let avlaAvaxAddress = alvaraAvax.address;
  log(`AlvaraAvax deployed at ${avlaAvaxAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(avlaAvaxAddress, []);
  }
};

module.exports.tags = ["all-alva", "alva-avax", "tokens", "all-avalanche"];
