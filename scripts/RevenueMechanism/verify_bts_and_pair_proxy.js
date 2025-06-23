const { ethers, run, network } = require("hardhat");

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Contract addresses
    const BTS_PROXY_ADDRESS = "0xaa11418588A283Ee3E17e6E5ece87F81f88ad96F";
    const BTS_PAIR_ADDRESS = "0x0E067D8161E95eaFcb67B337f094f86601B1f1B3";
    
    console.log("\nBTS Contract Information:");
    console.log("-------------------------");
    console.log("BTS Proxy Address:", BTS_PROXY_ADDRESS);
    console.log("BTS Pair Address:", BTS_PAIR_ADDRESS);
    
    // Get the BTS contract instance
    try {
        const bts = await ethers.getContractAt("BasketTokenStandard", BTS_PROXY_ADDRESS, signer);
        
        // Get some data from the BTS contract to verify it's working
        const name = await bts.name();
        const symbol = await bts.symbol();
        const btsPair = await bts.btsPair();
        
        console.log("\nBTS Contract Data:");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("BTS Pair Address:", btsPair);
        console.log("✅ BTS contract is accessible and working!");
    } catch (error) {
        console.error("Error accessing BTS contract:", error);
    }
    
    // Verify the BTS proxy contract
    try {
        console.log("\nVerifying BTS Proxy Contract...");
        await run("verify:verify", {
            address: BTS_PROXY_ADDRESS,
            constructorArguments: [],
        });
        console.log("BTS Proxy verification successful!");
    } catch (error) {
        if (error.message.includes("already verified")) {
            console.log("BTS Proxy is already verified!");
        } else {
            console.error("Error verifying BTS Proxy:", error);
        }
    }
    
    // Verify the BTS Pair contract
    try {
        console.log("\nVerifying BTS Pair Contract...");
        await run("verify:verify", {
            address: BTS_PAIR_ADDRESS,
            constructorArguments: [],
        });
        console.log("BTS Pair verification successful!");
    } catch (error) {
        if (error.message.includes("already verified")) {
            console.log("BTS Pair is already verified!");
        } else {
            console.error("Error verifying BTS Pair:", error);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
