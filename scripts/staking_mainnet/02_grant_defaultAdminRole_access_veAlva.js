const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
  const veALvaABIFilePath =
    "artifacts/contracts/tokens/veAlva.sol/veAlva.json";

  const veAlvaABI = fse.readJSONSync(veALvaABIFilePath).abi;
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;
  const veAlvaAddress = "0x" //veAlva;

  const adminAddress = "0x" //adminAddress address

  if (
    veAlvaABI &&
    priKey &&
    veAlvaAddress && veAlvaAddress != "0x" &&
    adminAddress && adminAddress != "0x"
  ) {
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
    const signer = new ethers.Wallet(priKey, provider);

    const veAlvaContract = new ethers.Contract(veAlvaAddress, veAlvaABI, signer);

    /**
     * Transfer Admin Access
     */
    let isAlreadyRoleHolder = await veAlvaContract.hasRole(
      veAlvaContract.DEFAULT_ADMIN_ROLE(),
      adminAddress
    );

    if (!isAlreadyRoleHolder) {
      let trx = await veAlvaContract.grantRole(
        veAlvaContract.DEFAULT_ADMIN_ROLE(),
        adminAddress
      );
      await trx.wait(1);
      console.log("role added : ", trx.hash);
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
