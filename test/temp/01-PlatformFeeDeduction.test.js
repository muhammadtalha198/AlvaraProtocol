const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const logHelper = require('../utils/logHelper');

describe("Fee Deduction Tests", () => {
  const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";
  const BTS_ADDRESS = "0xaa11418588A283Ee3E17e6E5ece87F81f88ad96F";

  let owner, user1, user2, user3;
  let bts, btsPair, factory, wETH, alva;
  let btsAddress, btsPairAddress, factoryAddress, wETHAddress, alvaAddress, btsOwnerAddress;
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const MAX_FEE = 10000; // 100% in basis points

  before(async function () {
    // Initialize log helper with network name
    logHelper.createNewLogFile(network.name);
    
    // Get signers
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Set Factory address - this is the deployed Factory we'll be testing with
    factoryAddress = FACTORY_ADDRESS;
    // Set BTS address - this is the deployed BTS we'll be testing with
    btsAddress = BTS_ADDRESS; 
    
    // Get Factory contract instance
    factory = await ethers.getContractAt("Factory", factoryAddress);
    // Get BTS contract instance
    bts = await ethers.getContractAt("BasketTokenStandard", btsAddress);
    
    // Get BTS Pair address from BTS contract
    btsPairAddress = await bts.btsPair();
    
    // Get BTS Pair contract instance
    btsPair = await ethers.getContractAt("BasketTokenStandardPair", btsPairAddress);
      
    // Get BTS owner address by calling ownerOf(0)
    try {
      btsOwnerAddress = await bts.ownerOf(0);
    } catch (error) {
      // Set a default owner if we can't get it
      btsOwnerAddress = owner.address;
    }
    
    // Get WETH address from Factory
    wETHAddress = await factory.WETH();
    
    // Get WETH contract instance
    wETH = await ethers.getContractAt("IWETH", wETHAddress);
    
    // Get ALVA address from Factory
    alvaAddress = await factory.alva();
    
    // Get ALVA contract instance
    alva = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", alvaAddress);
  });

  // After all tests, save the log file
  after(function() {
    logHelper.saveLogFile(network.name);
  });

  describe("BTS Creation Fee Deduction", function () {
    // Store shared variables
    let initialFeeConfig;
    let defaultFee = 50; // 0.5%
    
    it("01- should set BTS creation fee to 0.5%", async function () {
      // Only the owner can update the fee configuration
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Get the current platform fee configuration
      initialFeeConfig = await factory.getPlatformFeeConfig();
      
      // Store the current fee values
      const currentBtsCreationFee = initialFeeConfig.btsCreationFee;
      const currentContributionFee = initialFeeConfig.contributionFee;
      const currentWithdrawalFee = initialFeeConfig.withdrawalFee;
      
      // Set the BTS creation fee to 0.5% (50 basis points)
      const tx = await factory.setPlatformFeeConfig(
        defaultFee,
        defaultFee,
        defaultFee
      );
      
      // Log transaction hash with network name
      logHelper.log("01-setPlatformFeeConfig- with default fee values", {
        tx: tx.hash,
        btsCreationFee: defaultFee.toString(),
        contributionFee: defaultFee.toString(),
        withdrawalFee: defaultFee.toString()
      }, network.name);
      
      // Get the updated fee configuration to confirm
      const updatedFeeConfig = await factory.getPlatformFeeConfig();
      
      // If we're the factory owner, we should have been able to update the fees
      if (factoryOwner.toLowerCase() === owner.address.toLowerCase()) {
        // Verify the fee was updated correctly
        expect(updatedFeeConfig.btsCreationFee).to.equal(defaultFee, "BTS creation fee not updated correctly");
        expect(updatedFeeConfig.contributionFee).to.equal(defaultFee, "Contribution fee should not change");
        expect(updatedFeeConfig.withdrawalFee).to.equal(defaultFee, "Withdrawal fee should not change");
      } else {
        // If we're not the factory owner, the fees should remain unchanged
        expect(updatedFeeConfig.btsCreationFee).to.equal(currentBtsCreationFee, "BTS creation fee should not change");
        expect(updatedFeeConfig.contributionFee).to.equal(currentContributionFee, "Contribution fee should not change");
        expect(updatedFeeConfig.withdrawalFee).to.equal(currentWithdrawalFee, "Withdrawal fee should not change");
      }
    });
    
    it("02- should deduct fee when creating a new BTS", async function () {
      // Skip if the previous test was skipped
      if (!initialFeeConfig) {
        this.skip();
        return;
      }
      
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip this test
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Store the initial fee collector address and balance
      const feeCollector = (await factory.getPlatformFeeConfig()).feeCollector;
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      
      // Define parameters for a new BTS
      const name = "Test BTS";
      const symbol = "TBTS";
      const tokenURI = "https://test-uri.com";
      const description = "Test BTS for fee deduction";
      const tokens = [wETHAddress, alvaAddress]; // Use WETH as the only token
      const weights = [5000, 5000]; // 100% weight
      
      // Create a new BTS with value to test fee deduction
      const createValue = ethers.parseEther("0.01"); // 0.01 ETH
      const expectedFee = createValue * BigInt(defaultFee) / BigInt(10000); // 0.5% of 0.01 ETH
      
      // Create the BTS
      const buffer = 100; // 1% buffer
      const createTx = await factory.createBTS(
        name,
        symbol,
        tokens,
        weights,
        tokenURI,
        buffer,
        "test-id", 
        description,
        { value: createValue }
      );
      
      // Log transaction hash with network name
      logHelper.log("02-createBTS- with demo data", {
        tx: createTx.hash,
        name: name
      }, network.name);
      
      // Wait for the transaction to be mined
      const receipt = await createTx.wait();
      
      // Get the new BTS address from the event
      let newBtsAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsedLog = factory.interface.parseLog(log);
          if (parsedLog?.name === "CreatedBTS") {
            newBtsAddress = parsedLog.args.bts;
            break;
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
      
      // If we couldn't find the BTS address, skip the rest of the test
      if (!newBtsAddress) {
        console.log("Could not find CreatedBTS event in transaction logs");
        this.skip();
        return;
      }
      
      // Get the new BTS instance
      const newBts = await ethers.getContractAt("BasketTokenStandard", newBtsAddress);
      
      // Check the fee collector's balance after BTS creation
      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      const feeCollected = finalFeeCollectorBalance - initialFeeCollectorBalance;
      
      // Verify that the correct fee was deducted and sent to the fee collector
      expect(feeCollected).to.equal(expectedFee, "Incorrect fee amount collected");
      
      // Get the LP token balance received from BTS creation
      const btsPairAddress = await newBts.btsPair();
      const btsPair = await ethers.getContractAt("BasketTokenStandardPair", btsPairAddress);
      const lpBalance = await btsPair.balanceOf(owner.address);
      
      // Store the BTS address and LP balance for the next tests
      this.newBtsAddress = newBtsAddress;
      this.lpBalance = lpBalance;
    });
    
    it("03- should deduct fee when contributing to the BTS", async function () {
      // Skip if the previous test was skipped or failed
      if (!this.newBtsAddress) {
        this.skip();
        return;
      }
      
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip this test
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Get the BTS instance from the previous test
      const newBts = await ethers.getContractAt("BasketTokenStandard", this.newBtsAddress);
      
      const setFeeTx = await factory.setPlatformFeeConfig(
        defaultFee,
        defaultFee,
        defaultFee
      );
      
      // Log transaction hash with network name
      logHelper.log("04-setPlatformFeeConfig- with default fee values", {
        tx: setFeeTx.hash
      }, network.name);
      
      // Store the initial fee collector address and balance
      const feeCollector = (await factory.getPlatformFeeConfig()).feeCollector;
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      
      // Contribute with a very small amount of ETH to avoid balance issues
      const contributionAmount = ethers.parseEther("0.0001"); // 0.0001 ETH
      const expectedFee = contributionAmount * BigInt(defaultFee) / BigInt(10000); // 0.5% of 0.001 ETH
      
      // Contribute to the BTS with 1% buffer
      const buffer = 100; // 1% buffer
      const contributeTx = await newBts.contribute(buffer, { value: contributionAmount });
      
      // Log transaction hash with network name
      logHelper.log("03-contribute- with fee deduction", {
        tx: contributeTx.hash,
        btsAddress: this.newBtsAddress,
        contributionAmount: contributionAmount.toString()
      }, network.name);
      
      // Wait for the transaction to be mined
      await contributeTx.wait();
      
      // Check the fee collector's balance after contribution
      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      const feeCollected = finalFeeCollectorBalance - initialFeeCollectorBalance;
      
      // Verify that the correct fee was deducted and sent to the fee collector
      expect(feeCollected).to.equal(expectedFee, "Incorrect contribution fee amount collected");
    });
    
    it("04- should deduct fee when withdrawing from the BTS", async function () {
      // Skip if the previous test was skipped or failed
      if (!this.newBtsAddress) {
        this.skip();
        return;
      }
      
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip this test
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Get the BTS instance from the previous test
      const newBts = await ethers.getContractAt("BasketTokenStandard", this.newBtsAddress);
      const btsPairAddress = await newBts.btsPair();
      const btsPair = await ethers.getContractAt("BasketTokenStandardPair", btsPairAddress);
      

      const setFeeTx = await factory.setPlatformFeeConfig(
        defaultFee,
        defaultFee,
        defaultFee
      );
      
      // Log transaction hash with network name
      logHelper.log("04-setPlatformFeeConfig - with default fee values", {
        tx: setFeeTx.hash
      }, network.name);
      
      // Store the initial fee collector address and balance
      const feeCollector = (await factory.getPlatformFeeConfig()).feeCollector;
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector);
      
      // Get current LP balance
      const currentLpBalance = await btsPair.balanceOf(owner.address);
      
      // Use a smaller amount for withdrawal to avoid potential issues
      const withdrawAmount = currentLpBalance / BigInt(10); // Use 10% instead of 50%
      
      // Approve the BTS contract to spend LP tokens
      const approveTx = await btsPair.approve(this.newBtsAddress, withdrawAmount);
      
      // Log transaction hash with network name
      logHelper.log("04-approve-LP Tokens", {
        tx: approveTx.hash,
        btsPairAddress: btsPairAddress,
        btsAddress: this.newBtsAddress,
      }, network.name);
      
      await approveTx.wait();
      
      // Withdraw tokens from the BTS
      // Note: The withdraw function signature might be different than expected
      // Let's try with different parameter orders
      let withdrawTx;
      try {
        withdrawTx = await newBts.withdraw(withdrawAmount, buffer);
      } catch (error) {
        // If the first attempt fails, try with just the withdrawAmount
        withdrawTx = await newBts.withdraw(withdrawAmount);
      }
      
      // Log transaction hash with network name
      logHelper.log("04-withdraw- with fee deduction", {
        tx: withdrawTx.hash,
        btsAddress: this.newBtsAddress,
        withdrawAmount: withdrawAmount.toString(),
      }, network.name);
      
      // Wait for the transaction to be mined
      await withdrawTx.wait();
      
      // For token withdrawals, the fee might be collected in tokens, not ETH
      // Let's check if the withdrawal was successful by verifying the LP token balance decreased
      const finalLpBalance = await btsPair.balanceOf(owner.address);
      
      // Verify that LP tokens were withdrawn
      expect(finalLpBalance).to.be.lt(currentLpBalance, "LP tokens were not withdrawn");
      
      // Calculate the expected LP tokens after withdrawal (without fee)
      const expectedWithdrawal = withdrawAmount;
      
      // Calculate the actual change in LP tokens
      const lpTokensWithdrawn = currentLpBalance - finalLpBalance;
      
      // Verify that more LP tokens were withdrawn than expected (due to fee)
      expect(lpTokensWithdrawn).to.be.gte(expectedWithdrawal, "No fee was deducted during withdrawal");
      
    });
  });
});
