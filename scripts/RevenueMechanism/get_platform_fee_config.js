const { ethers } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
    const chainId = network.config.chainId;
    const priKey = networkConfig[chainId].deployerKey;
    const rpc = network.config.url;

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
    const signer = new ethers.Wallet(priKey, provider);
    console.log("Using account:", signer.address);

    // Factory contract address on Sepolia
    const FACTORY_ADDRESS = "0x06c991282341e69fa6a66fF56a33bdE98d379F2D";

    // Get Factory contract instance
    const Factory = await ethers.getContractFactory("Factory");
    const factory = Factory.attach(FACTORY_ADDRESS).connect(signer);

    console.log("\nFetching platform fee configuration...");
    const feeConfig = await factory.getPlatformFeeConfig();
    
    console.log("\nPlatform Fee Configuration:");
    console.log("--------------------------");
    console.log(`BTS Creation Fee: ${Number(feeConfig.btsCreationFee) / 100}%`);
    console.log(`Contribution Fee: ${Number(feeConfig.contributionFee) / 100}%`);
    console.log(`Withdrawal Fee: ${Number(feeConfig.withdrawalFee) / 100}%`);
    console.log(`Fee Collector: ${feeConfig.feeCollector}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
