const { network, ethers } = require("hardhat");
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

  const deployContract = async (wethAddress) => {
    const router = await deploy("UniswapV2Router02", {
      from: deployer,
      args: [wethAddress],
      waitConfirmations: 1,
    });

    const routerAddress = await router.address;
    log(`Uniswap Router deployed at ${routerAddress}`);

    return routerAddress;
  };

  if (developmentChains.includes(networkConfig[chainId].name)) {
    wethAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016" //wethContract.address;
    await deployContract(wethAddress);
  } else {
    wethAddress = networkConfig[chainId]["wthAddress"];
    const routerAddress = await deployContract(wethAddress);
    await verify(routerAddress, []);
  }
};

module.exports.tags = ["all-eth","custom", "router", "mock", "all-custom-test"];
