const { network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat.config");
const { verify } = require("../utils/verify");
const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;
  let monthlyFee = "833333333333333";

  // Local Router Configuration
  const ROUTER = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1"; // Local-Test: BTS_Pair Router
  const WETH = "0x0B306BF915C4d645ff596e518fAf3F9669b97016"; // Local-Test: BTS_Pair WETH

  // Get deployed contract addresses
  const alvaAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; //(await deployments.get("Alvara")).address;
  const btsBeaconAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"; //(await deployments.get("BeaconLayer")).address;
  const btsPairBeaconAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F"; //(await deployments.get("BeaconLayer")).address;
  const feeCollector = "0x3849A0EFcf066F069d638b5Ea9FF645780ef33BF"; // Wallet address to collect ALVARA Platform Fee

  log("----------------------------------------------------");
  log("Deploying Factory with Local Router");
  log("----------------------------------------------------");

  const factory = await deploy("Factory", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
    proxy: {
      proxyContract: "OpenZeppelinTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [
            alvaAddress, // _alva
            500, // _minPercentALVA (5%)
            btsBeaconAddress, // _btsImplementation
            btsPairBeaconAddress, // _btsPairImplementation
            monthlyFee, // _monthlyFee
            deployer, // _royaltyReceiver
            "ipfs://QmYmQh2LiXgEp7ioTCYz3xUQcm8vEeMEPfer6jDfFH5pdX", // _collectionUri
            feeCollector,
            "0xA094E566b61b3c2D88ACf7Cc15e3Dd0FA83F32af", // defaultMarketplace
            ROUTER,                     // _routerAddress
            WETH,                       // _wethAddress
            ethers.parseEther("0.01"),  // _minBTSCreationAmount (default 0.01 ETH)
          ],
        },
      },
    },
  });

  log(`Factory deployed at ${factory.address}`);

  // Verify the implementation contract - only for non-development chains
  if (!developmentChains.includes(networkConfig[chainId].name)) {
    log("Verifying...");
    await verify(factory.implementation, []);
  }
};

module.exports.tags = ["all-eth", "factory-local"];
