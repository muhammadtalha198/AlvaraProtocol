const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log("Testing BTS withdrawETH with fee deduction...");
    
    // Get signer
    const [signer] = await ethers.getSigners();
    console.log(`Using account: ${signer.address}\n`);
    
    // BTS proxy address - this is the address users interact with
    const BTS_PROXY_ADDRESS = "0xaa11418588A283Ee3E17e6E5ece87F81f88ad96F";
    console.log(`Using BTS proxy address: ${BTS_PROXY_ADDRESS}`);
    
    // Connect to BTS contract
    const bts = await ethers.getContractAt(
        "BasketTokenStandard",
        BTS_PROXY_ADDRESS,
        signer
    );
    
    // Get BTS Pair address
    const btsPair = await bts.btsPair();
    console.log(`BTS Pair address: ${btsPair}`);
    
    // Step 1: Check LP token balance
    console.log("\n1. Checking LP token balance...");
    const lpToken = await ethers.getContractAt(
        "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol:IERC20Upgradeable",
        btsPair,
        signer
    );
    
    const lpBalance = await lpToken.balanceOf(signer.address);
    console.log(` Wallet LP Balance: ${ethers.formatEther(lpBalance)} tokens`);
    
    
    
    // Step 4: Get initial ETH balance
    console.log("\n4. Getting initial ETH balance...");
    const initialEthBalance = await ethers.provider.getBalance(signer.address);
    console.log(`   Initial ETH Balance: ${ethers.formatEther(initialEthBalance)} ETH`);
    
    // Step 5: Setting withdrawal amount to 1 LP token
    console.log("\n5. Setting withdrawal amount...");
    const withdrawAmount = ethers.parseEther("1");
    console.log(`   Amount to withdraw: 1 LP token`);
    
    
    // Step 6: Approving BTS contract to spend LP tokens
    console.log("\n6. Approving BTS contract to spend LP tokens...");
    const approveTx = await lpToken.approve(BTS_PROXY_ADDRESS, withdrawAmount);
    console.log(`   Approval transaction hash: ${approveTx.hash}`);
    
    const approvalReceipt = await approveTx.wait();
    console.log(`   Approval confirmed in block: ${approvalReceipt.blockNumber}`);
    
    // Step 7: Execute withdrawETH with fee deduction
    console.log("\n>>> Executing withdrawETH with fee deduction...");
    const buffer = 50; // 0.5% buffer
    
    try {
        // Add more logging to debug the transaction
        console.log(`   Withdraw Amount: ${withdrawAmount.toString()}`);
        console.log(`   Buffer: ${buffer}`);
        
        // Debug contract information
        console.log("\n   Contract debugging information:");
        console.log(`   BTS contract address: ${BTS_PROXY_ADDRESS}`);
        console.log(`   Contract ETH balance: ${ethers.formatEther(await ethers.provider.getBalance(BTS_PROXY_ADDRESS))} ETH`);
        
        // Try with a higher gas limit
        console.log("\n   Executing withdrawETH transaction...");
        // Try with a high gas limit
        console.log("\n   Executing transaction with high gas limit...");
        
        // Create a properly encoded function call
        const withdrawWETHFunction = bts.interface.getFunction("withdrawETH");
        const encodedData = bts.interface.encodeFunctionData(withdrawWETHFunction, [withdrawAmount, buffer]);
        
        console.log("\n   Function signature and parameters:");
        console.log(`   Function: withdrawETH(uint256 _liquidity, uint256 _buffer)`);
        console.log(`   Parameters: [${ethers.formatEther(withdrawAmount)} LP tokens, ${buffer} buffer]`);
        console.log(`   Encoded data: ${encodedData}`);
        
        // Send the transaction with the encoded data
        const tx = await signer.sendTransaction({
            to: BTS_PROXY_ADDRESS,
            data: encodedData,
            gasLimit: 5000000 // Very high gas limit for complex operations
        });
        
        console.log(`   Transaction hash: ${tx.hash}`);
        
        console.log("\n   Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log(`   Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed}`);
        
        // Step 8: Check for events
        console.log("\nChecking for events...");
        
        if (receipt && receipt.logs && receipt.logs.length > 0) {
            console.log(`   Found ${receipt.logs.length} event logs in the transaction`);
            
            // Try to parse the WithdrawnETHFromBTS event
            let withdrawEvent = null;
            let feeEvent = null;
            
            for (const log of receipt.logs) {
                try {
                    const parsedLog = bts.interface.parseLog(log);
                    
                    if (parsedLog && parsedLog.name === "WithdrawnETHFromBTS") {
                        withdrawEvent = parsedLog;
                    }
                    
                    if (parsedLog && parsedLog.name === "PlatformFeeDeducted") {
                        feeEvent = parsedLog;
                    }
                } catch (e) {
                    // Not a BTS event, ignore
                }
            }
            
            if (withdrawEvent) {
                console.log("\n   WithdrawnETHFromBTS Event Found:");
                console.log(`   Basket: ${withdrawEvent.args[0]}`);
                console.log(`   Recipient: ${withdrawEvent.args[1]}`);
                console.log(`   ETH Amount: ${ethers.formatEther(withdrawEvent.args[2])} ETH`);
            } else {
                console.log("   No WithdrawnETHFromBTS event found");
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
        }
        
        // Step 9: Check final ETH balance
        console.log("\n9. Checking final ETH balance...");
        const finalEthBalance = await ethers.provider.getBalance(signer.address);
        console.log(`   Final ETH Balance: ${ethers.formatEther(finalEthBalance)} ETH`);
        
        // Calculate ETH received (considering gas costs)
        const gasCost = receipt.gasUsed * receipt.gasPrice;
        const ethReceived = finalEthBalance - initialEthBalance + gasCost;
        console.log(`   ETH Received (approx): ${ethers.formatEther(ethReceived)} ETH`);
        
        // Step 10: Check final LP token balance
        console.log("\n10. Checking final LP token balance...");
        const finalLpBalance = await lpToken.balanceOf(signer.address);
        console.log(`   Final LP balance: ${ethers.formatEther(finalLpBalance)} tokens`);
        console.log(`   LP tokens withdrawn: ${ethers.formatEther(lpBalance - finalLpBalance)}`);
        
        // Step 11: Check fee collector ETH balance if fee event was found
        // Skip this step as there's no fee event in this implementation
        
        // Step 12: Check WETH balance in the contract
        console.log("\n12. Checking WETH balance in the contract...");
        // Get factory address
        const FACTORY_ADDRESS = await bts.factory();
        // Get WETH address from factory
        const factory = await ethers.getContractAt("IFactory", FACTORY_ADDRESS, signer);
        const wethAddress = await factory.WETH();
        const weth = await ethers.getContractAt("IERC20Upgradeable", wethAddress, signer);
        const btsWethBalance = await weth.balanceOf(BTS_PROXY_ADDRESS);
        console.log(`   BTS Contract WETH Balance: ${ethers.formatEther(btsWethBalance)} WETH`);
        
        console.log("\nWithdrawal with ETH conversion and fee deduction test completed!");
        
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
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
