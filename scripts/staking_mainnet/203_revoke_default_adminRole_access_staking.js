const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
  const stakingContractABIFilePath =
    "artifacts/contracts/AlvaStakeProtocol.sol/AlvaStakeProtocol.json";

  const stakingAlvaABI = fse.readJSONSync(stakingContractABIFilePath).abi;
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;
  const stakingContractAddress = "0x" //stakingAlva address

  const newAdminAddress = "0x"; //New admin address

  if (
    stakingAlvaABI &&
    priKey &&
    stakingContractAddress && stakingContractAddress != "0x" &&
    newAdminAddress && newAdminAddress != "0x"
  ) {
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
    const signer = new ethers.Wallet(priKey, provider);

    const stakingAlvaContract = new ethers.Contract(stakingContractAddress, stakingAlvaABI, signer);

    /**
     * Transfer Admin Access
     */
    let isAlreadyRoleHolder = await stakingAlvaContract.hasRole(
      stakingAlvaContract.DEFAULT_ADMIN_ROLE(),
      newAdminAddress
    );

    if (isAlreadyRoleHolder) {
      let trx = await stakingAlvaContract.revokeRole(
        stakingAlvaContract.DEFAULT_ADMIN_ROLE(),
        newAdminAddress
      );
      await trx.wait(1);
      console.log("role revoked : ", trx.hash);
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
