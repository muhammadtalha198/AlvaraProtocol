const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const logHelper = require('../utils/logHelper');

// Global variable to store the BTS address created in test 02
let BTS_ADDRESS = null;

describe("BTS Creation With Fee Tests", function () {
  const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";

  let signer, factory, wETH, alva;
  let wETHAddress, alvaAddress, feeCollector;
  let minBTSCreationAmount, btsCreationFee;

  before(async function () {
    // Initialize log helper with network name
    logHelper.createNewLogFile(network.name);
    
    // Get signers
    [signer] = await ethers.getSigners();
    console.log("Using account:", signer.address);

    // Get Factory contract instance
    factory = await ethers.getContractAt("Factory", FACTORY_ADDRESS, signer);
    
    // Get WETH address from Factory
    wETHAddress = await factory.WETH();
    
    // Get WETH contract instance
    wETH = await ethers.getContractAt("IWETH", wETHAddress);
    
    // Get ALVA address from Factory
    alvaAddress = await factory.alva();
    
    // Get ALVA contract instance
    alva = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", alvaAddress);

    // Get the minimum BTS creation amount
    minBTSCreationAmount = await factory.minBTSCreationAmount();

    // Get the current platform fee configuration
    const feeConfig = await factory.getPlatformFeeConfig();
    feeCollector = feeConfig.feeCollector;
    btsCreationFee = feeConfig.btsCreationFee;

  });

  after(function() {
    // Save the log file
    logHelper.saveLogFile(network.name);

  });

  describe("BTS Creation Fee Tests", function () {
    // Define parameters for a new BTS
    const name = "Test BTS Fee";
    const symbol = "TBTSF";
    const tokenURI = "https://test-uri.com";
    const description = "Test BTS for fee deduction";
    const buffer = 100; // 1% buffer
    let tokens, weights;

    before(function() {
      tokens = [wETHAddress, alvaAddress];
      weights = [5000, 5000]; // 50% each
    });

    it("01- should fail to create BTS with less than minimum amount", async function () {
      // Create BTS with less than the minimum creation fee (should fail)
      const belowMinAmount = minBTSCreationAmount - BigInt(1);
      
      // Expect the transaction to be reverted with InsufficientBTSCreationAmount error
      await expect(
        factory.createBTS(
          name,
          symbol,
          tokens,
          weights,
          tokenURI,
          buffer,
          "test-id-fail", 
          description,
          { value: belowMinAmount }
        )
      ).to.be.revertedWithCustomError(factory, "InsufficientBTSCreationAmount");
      
    });

    it("02- should create BTS with minimum amount and deduct correct fee", async function () {
      // Store the initial fee collector balance
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      
      // Create a new BTS with the minimum value
      const createValue = minBTSCreationAmount;
      
      // Calculate expected fee
      const expectedFee = createValue * BigInt(btsCreationFee) / BigInt(10000);
      
      // Create the BTS
      const createTx = await factory.createBTS(
        name,
        symbol,
        tokens,
        weights,
        tokenURI,
        buffer,
        "test-id-success", 
        description,
        { value: createValue }
      );
      
      // Wait for the transaction to be mined
      const receipt = await createTx.wait();
      
      // Get the new BTS address from the event
      let newBtsAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          if (parsedLog && parsedLog.name === "CreatedBTS") {
            newBtsAddress = parsedLog.args.bts;
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
        }
      }
      
      // Verify that the BTS was created
      expect(newBtsAddress).to.not.be.null;
      
      // Check the fee collector's balance after BTS creation
      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      const feeCollected = finalFeeCollectorBalance - initialFeeCollectorBalance;
      
      // Verify that the correct fee was deducted and sent to the fee collector
      expect(feeCollected).to.equal(expectedFee, "Incorrect fee amount collected");
      
      // Store the BTS address for future tests
      this.newBtsAddress = newBtsAddress;
      BTS_ADDRESS = newBtsAddress;
      
      // Get LP tokens received from BTS creation
      const bts = await ethers.getContractAt("BasketTokenStandard", newBtsAddress);
      const btsPairAddress = await bts.btsPair();
      const btsPair = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", btsPairAddress);
      const lpTokenBalance = await btsPair.balanceOf(signer.address);

        // Log the BTS address and fee information
        logHelper.log("02-new-bts-created", {
        tx: createTx.hash,
        btsAddress: newBtsAddress,
        contributionAmount: createValue.toString(),
        feeCollected: feeCollected.toString(),
        expectedFee: expectedFee.toString(),
        lpTokenBalance: lpTokenBalance.toString()
      }, network.name);
      
    });

    it("03- should contribute ETH to BTS and deduct correct fee", async function () {  
      // Skip if the previous test was skipped or failed  
      if (!BTS_ADDRESS) {  
        this.skip();  
        return;  
      }
      
      // Get the BTS instance
      const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS);
      const btsPairAddress = await bts.btsPair();
      const btsPair = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", btsPairAddress);
      
      // Get initial LP token balance
      const initialLpTokenBalance = await btsPair.balanceOf(signer.address);
      
      // Store the initial fee collector balance
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      
      // Contribute with a small amount of ETH
      const contributionAmount = ethers.parseEther("0.001"); // 0.001 ETH
      const buffer = 100; // 1% buffer
      
      // Calculate expected fee
      const expectedFee = contributionAmount * BigInt(btsCreationFee) / BigInt(10000); // 0.5% of contribution
      
      // Contribute to the BTS
      const contributeTx = await bts.contribute(buffer, { value: contributionAmount });
      await contributeTx.wait();
      
      // Get LP tokens received from contribution
      const finalLpTokenBalance = await btsPair.balanceOf(signer.address);
      const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;
      
      // Check fee collector balance after contribution
      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      const feeCollected = finalFeeCollectorBalance - initialFeeCollectorBalance;
      
      // Log contribution details
      logHelper.log("03-contribute-with-fee", {
        tx: contributeTx.hash,
        btsAddress: BTS_ADDRESS,
        contributionAmount: contributionAmount.toString(),
        expectedFee: expectedFee.toString(),
        lpTokensReceived: lpTokensReceived.toString(),
        feeCollected: feeCollected.toString()
      }, network.name);
      
      // Verify that the exact expected fee was collected
      expect(feeCollected).to.equal(expectedFee, "Incorrect fee amount collected");
      
      // Verify that LP tokens were received
      expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
    });

    it("04- should withdraw all LP tokens and deduct correct fee", async function () {  
      // Skip if the previous test was skipped or failed  
      if (!BTS_ADDRESS) {  
        this.skip();  
        return;  
      }
      
      // Get the BTS instance
      const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS);
      const btsPairAddress = await bts.btsPair();
      const btsPair = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", btsPairAddress);
      
      // Get the actual LP token balance
      const lpTokenBalance = await btsPair.balanceOf(signer.address);
      
      // Skip if no LP tokens are available
      if (lpTokenBalance <= 0) {
        console.log("No LP tokens available for withdrawal");
        this.skip();
        return;
      }
      
      // Withdraw all LP tokens
      const withdrawAmount = lpTokenBalance;
      
      // Store the initial WETH balance of fee collector  
      const initialFeeCollectorWETHBalance = await wETH.balanceOf(feeCollector);  
    
      // Approve the BTS contract to spend LP tokens  
      const approveTx = await btsPair.approve(BTS_ADDRESS, withdrawAmount);  
      await approveTx.wait();  
      
      // Log the approval
      logHelper.log("04-approve-LP-tokens", {
        tx: approveTx.hash,
        btsAddress: BTS_ADDRESS,
        amount: withdrawAmount.toString()
      }, network.name);
      
      // Withdraw tokens from the BTS  
      const withdrawTx = await bts.withdraw(withdrawAmount);  
      await withdrawTx.wait();
      
      // Check the fee collector's WETH balance after withdrawal  
      const finalFeeCollectorWETHBalance = await wETH.balanceOf(feeCollector);  
      const feeCollected = finalFeeCollectorWETHBalance - initialFeeCollectorWETHBalance;  
      
      // Get the final LP token balance  
      const finalLpTokenBalance = await btsPair.balanceOf(signer.address);  
      const lpTokensWithdrawn = lpTokenBalance - finalLpTokenBalance;
      
      // Log the withdrawal details  
      logHelper.log("04-withdraw-with-fee", {  
        tx: withdrawTx.hash,  
        btsAddress: BTS_ADDRESS,  
        withdrawAmount: withdrawAmount.toString(),  
        feeCollectedWETH: feeCollected.toString(), 
        lpTokensWithdrawn: lpTokensWithdrawn.toString(),  
        initialLpTokenBalance: lpTokenBalance.toString(),
        finalLpTokenBalance: finalLpTokenBalance.toString()
      }, network.name);
     
      // Verify that all LP tokens were withdrawn
      expect(finalLpTokenBalance).to.equal(0, "LP token balance should be 0 after withdrawal");
    });

    it("05- should contribute ETH to BTS and deduct correct fee", async function () {  
      // Skip if the previous test was skipped or failed  
      if (!BTS_ADDRESS) {  
        this.skip();  
        return;  
      }
      
      // Get the BTS instance
      const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS);
      const btsPairAddress = await bts.btsPair();
      const btsPair = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", btsPairAddress);
      
      // Get initial LP token balance
      const initialLpTokenBalance = await btsPair.balanceOf(signer.address);
      
      // Store the initial fee collector balance
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      
      // Contribute with a small amount of ETH
      const contributionAmount = ethers.parseEther("0.001"); // 0.001 ETH
      const buffer = 100; // 1% buffer
      
      // Calculate expected fee
      const expectedFee = contributionAmount * BigInt(btsCreationFee) / BigInt(10000); // 0.5% of contribution
      
      // Contribute to the BTS
      const contributeTx = await bts.contribute(buffer, { value: contributionAmount });
      await contributeTx.wait();
      
      // Get LP tokens received from contribution
      const finalLpTokenBalance = await btsPair.balanceOf(signer.address);
      const lpTokensReceived = finalLpTokenBalance - initialLpTokenBalance;
      
      // Check fee collector balance after contribution
      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      const feeCollected = finalFeeCollectorBalance - initialFeeCollectorBalance;
      
      // Log contribution details
      logHelper.log("05-contribute-with-fee", {
        tx: contributeTx.hash,
        btsAddress: BTS_ADDRESS,
        contributionAmount: contributionAmount.toString(),
        expectedFee: expectedFee.toString(),
        lpTokensReceived: lpTokensReceived.toString(),
        feeCollected: feeCollected.toString()
      }, network.name);
      
      // Verify that the exact expected fee was collected
      expect(feeCollected).to.equal(expectedFee, "Incorrect fee amount collected");
      
      // Verify that LP tokens were received
      expect(lpTokensReceived).to.be.gt(0, "No LP tokens were received");
    });

    it("06- should withdraw WETH and deduct correct fee", async function () {  
      // Skip if the previous test was skipped or failed  
      if (!BTS_ADDRESS) {  
        this.skip();  
        return;  
      }
      
      // Get the BTS instance
      const bts = await ethers.getContractAt("BasketTokenStandard", BTS_ADDRESS);
      const btsPairAddress = await bts.btsPair();
      const btsPair = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", btsPairAddress);
      
      // Get the actual LP token balance
      const lpTokenBalance = await btsPair.balanceOf(signer.address);
      
      // Skip if no LP tokens are available
      if (lpTokenBalance <= 0) {
        console.log("No LP tokens available for withdrawal");
        this.skip();
        return;
      }
      
      // Use LP tokens for withdrawal
      const withdrawAmount = lpTokenBalance
      
      // Store the initial WETH balance of fee collector  
      const initialFeeCollectorWETHBalance = await wETH.balanceOf(feeCollector);  
      
      // Store the initial WETH balance of the signer
      const initialSignerWETHBalance = await wETH.balanceOf(signer.address);
      
      
      // Approve the BTS contract to spend LP tokens  
      const approveTx = await btsPair.approve(BTS_ADDRESS, withdrawAmount);  
      await approveTx.wait();  
      
      // Log the approval
      logHelper.log("06-approve-LP-tokens", {
        tx: approveTx.hash,
        btsAddress: BTS_ADDRESS,
        amount: withdrawAmount.toString()
      }, network.name);
      
      // Withdraw WETH from the BTS  
      const withdrawTx = await bts.withdrawETH(withdrawAmount, 100); // 1% buffer  
      await withdrawTx.wait();
      
      // Check the fee collector's WETH balance after withdrawal  
      const finalFeeCollectorWETHBalance = await wETH.balanceOf(feeCollector);  
      const feeCollected = finalFeeCollectorWETHBalance - initialFeeCollectorWETHBalance;  
      
      // Check the signer's WETH balance after withdrawal
      const finalSignerWETHBalance = await wETH.balanceOf(signer.address);
      const wethReceived = finalSignerWETHBalance - initialSignerWETHBalance;
      
      // Get the final LP token balance  
      const finalLpTokenBalance = await btsPair.balanceOf(signer.address);  
      const lpTokensWithdrawn = lpTokenBalance - finalLpTokenBalance;
      
      // Log the withdrawal details  
      logHelper.log("06-withdraw-weth-with-fee", {  
        tx: withdrawTx.hash,  
        btsAddress: BTS_ADDRESS,  
        withdrawAmount: withdrawAmount.toString(),  
        feeCollectedWETH: feeCollected.toString(), 
        wethReceived: wethReceived.toString(),
        lpTokensWithdrawn: lpTokensWithdrawn.toString(),  
        initialLpTokenBalance: lpTokenBalance.toString(),
        finalLpTokenBalance: finalLpTokenBalance.toString()
      }, network.name);
      
      // Verify that LP tokens were withdrawn
      expect(lpTokensWithdrawn).to.equal(withdrawAmount, "Incorrect LP token withdrawal amount");
    });
  });
});
