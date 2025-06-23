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

  // Uniswap Router Configuration
  const ROUTER = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; // Testnet - Uniswap v2 Router
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Testnet - Uniswap WETH

  // Get deployed contract addresses
  const alvaAddress = "0x0fc4580f70C517B148a141f3721C5138f74401b1"; //(await deployments.get("Alvara")).address;
  const btsBeaconAddress = "0x1E5d8259b0fCAf2ec615369f3F8a8D4cb38a8124"; //(await deployments.get("BeaconLayer")).address;
  const btsPairBeaconAddress = "0xBcD9461D2e679b9C64C0871665C2ca4Acbf270EF"; //(await deployments.get("BTSPairBeacon")).address;
  const feeCollector = "0x3849A0EFcf066F069d638b5Ea9FF645780ef33BF"; // Wallet address to collect ALVARA Platform Fee

  log("----------------------------------------------------");
  log("Deploying Factory with Uniswap Router");
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

  // Verify the implementation contract
  if (!developmentChains.includes(networkConfig[chainId].name)) {
    log("Verifying...");
    await verify(factory.implementation, []);
  }
};

module.exports.tags = ["factory-uniswap"];
