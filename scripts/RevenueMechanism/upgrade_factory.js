require("dotenv").config();
const { ethers, upgrades, network } = require("hardhat");
const { verify } = require("../../utils/verify");
const { developmentChains, networkConfig } = require("../../helper-hardhat.config");

async function main() {
    const chainId = network.config.chainId;
    
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Using account:", deployer.address);

    // Factory proxy address on Sepolia
    const FACTORY_PROXY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";

    console.log("\nDeploying new Factory implementation...");
    
    // Get the Factory contract factory
    const Factory = await ethers.getContractFactory("Factory", deployer);
    
    // Prepare upgrade
    console.log("Preparing upgrade with new implementation...");
    
    try {
        // Directly upgrade the proxy to a new implementation
        console.log("Upgrading proxy to new implementation...");
        const proxyFactory = await upgrades.upgradeProxy(FACTORY_PROXY_ADDRESS, Factory, {
            kind: 'transparent',
            unsafeAllow: ['constructor'],
            redeployImplementation: 'always' // Force redeployment of the implementation
        });
        
        await proxyFactory.waitForDeployment();
        console.log("Upgrade transaction completed");
        
        // Get the implementation address
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(FACTORY_PROXY_ADDRESS);
        
        console.log("\nUpgrade completed!");
        console.log("-------------------");
        console.log("Proxy:", FACTORY_PROXY_ADDRESS);
        console.log("New Implementation:", implementationAddress);
        
        // Verify the implementation contract
        if (!developmentChains.includes(networkConfig[chainId].name)) {
            console.log("\nVerifying new implementation...");
            try {
                await verify(implementationAddress, []);
                console.log("\nVerification successful!");
            } catch (error) {
                console.log("Verification error:", error.message);
            }
        }
    } catch (error) {
        console.error("Error during upgrade:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
