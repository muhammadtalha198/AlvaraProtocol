const fse = require("fs-extra");
const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
  const alvaABIFilePath =
    "artifacts/contracts/tokens/AlvaraAvax.sol/AlvaraAvax.json";

  const alvaABI = fse.readJSONSync(alvaABIFilePath).abi;
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;
  const alvaAddress = networkConfig[chainId].alvaAddress;

  const minter = networkConfig[chainId].deployerAddress;
  const burner = networkConfig[chainId].deployerAddress;
  const admin = networkConfig[chainId].deployerAddress;
  const owner = networkConfig[chainId].deployerAddress;

  //revokeRole

  if (
    alvaABI &&
    priKey &&
    alvaAddress &&
    minter != null &&
    burner != null &&
    admin != null &&
    owner != null
  ) {
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
    const signer = new ethers.Wallet(priKey, provider);

    const alvaContract = new ethers.Contract(alvaAddress, alvaABI, signer);

    /**
     * Transfer Minter Access
     */
    let isAlreadyMinter = await alvaContract.hasRole(
      alvaContract.MINTER_ROLE(),
      minter
    );

    if (isAlreadyMinter) {
      let trx = await alvaContract.revokeRole(
        alvaContract.MINTER_ROLE(),
        minter
      );
      await trx.wait(1);
      console.log("minter revoked : ", trx.hash);
    }

    /**
     * Transfer Burner Access
     */
    let isAlreadyBurner = await alvaContract.hasRole(
      alvaContract.BURN_ROLE(),
      burner
    );

    if (isAlreadyBurner) {
      let trx = await alvaContract.revokeRole(alvaContract.BURN_ROLE(), burner);
      await trx.wait(1);
      console.log("burner revoked : ", trx.hash);
    }

    /**
     * Transfer Admin Access
     */
    let isAlreadyAdmin = await alvaContract.hasRole(
      alvaContract.DEFAULT_ADMIN_ROLE(),
      admin
    );

    if (isAlreadyAdmin) {
      let trx = await alvaContract.revokeRole(
        alvaContract.DEFAULT_ADMIN_ROLE(),
        admin
      );
      await trx.wait(1);
      console.log("admin revoked : ", trx.hash);
    }
  } else {
    console.log("Not setup properly .......................... !!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
