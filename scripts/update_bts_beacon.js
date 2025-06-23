const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const btsBeacon = require("../artifacts/contracts/BeaconBTS.sol/BTSBeacon.json");

async function main() {
  
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  const btsBeconAddress = "0x57b668F1479F93c13bE47d7092e02e36C0E01713";

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const btsBeaconContract = new ethers.Contract(btsBeconAddress, btsBeacon.abi, signer);

  const btsNewImplementation = "0xFfE858aD5bDC9dd6142E30641E5D100fa4298f2E";
  const updateTrx = await btsBeaconContract.upgradeTo(btsNewImplementation);
  await updateTrx.wait(1);
  console.log("Trx updated : ", updateTrx.hash);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
