const { ethers } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // BTS contract address (replace with your BTS address)
    const BTS_ADDRESS = "0xaa11418588A283Ee3E17e6E5ece87F81f88ad96F"; // TODO: Replace with actual BTS address
    const CONTRIBUTION_AMOUNT = ethers.parseEther("0.001");

    // Get BTS contract instance
    const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS, signer);

    // Get Factory instance to check platform fees
    const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";
    const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS, signer);

    // Get current platform fees
    const platformFees = await factory.getPlatformFeeConfig();
    const contributionFeePercent = platformFees.contributionFee;
    const feeAmount = (CONTRIBUTION_AMOUNT * contributionFeePercent) / 10000n;
    const netContribution = CONTRIBUTION_AMOUNT - feeAmount;

    console.log("\nContribution Details:");
    console.log("--------------------");
    console.log("BTS Address:", BTS_ADDRESS);
    console.log("Gross Amount:", ethers.formatEther(CONTRIBUTION_AMOUNT), "ETH");
    console.log("Platform Fee:", ethers.formatEther(feeAmount), "ETH", `(${contributionFeePercent / 100n}%)`);
    console.log("Net Amount:", ethers.formatEther(netContribution), "ETH");

    // Note: We can't get token info from IBTS interface as it's not exposed
    // We'll just proceed with the contribution

    // Contribute with 1% max buffer (100 basis points)
    console.log("\nContributing...");
    const tx = await bts.contribute(100, { value: CONTRIBUTION_AMOUNT });
    console.log("Transaction hash:", tx.hash);
    
    console.log("\nWaiting for confirmation...");
    const receipt = await tx.wait();



    // Parse events
    const events = receipt.logs.map(log => {
        try {
            // Try parsing as Factory event first
            const factoryEvent = factory.interface.parseLog(log);
            if (factoryEvent) return { type: 'factory', event: factoryEvent };
        } catch {}

        try {
            // Try parsing as BTS event
            const btsEvent = bts.interface.parseLog(log);
            if (btsEvent) return { type: 'bts', event: btsEvent };
        } catch {}

        return null;
    }).filter(e => e !== null);

    // Get platform fee event
    const feeEvent = events.find(e => e.type === 'factory' && e.event.name === "PlatformFeeDeducted")?.event;

    // Get contribution event
    const contributionEvent = events.find(e => e.type === 'bts' && e.event.name === "ContributedToBTS")?.event;

    console.log("\nContribution Details:");
    console.log("--------------------");
    if (contributionEvent) {
        console.log(`Contribution: ${ethers.formatEther(contributionEvent.args.amount)} ETH`);
    }
    if (feeEvent) {
        console.log(`Platform fee deducted: ${ethers.formatEther(feeEvent.args.feeAmount)} ETH`);
        console.log(`Fee collector: ${feeEvent.args.feeCollector}`);
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
