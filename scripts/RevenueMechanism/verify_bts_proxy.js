require("dotenv").config();
const { ethers, run, network } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
    const chainId = network.config.chainId;
    const rpc = network.config.url;

    // Get private key from environment variable
    const priKey = process.env.PRIVATE_KEY_SEPOLIA_NETWORK;
    if (!priKey) {
        throw new Error("No private key found in environment variables. Set PRIVATE_KEY_SEPOLIA_NETWORK");
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
    const signer = new ethers.Wallet(priKey, provider);
    console.log("Using account:", signer.address);

    // Contract addresses
    const PROXY_ADDRESS = "0xF3C379aa67c121a454bcC5f407c8DE385B254267";
    const BEACON_ADDRESS = "0x40D209886F13d129B6Db2183E24DC3138039CfA7";

    console.log("\nVerifying BTSPair proxy...");
    console.log("Proxy:", PROXY_ADDRESS);
    console.log("Beacon:", BEACON_ADDRESS);

    try {
        // Get the interface for BTSPair
        const BTSPair = await ethers.getContractFactory("BasketTokenStandardPair");
        
        // Create initialization data (empty since it's initialized after deployment)
        const initData = BTSPair.interface.encodeFunctionData("initialize", [
            ethers.ZeroAddress, // factory
            "", // name
            [] // tokens
        ]);

        // Verify the proxy contract
        await run("verify:verify", {
            address: PROXY_ADDRESS,
            contract: "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol:BeaconProxy",
            constructorArguments: [
                BEACON_ADDRESS,
                initData
            ],
        });

        console.log("\nVerification successful!");
        console.log("You can view the contract at:");
        console.log(`https://sepolia.etherscan.io/address/${PROXY_ADDRESS}#code`);
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("\nContract is already verified!");
            console.log("You can view the contract at:");
            console.log(`https://sepolia.etherscan.io/address/${PROXY_ADDRESS}#code`);
        } else {
            console.error("\nVerification failed:", error);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
