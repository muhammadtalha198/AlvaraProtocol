const { ethers } = require("hardhat");

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Constants
    const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";
    const NEW_FEE_COLLECTOR = "0xF34BF8485cbB3686aE636dD1E35D4050044bcdbb";

    // Get Factory contract instance
    const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS, signer);

    // Get current fee configuration
    console.log("\nFetching current platform fee configuration...");
    const currentFeeConfig = await factory.getPlatformFeeConfig();
    
    console.log("\nCurrent Platform Fee Configuration:");
    console.log("---------------------------------");
    console.log(`BTS Creation Fee: ${Number(currentFeeConfig.btsCreationFee) / 100}%`);
    console.log(`Contribution Fee: ${Number(currentFeeConfig.contributionFee) / 100}%`);
    console.log(`Withdrawal Fee: ${Number(currentFeeConfig.withdrawalFee) / 100}%`);
    console.log(`Current Fee Collector: ${currentFeeConfig.feeCollector}`);

    // Update fee collector
    console.log("\nUpdating fee collector address...");
    console.log(`New Fee Collector: ${NEW_FEE_COLLECTOR}`);
    
    try {
        const tx = await factory.setFeeCollector(NEW_FEE_COLLECTOR);
        console.log(`Transaction hash: ${tx.hash}`);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Check for FeeCollectorUpdated event
        const feeCollectorUpdatedEvent = receipt.logs
            .filter(log => {
                try {
                    const parsedLog = factory.interface.parseLog(log);
                    return parsedLog && parsedLog.name === "FeeCollectorUpdated";
                } catch {
                    return false;
                }
            })
            .map(log => factory.interface.parseLog(log))[0];
        
        if (feeCollectorUpdatedEvent) {
            console.log("\nFeeCollectorUpdated Event Found:");
            console.log(`New Fee Collector: ${feeCollectorUpdatedEvent.args[0]}`);
        }
        
        // Get updated fee configuration
        console.log("\nFetching updated platform fee configuration...");
        const updatedFeeConfig = await factory.getPlatformFeeConfig();
        
        console.log("\nUpdated Fee Collector:");
        console.log("----------------------------------");
        console.log(`New Fee Collector: ${updatedFeeConfig.feeCollector}`);
        
        // Verify the update was successful
        if (updatedFeeConfig.feeCollector.toLowerCase() === NEW_FEE_COLLECTOR.toLowerCase()) {
            console.log("\n✅ Fee collector address successfully updated!");
        } else {
            console.log("\n❌ Fee collector address update failed!");
        }
        
    } catch (error) {
        console.error("\nError updating fee collector:", error.message);
        
        if (error.message.includes("InvalidAddress")) {
            console.error("The fee collector address is invalid or the same as the current one.");
        }
        
        if (error.message.includes("Ownable: caller is not the owner")) {
            console.error("Only the contract owner can update the fee collector address.");
        }
        
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
