const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const logHelper = require('../utils/logHelper');

describe("PlatformFee", () => {
  const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D";// Replace with your actual Factory address

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
    
    // Get Factory contract instance
    factory = await ethers.getContractAt("Factory", factoryAddress);

    // Get BTS owner address by calling ownerOf(0)
    try {
      btsOwnerAddress = await bts.ownerOf(0);
    } catch (error) {
      console.log("Could not get BTS owner address. Error:", error.message);
      return;
    }
    
    // Get WETH address from Factory
    wETHAddress = await factory.WETH();
    
    // Get WETH contract instance
    wETH = await ethers.getContractAt("IWETH", wETHAddress);
    
    // Get ALVA address from Factory
    alvaAddress = await factory.alva();
    
    // Get ALVA contract instance
    alva = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", alvaAddress);
    
    // Log all addresses 
    console.log("\n*Test Configuration*");
    console.log("- Factory Address:", factoryAddress);
    console.log("- WETH Address:", wETHAddress);
    console.log("- ALVA Address:", alvaAddress);
    console.log("\n");
  });

  describe("Platform Fee Configuration", function () {
    it("01- should retrieve the fee configuration", async function () {
      // Get the platform fee configuration from the Factory contract
      const feeConfig = await factory.getPlatformFeeConfig();
      
      // Verify the fee configuration
      expect(feeConfig.feeCollector).to.not.equal(zeroAddress, "Fee collector should not be zero address");
      
      expect(feeConfig.btsCreationFee).to.be.gte(0, "BTS creation fee should be >= 0");
      expect(feeConfig.btsCreationFee).to.be.lte(MAX_FEE, "BTS creation fee should be <= 100%");

      expect(feeConfig.contributionFee).to.be.gte(0, "Contribution fee should be >= 0");
      expect(feeConfig.contributionFee).to.be.lte(MAX_FEE, "Contribution fee should be <= 100%");

      expect(feeConfig.withdrawalFee).to.be.gte(0, "Withdrawal fee should be >= 0");
      expect(feeConfig.withdrawalFee).to.be.lte(MAX_FEE, "Withdrawal fee should be <= 100%");
    });

    it("02- should update the fee config", async function () {
      // Get the current platform fee configuration
      const initialFeeConfig = await factory.getPlatformFeeConfig();
      
      // Define new fee values (within the 0.5% limit)
      // Factory has DEFAULT_FEE = 50 (0.5%) as the maximum allowed fee
      const DEFAULT_FEE = 50; // 0.5% in basis points
      
      // Set fees to 0.3% and 0.4% to ensure they're within the limit
      const newBtsCreationFee = 30; // 0.3%
      const newContributionFee = 40; // 0.4%
      const newWithdrawalFee = 35; // 0.35%
      
      // Only the owner can update the fee configuration
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Update the platform fee configuration
      const tx = await factory.setPlatformFeeConfig(
        newBtsCreationFee,
        newContributionFee,
        newWithdrawalFee
      );
      
      // Log transaction hash with network name
      logHelper.log("02-setPlatformFeeConfig-UpdatePlatformFee", {
        tx: tx.hash,
        btsCreationFee: newBtsCreationFee,
        contributionFee: newContributionFee,
        withdrawalFee: newWithdrawalFee
      }, network.name);
      
      // Wait for the transaction to be mined
      await tx.wait();
      
      // Get the updated platform fee configuration
      const updatedFeeConfig = await factory.getPlatformFeeConfig();
      
      // Verify the updated fee configuration
      expect(updatedFeeConfig.btsCreationFee).to.equal(newBtsCreationFee, "BTS creation fee not updated correctly");
      expect(updatedFeeConfig.contributionFee).to.equal(newContributionFee, "Contribution fee not updated correctly");
      expect(updatedFeeConfig.withdrawalFee).to.equal(newWithdrawalFee, "Withdrawal fee not updated correctly");
    });

    it("03- should fail when setting fee greater than 0.5%", async function () {
      // Get the current platform fee configuration
      const initialFeeConfig = await factory.getPlatformFeeConfig();
      
      // Define invalid fee value (greater than 0.5%)
      const DEFAULT_FEE = 50; // 0.5% in basis points
      const invalidFee = DEFAULT_FEE + 1; // 51 basis points (0.51%)
      
      // Only the owner can update the fee configuration
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Attempt to update with invalid BTS creation fee
      await expect(
        factory.setPlatformFeeConfig(
          invalidFee,
          initialFeeConfig.contributionFee,
          initialFeeConfig.withdrawalFee
        )
      ).to.be.reverted;
      
      // Attempt to update with invalid contribution fee
      await expect(
        factory.setPlatformFeeConfig(
          initialFeeConfig.btsCreationFee,
          invalidFee,
          initialFeeConfig.withdrawalFee
        )
      ).to.be.reverted;
      
      // Attempt to update with invalid withdrawal fee
      await expect(
        factory.setPlatformFeeConfig(
          initialFeeConfig.btsCreationFee,
          initialFeeConfig.contributionFee,
          invalidFee
        )
      ).to.be.reverted;
    });

    it("04- should allow setting fees to 0%", async function () {
      // Get the current platform fee configuration
      const initialFeeConfig = await factory.getPlatformFeeConfig();
      
      // Define zero fees
      const zeroFee = 0; // 0 basis points (0%)
      
      // Only the owner can update the fee configuration
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Update the platform fee configuration to zero
      const tx = await factory.setPlatformFeeConfig(
        zeroFee,
        zeroFee,
        zeroFee
      );
      
      // Log transaction hash with network name
      logHelper.log("04-setPlatformFeeConfig-SetZeroFees", {
        tx: tx.hash,
        btsCreationFee: zeroFee.toString(),
        contributionFee: zeroFee.toString(),
        withdrawalFee: zeroFee.toString()
      }, network.name);
      
      // Wait for the transaction to be mined
      await tx.wait();
      
      // Get the updated platform fee configuration
      const updatedFeeConfig = await factory.getPlatformFeeConfig();
      
      // Verify the fee configuration was updated to zero
      expect(updatedFeeConfig.btsCreationFee).to.equal(zeroFee, "BTS creation fee not updated to zero");
      expect(updatedFeeConfig.contributionFee).to.equal(zeroFee, "Contribution fee not updated to zero");
      expect(updatedFeeConfig.withdrawalFee).to.equal(zeroFee, "Withdrawal fee not updated to zero");

    });

    it("05- should update fee collector to a new valid address", async function () {
      // Get the current fee collector
      const feeConfig = await factory.getPlatformFeeConfig();
      const currentFeeCollector = feeConfig.feeCollector;
      
      // Define new fee collector address
      const newFeeCollector = currentFeeCollector.toLowerCase() === "0xF34BF8485cbB3686aE636dD1E35D4050044bcdbb".toLowerCase() 
        ? "0x3849A0EFcf066F069d638b5Ea9FF645780ef33BF" 
        : "0xF34BF8485cbB3686aE636dD1E35D4050044bcdbb";
      
      // Only the owner can update the fee collector
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Update the fee collector
      const tx = await factory.setFeeCollector(newFeeCollector);
      
      // Log transaction hash with network name
      logHelper.log("05-setFeeCollector-validAddress", {
        tx: tx.hash,
        feeCollector: newFeeCollector
      }, network.name);
      
      await tx.wait();
      
      // Get the updated fee collector
      const updatedFeeConfig = await factory.getPlatformFeeConfig();
      
      // Verify the fee collector was updated
      expect(updatedFeeConfig.feeCollector.toLowerCase()).to.equal(newFeeCollector.toLowerCase(), "Fee collector not updated correctly");
    });
    
    it("06- should fail when setting fee collector to zero address", async function () {
      // Only the owner can update the fee collector
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Attempt to update fee collector to zero address
      await expect(
        factory.setFeeCollector(zeroAddress)
      ).to.be.reverted;
    });
    
    it("07- should fail when setting fee collector to current address", async function () {
      // Get the current fee collector
      const feeConfig = await factory.getPlatformFeeConfig();
      const currentFeeCollector = feeConfig.feeCollector;
      
      // Only the owner can update the fee collector
      // Check if the first signer is the factory owner
      const factoryOwner = await factory.owner();
      
      // If the test signer is not the factory owner, we'll skip the actual update
      if (factoryOwner.toLowerCase() !== owner.address.toLowerCase()) {
        // Skip test if not the owner
        this.skip();
        return;
      }
      
      // Attempt to update fee collector to the same address
      await expect(
        factory.setFeeCollector(currentFeeCollector)
      ).to.be.reverted;
    });

  });

  // After all tests, save the log file
  after(function() {
    logHelper.saveLogFile(network.name);
  });
});
