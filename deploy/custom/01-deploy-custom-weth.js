const { network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat.config");
const { verify } = require("../../utils/verify");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;

  let wethAddress;

  const weth = await deploy("WETH", {
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

  wethAddress = weth.address;
  log(`WETH deployed at ${wethAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(wethAddress, []);
  }
};

module.exports.tags = ["all-eth","custom", "weth", "mock", "all-custom-test", "tokens"];
