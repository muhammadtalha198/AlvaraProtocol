const { ethers } = require("hardhat");

async function main() {
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // BTS contract address
    const BTS_ADDRESS = "0x5506fc40eD13DaD2fC35e0eAfE37a96b313a023f";
    
    // Get BTS contract instance
    const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS, signer);
    
    // Get BTS Pair address
    const btsPair = await bts.btsPair();
    console.log("\nUsing BTS proxy address:", BTS_ADDRESS);
    console.log("BTS Pair address:", btsPair);
    
    // Get LP token instance
    const lpToken = await ethers.getContractAt("BasketTokenStandardPair", btsPair, signer);
    
    // Step 1: Check initial LP token balance
    console.log("\n1. Checking initial LP token balance...");
    const initialLpBalance = await lpToken.balanceOf(signer.address);
    console.log(`   Initial LP Balance: ${ethers.formatEther(initialLpBalance)} tokens`);
    
    // Step 2: Get initial ETH balance
    console.log("\n2. Getting initial ETH balance...");
    const initialEthBalance = await ethers.provider.getBalance(signer.address);
    console.log(`   Initial ETH Balance: ${ethers.formatEther(initialEthBalance)} ETH`);
    
    // Step 3: Get factory instance and check platform fees
    console.log("\n3. Getting fee configuration...");
    const factory = await ethers.getContractAt("Factory", await bts.factory(), signer);
    const feeConfig = await factory.getPlatformFeeConfig();
    console.log("   Contribution Fee:", feeConfig[0].toString(), "basis points");
    console.log("   Deposit Fee:", feeConfig[1].toString(), "basis points");
    console.log("   Withdrawal Fee:", feeConfig[2].toString(), "basis points");
    console.log("   Fee Collector:", feeConfig[3]);
    
    // Step 4: Set contribution amount
    const contributionAmount = ethers.parseEther("0.01"); // 0.01 ETH
    console.log("\n4. Setting contribution amount...");
    console.log(`   Amount to contribute: ${ethers.formatEther(contributionAmount)} ETH`);
    
    // Step 5: Execute contribution with fee deduction
    console.log("\n5. Executing contribution with fee deduction...");
    try {
        // Use a higher gas limit to account for complex operations
        const tx = await bts.contribute(50, {
            value: contributionAmount,
            gasLimit: 3000000 // Higher gas limit for fee processing
        });
        
        console.log("   Contribution transaction hash:", tx.hash);
        console.log("   Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log("   Transaction confirmed in block:", receipt.blockNumber);
        console.log("   Gas used:", receipt.gasUsed);
        
        // Step 6: Check for events
        console.log("\n6. Checking for events...");
        const contributedEvent = receipt.logs
            .filter(log => {
                try {
                    const parsedLog = bts.interface.parseLog(log);
                    return parsedLog && parsedLog.name === "ContributedToBTS";
                } catch (e) {
                    return false;
                }
            })
            .map(log => bts.interface.parseLog(log));
            
        const feeEvent = receipt.logs
            .filter(log => {
                try {
                    const parsedLog = bts.interface.parseLog(log);
                    return parsedLog && parsedLog.name === "PlatformFeeDeducted";
                } catch (e) {
                    return false;
                }
            })
            .map(log => bts.interface.parseLog(log));
        
        if (contributedEvent.length > 0) {
            console.log("\n   ContributedToBTS Event Found:");
            console.log("   Basket:", contributedEvent[0].args.bts);
            console.log("   Sender:", contributedEvent[0].args.sender);
            console.log("   Amount:", ethers.formatEther(contributedEvent[0].args.amount), "ETH");
        }
        
        if (feeEvent.length > 0) {
            console.log("\n   PlatformFeeDeducted Event Found:");
            console.log("   Fee Amount:", ethers.formatEther(feeEvent[0].args.feeAmount), "ETH");
            console.log("   Fee Rate:", feeEvent[0].args.feePercent, "basis points");
            console.log("   Fee Collector:", feeEvent[0].args.feeCollector);
            console.log("   Operation:", feeEvent[0].args.action);
        }
        
        // Step 7: Check final LP token balance
        console.log("\n7. Checking final LP token balance...");
        const finalLpBalance = await lpToken.balanceOf(signer.address);
        console.log(`   Final LP balance: ${ethers.formatEther(finalLpBalance)} tokens`);
        console.log(`   LP tokens minted: ${ethers.formatEther(finalLpBalance - initialLpBalance)}`);
        
        // Step 8: Check final ETH balance
        console.log("\n8. Checking final ETH balance...");
        const finalEthBalance = await ethers.provider.getBalance(signer.address);
        console.log(`   Final ETH Balance: ${ethers.formatEther(finalEthBalance)} ETH`);
        
        // Calculate ETH spent (considering gas costs)
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const ethSpent = initialEthBalance - finalEthBalance;
        console.log(`   ETH Spent (including gas): ${ethers.formatEther(ethSpent)} ETH`);
        console.log(`   Gas Cost: ${ethers.formatEther(gasCost)} ETH`);
        console.log(`   Actual Contribution: ${ethers.formatEther(ethSpent - gasCost)} ETH`);
        
        // Step 9: Check fee collector ETH balance if fee event was found
        if (feeEvent.length > 0) {
            console.log("\n9. Checking fee collector ETH balance...");
            const feeCollectorBalance = await ethers.provider.getBalance(feeEvent[0].args.feeCollector);
            console.log(`   Fee collector ETH balance: ${ethers.formatEther(feeCollectorBalance)}`);
        }
        
    } catch (error) {
        console.error("Error during contribution:", error);
        
        // Try to provide more detailed error information
        if (error.transaction) {
            console.log("\nTransaction details:");
            console.log("To:", error.transaction.to);
            console.log("From:", error.transaction.from);
            console.log("Data:", error.transaction.data ? "Has data" : "No data");
        }
        
        if (error.receipt) {
            console.log("\nTransaction receipt:");
            console.log("Status:", error.receipt.status);
            console.log("Gas Used:", error.receipt.gasUsed.toString());
            console.log("Block Number:", error.receipt.blockNumber);
        }
        
        throw error;
    }
    
    console.log("\nContribution with fee deduction test completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
