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

  let btsAddress;
  
  if (developmentChains.includes(networkConfig[chainId].name)) { 
    btsAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"//(await deployments.get("BasketTokenStandard")).address; 
  } else {
    btsAddress = (await deployments.get("BasketTokenStandard")).address; //0x8A71Ccf8568116a8535A894C96182574eFa20a5D 
  }
 
  const btsBeaconProxy = await deploy("BTSBeacon", {
    from: deployer,
    waitConfirmations: 1,
    args: [btsAddress],
  });

  let btsBeaconAddress = btsBeaconProxy.address;
  log(`BeaconBTS deployed at ${btsBeaconAddress}`);


  if (!developmentChains.includes(networkConfig[chainId].name)) {
    await verify(btsBeaconAddress, [btsAddress], "contracts/BTSBeacon.sol:BTSBeacon");
  }
};

module.exports.tags = ["all-eth", "bts-beacon", "all-custom-test"];
