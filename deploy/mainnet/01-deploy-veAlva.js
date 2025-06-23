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

  const veALVA = await deploy("veALVA", {
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

  let veAlvaAddress = veALVA.address;
  log(`veAlva deployed at ${veAlvaAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(veAlvaAddress, []);
  }
};

module.exports.tags = ["veAlva-mainnet"];
