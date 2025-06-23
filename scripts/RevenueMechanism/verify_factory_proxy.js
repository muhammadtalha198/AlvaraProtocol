const { ethers, run, network } = require("hardhat");

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Contract addresses
    const FACTORY_PROXY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";
    const FACTORY_IMPLEMENTATION_ADDRESS = "0xF9B87260a11e25ADc99BFE3997185C85a333580B";
    
    console.log("\nFactory Contract Information:");
    console.log("----------------------------");
    console.log("Factory Proxy Address:", FACTORY_PROXY_ADDRESS);
    console.log("Factory Implementation Address:", FACTORY_IMPLEMENTATION_ADDRESS);
    
    // Get the Factory contract instance
    try {
        const factory = await ethers.getContractAt("Factory", FACTORY_PROXY_ADDRESS, signer);
        
        // Get some data from the Factory contract to verify it's working
        const alvaAddress = await factory.alva();
        const minPercentALVA = await factory.minPercentALVA();
        
        console.log("\nFactory Contract Data:");
        console.log("ALVA Address:", alvaAddress);
        console.log("Min Percent ALVA:", minPercentALVA.toString());
        console.log("✅ Factory contract is accessible and working!");
    } catch (error) {
        console.error("Error accessing Factory contract:", error);
    }
    
    // Verify the Factory proxy contract
    try {
        console.log("\nVerifying Factory Proxy Contract...");
        await run("verify:verify", {
            address: FACTORY_PROXY_ADDRESS,
            constructorArguments: [],
        });
        console.log("Factory Proxy verification successful!");
    } catch (error) {
        if (error.message.includes("already verified")) {
            console.log("Factory Proxy is already verified!");
        } else {
            console.error("Error verifying Factory Proxy:", error);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
