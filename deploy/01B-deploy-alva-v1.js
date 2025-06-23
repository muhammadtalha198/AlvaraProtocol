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

  const alvara = await deploy("AlvaraV1", {
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

  let avlaAddress = alvara.address;
  log(`Alvara deployed at ${avlaAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(avlaAddress, []);
  }
};

module.exports.tags = [
  "alva-v1",
];
