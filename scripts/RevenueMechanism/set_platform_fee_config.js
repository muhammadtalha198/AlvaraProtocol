const { ethers } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Factory contract address on Sepolia
    const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";

    // Get Factory contract instance
    const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS, signer);

    // New fee configuration (using basis points, 100 = 1%)
    const newConfig = {
        btsCreationFee: 60,    // 0.6%
        contributionFee: 60,   // 0.6%
        withdrawalFee: 60      // 0.6%
    };

    console.log("\nCurrent configuration:");
    const currentConfig = await factory.getPlatformFeeConfig();
    console.log("BTS Creation Fee:", currentConfig.btsCreationFee.toString());
    console.log("Contribution Fee:", currentConfig.contributionFee.toString());
    console.log("Withdrawal Fee:", currentConfig.withdrawalFee.toString());
    console.log("Fee Collector:", currentConfig.feeCollector);

    console.log("\nSetting new platform fee configuration...");
    const tx = await factory.setPlatformFeeConfig(
        newConfig.btsCreationFee,
        newConfig.contributionFee,
        newConfig.withdrawalFee
    );

    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    await tx.wait();

    console.log("\nNew configuration set!");
    const updatedConfig = await factory.getPlatformFeeConfig();
    console.log("BTS Creation Fee:", updatedConfig.btsCreationFee.toString());
    console.log("Contribution Fee:", updatedConfig.contributionFee.toString());
    console.log("Withdrawal Fee:", updatedConfig.withdrawalFee.toString());
    console.log("Fee Collector:", updatedConfig.feeCollector);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
