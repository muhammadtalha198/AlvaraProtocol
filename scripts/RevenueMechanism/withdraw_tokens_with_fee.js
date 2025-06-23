require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    console.log("Testing BTS withdrawal with fee deduction...");
    
    // Get the signer
    const [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);
    
    // Get provider
    const provider = ethers.provider;

    // Contract addresses
    const BTS_ADDRESS = "0xaa11418588A283Ee3E17e6E5ece87F81f88ad96F";
    const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";
    
    console.log("\nUsing BTS proxy address:", BTS_ADDRESS);
    
    // Get contract instances
    const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS, signer);
    const factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS, signer);
    
    // Get BTS pair address and contract
    const btsPairAddress = await bts.btsPair();
    console.log("BTS Pair address:", btsPairAddress);
    const btsPair = await ethers.getContractAt("BasketTokenStandardPair", btsPairAddress, signer);

    // Step 1: Check LP token balance
    console.log("\n1. Checking LP token balance...");
    const lpBalance = await btsPair.balanceOf(signer.address);
    console.log(`   LP Balance: ${ethers.formatEther(lpBalance)} tokens`);

    // Step 2: Get token list and reserves
    console.log("\n2. Getting token information...");
    const tokenList = await btsPair.getTokenList();
    const reserves = await btsPair.getTokensReserve();
    console.log("   Token List:", tokenList);
    console.log("   Token Reserves:", reserves.map(r => ethers.formatEther(r)));

    // Step 3: Get fee configuration from factory
    console.log("\n3. Getting fee configuration...");
    const feeConfig = await factory.getPlatformFeeConfig();
    console.log("   Swap Fee:", feeConfig[0].toString(), "basis points");
    console.log("   Deposit Fee:", feeConfig[1].toString(), "basis points");
    console.log("   Withdrawal Fee:", feeConfig[2].toString(), "basis points");
    console.log("   Fee Collector:", feeConfig[3]);

    // Step 4: Get initial token balances
    console.log("\n4. Getting initial token balances...");
    const initialBalances = [];
    const tokenSymbols = [];
    
    for (let i = 0; i < tokenList.length; i++) {
        const token = await ethers.getContractAt(
            "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol:IERC20Upgradeable", 
            tokenList[i], 
            signer
        );
        
        // Try to get token symbol if available
        let symbol = "Unknown";
        try {
            const tokenWithSymbol = await ethers.getContractAt("ERC20", tokenList[i], signer);
            symbol = await tokenWithSymbol.symbol();
        } catch {
            symbol = `Token ${i+1}`;
        }
        tokenSymbols.push(symbol);
        
        const balance = await token.balanceOf(signer.address);
        initialBalances.push(balance);
        console.log(`   ${symbol} (${tokenList[i]}): ${ethers.formatEther(balance)}`);
    }

    // Step 5: Set amount to withdraw (1 LP token for testing)
    console.log("\n5. Setting withdrawal amount...");
    const withdrawAmount = ethers.parseEther("100");
    console.log(`   Amount to withdraw: ${ethers.formatEther(withdrawAmount)} LP tokens`);

    // Check if we have enough LP tokens
    if (BigInt(lpBalance) < BigInt(withdrawAmount)) {
        throw new Error(`Insufficient LP tokens. Have ${ethers.formatEther(lpBalance)} but trying to withdraw ${ethers.formatEther(withdrawAmount)}`);
    }

    // Step 6: Approve BTS contract to spend LP tokens
    console.log("\n6. Approving BTS contract to spend LP tokens...");
    const approveTx = await btsPair.approve(BTS_ADDRESS, withdrawAmount);
    console.log("   Approval transaction hash:", approveTx.hash);
    const approvalReceipt = await approveTx.wait();
    console.log("   Approval confirmed in block:", approvalReceipt.blockNumber);

    // Step 7: Execute withdrawal with fee deduction
    console.log("\n7. Executing withdrawal with fee deduction...");
    try {
        // Use a higher gas limit to account for complex operations
        const tx = await bts.withdraw(withdrawAmount, {
            gasLimit: 3000000 // Higher gas limit for fee processing
        });
        
        console.log("   Withdrawal transaction hash:", tx.hash);
        console.log("   Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("   Transaction confirmed in block:", receipt.blockNumber);
        console.log("   Gas used:", receipt.gasUsed.toString());
        
        // Step 8: Check for events
        console.log("\n8. Checking for events...");
        
        // Parse the logs to extract events
        let withdrawnEvent = null;
        let feeEvent = null;
        
        for (const log of receipt.logs) {
            try {
                // Try to parse the log using the BTS interface
                const parsedLog = bts.interface.parseLog(log);
                
                if (parsedLog && parsedLog.name === "WithdrawnFromBTS") {
                    withdrawnEvent = parsedLog;
                }
                
                if (parsedLog && parsedLog.name === "PlatformFeeDeducted") {
                    feeEvent = parsedLog;
                }
            } catch (e) {
                // Not a BTS event, ignore
            }
        }
        
        if (withdrawnEvent) {
            console.log("\n   WithdrawnFromBTS Event Found:");
            console.log("   Basket:", withdrawnEvent.args[0]);
            console.log("   Recipient:", withdrawnEvent.args[1]);
            console.log("   Tokens:", withdrawnEvent.args[2].length);
            
            // Display token amounts withdrawn (original amounts before fee deduction)
            console.log("   Original Amounts (before fee deduction):");
            for (let i = 0; i < withdrawnEvent.args[3].length; i++) {
                console.log(`   ${tokenSymbols[i]}: ${ethers.formatEther(withdrawnEvent.args[3][i])}`);
            }
        } else {
            console.log("   No WithdrawnFromBTS event found");
        }
        
        if (feeEvent) {
            console.log("\n   PlatformFeeDeducted Event Found:");
            console.log(`   Fee Amount: ${ethers.formatEther(feeEvent.args[0])} ETH`);
            console.log(`   Fee Rate: ${feeEvent.args[1].toString()} basis points`);
            console.log(`   Fee Collector: ${feeEvent.args[2]}`);
            console.log(`   Operation: ${feeEvent.args[3]}`);
        } else {
            console.log("   No PlatformFeeDeducted event found");
        }
        
    } catch (error) {
        console.error("\nError during withdrawal:", error.message);
        
        if (error.transaction) {
            console.log("\nTransaction details:");
            console.log("To:", error.transaction.to);
            console.log("From:", error.transaction.from);
            console.log("Data:", error.transaction.data ? 
                error.transaction.data.substring(0, 66) + "..." : 
                "No data");
        }
        
        if (error.receipt) {
            console.log("\nTransaction receipt:");
            console.log("Status:", error.receipt.status);
            console.log("Gas Used:", error.receipt.gasUsed.toString());
            console.log("Block Number:", error.receipt.blockNumber);
        }
        
        throw error;
    }

    // Step 9: Check final token balances
    console.log("\n9. Checking final token balances...");
    const finalBalances = [];
    
    for (let i = 0; i < tokenList.length; i++) {
        const token = await ethers.getContractAt(
            "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol:IERC20Upgradeable", 
            tokenList[i], 
            signer
        );
        
        const balance = await token.balanceOf(signer.address);
        finalBalances.push(balance);
        
        const received = BigInt(balance) - BigInt(initialBalances[i]);
        const receivedFormatted = ethers.formatEther(received);
        
        console.log(`   ${tokenSymbols[i]} (${tokenList[i]}):`);
        console.log(`   > Final balance: ${ethers.formatEther(balance)}`);
        console.log(`   > Received: ${receivedFormatted} ${receivedFormatted > 0 ? '✅' : '❌'}`);
        
        // Calculate approximate fee if we received tokens
        if (received > 0 && typeof withdrawnEvent !== 'undefined' && withdrawnEvent) {
            const originalAmount = withdrawnEvent.args[3][i];
            const feeRate = feeConfig[2];
            const expectedFee = (BigInt(originalAmount) * BigInt(feeRate)) / BigInt(10000);
            const expectedReceived = BigInt(originalAmount) - expectedFee;
            
            console.log(`   > Original amount: ${ethers.formatEther(originalAmount)}`);
            console.log(`   > Expected fee: ~${ethers.formatEther(expectedFee)}`);
            console.log(`   > Expected to receive: ~${ethers.formatEther(expectedReceived)}`);
        }
    }

    // Step 10: Check final LP balance
    console.log("\n10. Checking final LP token balance...");
    const finalLpBalance = await btsPair.balanceOf(signer.address);
    console.log(`    Final LP balance: ${ethers.formatEther(finalLpBalance)} tokens`);
    
    const lpDifference = BigInt(lpBalance) - BigInt(finalLpBalance);
    console.log(`    LP tokens withdrawn: ${ethers.formatEther(lpDifference)}`);
    
    // Check ETH balance of fee collector
    console.log("\n11. Checking fee collector ETH balance...");
    const feeCollectorBalance = await provider.getBalance(feeConfig[3]);
    console.log(`    Fee collector ETH balance: ${ethers.formatEther(feeCollectorBalance)}`);
    
    console.log("\nWithdrawal with fee deduction test completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
