const fse = require("fs-extra");
const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const abi = require("./ProxyAdmin.json");

async function main() {
//   const alvaABIFilePath = "";
    const alvaABI = abi;//fse.readJSONSync(alvaABIFilePath).abi;

  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const alvaAddress = "0x1dBBd73cbaF36E6295A78a282530F11121315a04"; //Proxy Admin
  const alvaContract = new ethers.Contract(alvaAddress, alvaABI, signer);

  const alvaImplementationAddress =
    "0xFc56Fb893A156a386fa3Ab319747C1120A6bF7bE"; //New implementation

  //upgradeTo

  let upgradeTrx = await alvaContract.upgradeTo(alvaImplementationAddress);
  console.log("Upgrade Trx : ", upgradeTrx.hash);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

