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

  let btsPairAddress;  

  if (developmentChains.includes(networkConfig[chainId].name)) { 
    btsPairAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"//(await deployments.get("BasketTokenStandard")).address; 
  } else {
    btsPairAddress = (await deployments.get("BasketTokenStandardPair")).address; //0xb9B344BA54A8dc4307D1461c79DfE157238B3f7A 
  }
 

  const btsPairBeacon = await deploy("BTSPairBeacon", {
    from: deployer,
    waitConfirmations: 1,
    args: [btsPairAddress],
  });

  let btsPairBeaconAddress = btsPairBeacon.address;
  log(`BTS-Pair Beacon deployed at ${btsPairBeaconAddress}`);

  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(btsPairBeaconAddress, [btsPairAddress], "contracts/tokens/BTSPairBeacon.sol:BTSPairBeacon");
  }
};

module.exports.tags = ["all-eth", "btspair-beacon", "all-custom-test"];
