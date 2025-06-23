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

  const minter = networkConfig[chainId].minter;
  const burner = networkConfig[chainId].burner;
  const admin = networkConfig[chainId].owner;
  const owner = networkConfig[chainId].owner;

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

    if (!isAlreadyMinter) {
      let trx = await alvaContract.grantRole(
        alvaContract.MINTER_ROLE(),
        minter
      );
      await trx.wait(1);
      console.log("minter updated : ", trx.hash);
    }

    /**
     * Transfer Burner Access
     */
    let isAlreadyBurner = await alvaContract.hasRole(
      alvaContract.BURN_ROLE(),
      burner
    );

    if (!isAlreadyBurner) {
      let trx = await alvaContract.grantRole(alvaContract.BURN_ROLE(), burner);
      await trx.wait(1);
      console.log("burner updated : ", trx.hash);
    }

    /**
     * Transfer Admin Access
     */
    let isAlreadyAdmin = await alvaContract.hasRole(
      alvaContract.DEFAULT_ADMIN_ROLE(),
      admin
    );

    if (!isAlreadyAdmin) {
      let trx = await alvaContract.grantRole(
        alvaContract.DEFAULT_ADMIN_ROLE(),
        admin
      );
      await trx.wait(1);
      console.log("admin updated : ", trx.hash);
    }

    /**
     * Transfer Owner Access
     */
    let existingOwner = await alvaContract.owner();

    if (existingOwner != owner) {
      let trx = await alvaContract.transferOwnership(owner);
      await trx.wait(1);
      console.log("Owner updated : ", trx.hash);
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
