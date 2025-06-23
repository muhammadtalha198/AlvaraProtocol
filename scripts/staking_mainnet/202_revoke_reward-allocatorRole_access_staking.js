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

  const rewardAlocatorAddress = "0x"; //New rewward allocator address

  if (
    stakingAlvaABI &&
    priKey &&
    stakingContractAddress && stakingContractAddress != "0x" &&
    rewardAlocatorAddress && rewardAlocatorAddress != "0x"
  ) {
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
    const signer = new ethers.Wallet(priKey, provider);

    const stakingAlvaContract = new ethers.Contract(stakingContractAddress, stakingAlvaABI, signer);

    /**
     * Transfer Admin Access
     */
    let isAlreadyRoleHolder = await stakingAlvaContract.hasRole(
      stakingAlvaContract.REWARDS_ALLOCATOR_ROLE(),
      rewardAlocatorAddress
    );

    if (isAlreadyRoleHolder) {
      let trx = await stakingAlvaContract.revokeRole(
        stakingAlvaContract.REWARDS_ALLOCATOR_ROLE(),
        rewardAlocatorAddress
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
