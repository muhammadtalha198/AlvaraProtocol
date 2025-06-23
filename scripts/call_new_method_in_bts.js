const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const bts = require("../artifacts/contracts/BTS.sol/BasketTokenStandard.json");
const btsPair = require("../artifacts/contracts/tokens/BTSPair.sol/BasketTokenStandardPair.json");

async function main() {
  
  const btsABI = bts.abi;
  const btsPairABI = btsPair.abi;

  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  const btsAddress = "0x2a3F2f6E98656c0A633f9CD0f57f567c6E177081";

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const btsContract = new ethers.Contract(btsAddress, btsABI, signer);

  let newMethodOutput = await btsContract.myNewMethod();

  console.log("newMethodOutput (BTS) : ", newMethodOutput)


  const btsPairAddress = "0x6B47cC9307f53bD2A2AA5896164B7fE845832742";

 
  const btsPairContract = new ethers.Contract(btsPairAddress, btsPairABI, signer);

  let newMethodOutputPair = await btsPairContract.myNewMethod();

  console.log("newMethodOutput (BTS-Pair): ", newMethodOutputPair)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
