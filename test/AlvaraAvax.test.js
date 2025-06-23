const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("AlvaAvax", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let alva;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    const ALVA = await ethers.getContractFactory("AlvaraAvax");
    alva = await upgrades.deployProxy(ALVA);
    await alva.waitForDeployment();
  });

  describe("Initialize Values", function () {
    it("initial value of timestamp should be zero", async function () {
      expect(await alva.listingTimestamp()).to.be.equal(0);
    });
    it("msg sender has default-admin-role", async function () {
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(true);
    });
    it("msg sender has minter role", async function () {
      expect(await alva.hasRole(alva.MINTER_ROLE(), owner.address)).to.equal(
        true
      );
    });
    it("msg sender has burner role", async function () {
      expect(await alva.hasRole(alva.BURN_ROLE(), owner.address)).to.equal(
        true
      );
    });

    it("msg sender will be the owner", async function () {
      const ownerAddress = await alva.owner();
      expect(ownerAddress).to.equal(owner.address);
    });

    it("msg sender doesn't have ALLOWED_TRANSFER_FROM_ROLE", async function () {
      expect(
        await alva.hasRole(alva.ALLOWED_TRANSFER_FROM_ROLE(), owner.address)
      ).to.equal(false);
    });
  });

  describe("Granting Roles", function () {
    it("granting & revoking admin role", async function () {
      await alva.grantRole(alva.DEFAULT_ADMIN_ROLE(), user1.address);
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(true);
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), user1.address)
      ).to.equal(true);

      await alva.revokeRole(alva.DEFAULT_ADMIN_ROLE(), owner.address);
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(false);
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), user1.address)
      ).to.equal(true);
    });

    it("granting & revoking minter role", async function () {
      await alva.grantRole(alva.MINTER_ROLE(), user1.address);
      expect(await alva.hasRole(alva.MINTER_ROLE(), owner.address)).to.equal(
        true
      );
      expect(await alva.hasRole(alva.MINTER_ROLE(), user1.address)).to.equal(
        true
      );

      await alva.revokeRole(alva.MINTER_ROLE(), owner.address);
      expect(await alva.hasRole(alva.MINTER_ROLE(), owner.address)).to.equal(
        false
      );
      expect(await alva.hasRole(alva.MINTER_ROLE(), user1.address)).to.equal(
        true
      );
    });

    it("granting & revoking burn role", async function () {
      await alva.grantRole(alva.BURN_ROLE(), user1.address);
      expect(await alva.hasRole(alva.BURN_ROLE(), owner.address)).to.equal(
        true
      );
      expect(await alva.hasRole(alva.BURN_ROLE(), user1.address)).to.equal(
        true
      );

      await alva.revokeRole(alva.BURN_ROLE(), owner.address);
      expect(await alva.hasRole(alva.BURN_ROLE(), owner.address)).to.equal(
        false
      );
      expect(await alva.hasRole(alva.BURN_ROLE(), user1.address)).to.equal(
        true
      );
    });

    it("granting & revoking ALLOWED_TRANSFER_FROM_ROLE", async function () {
      await alva.grantRole(alva.ALLOWED_TRANSFER_FROM_ROLE(), user1.address);
      expect(
        await alva.hasRole(alva.ALLOWED_TRANSFER_FROM_ROLE(), owner.address)
      ).to.equal(false);
      expect(
        await alva.hasRole(alva.ALLOWED_TRANSFER_FROM_ROLE(), user1.address)
      ).to.equal(true);
    });

    it("Only admin can grant role", async function () {
      alva = alva.connect(user1);
      const adminRole = await alva.DEFAULT_ADMIN_ROLE();
      await expect(
        alva.grantRole(alva.BURN_ROLE(), user2.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
      expect(await alva.hasRole(alva.BURN_ROLE(), owner.address)).to.equal(
        true
      );
      expect(await alva.hasRole(alva.BURN_ROLE(), user2.address)).to.equal(
        false
      );
    });
  });

  describe("ALVA setListingTimestamp", function () {
    it("setting timestamp from other user", async () => {
      const DEFAULT_ADMIN_ROLE = await alva.DEFAULT_ADMIN_ROLE();
      expect(
        alva.connect(user1).setListingTimestamp(10)
      ).to.be.revertedWith.toString(
        `AccessControl: account ${user1.address} is missing role ${DEFAULT_ADMIN_ROLE}`
      );
    });

    it("setting timestamp from admin", async () => {
      await alva.setListingTimestamp(10);
      expect(await alva.listingTimestamp()).to.equal(10);
    });
    it("setting timestamp once it is already set", async () => {
      await alva.setListingTimestamp(100);
      expect(await alva.listingTimestamp()).to.equal(100);

      await expect(alva.setListingTimestamp(150)).to.be.rejectedWith(
        "TokenAlreadyListed"
      );
    });

    it("setting timestamp in past", async () => {
      let timestamp = parseInt(Date.now() / 1000) + 1000;

      const newTime = timestamp + 1000;
      await alva.setListingTimestamp(newTime);
      expect(await alva.listingTimestamp()).to.equal(newTime);
      await alva.setListingTimestamp(timestamp);
      expect(await alva.listingTimestamp()).to.equal(timestamp);
    });
  });

  describe("ALVA Minting", function () {
    it("Only Owner can mint", async function () {
      await alva.mint(user1.address, "10000000000000000000");
      expect(await alva.balanceOf(user1.address)).to.be.equal(
        "10000000000000000000"
      );
    });
    it("Failed if non-Owner mint", async function () {
      const mintRole = await alva.MINTER_ROLE();
      await expect(
        alva.connect(user1).mint(user2.address, "10000000000000000000")
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${mintRole}`
      );
    });

    it("Mint after granting role", async function () {
      await alva.grantRole(alva.MINTER_ROLE(), user1.address);
      expect(await alva.hasRole(alva.MINTER_ROLE(), user1.address)).to.equal(
        true
      );

      await alva.connect(user1).mint(user3.address, "10000000000000000000");
      expect(await alva.balanceOf(user3.address)).to.be.equal(
        "10000000000000000000"
      );
    });

    it("Mint from owner after granting role", async function () {
      await alva.grantRole(alva.MINTER_ROLE(), user1.address);
      expect(await alva.hasRole(alva.MINTER_ROLE(), user1.address)).to.equal(
        true
      );

      await alva.mint(user4.address, "10000000000000000000");
      expect(await alva.balanceOf(user4.address)).to.be.equal(
        "10000000000000000000"
      );
    });

    it("Mint from owner after revoking role", async function () {
      const minterRole = await alva.MINTER_ROLE();
      await alva.grantRole(alva.MINTER_ROLE(), user1.address);
      expect(await alva.hasRole(alva.MINTER_ROLE(), user1.address)).to.equal(
        true
      );

      await alva.revokeRole(alva.MINTER_ROLE(), owner.address);
      expect(await alva.hasRole(alva.MINTER_ROLE(), owner.address)).to.equal(
        false
      );

      await expect(
        alva.mint(user2.address, "10000000000000000000")
      ).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${minterRole}`
      );
    });
  });

  describe("ALVA Burning", function () {
    const amount = "1000000000";
    beforeEach(async function () {
      await alva.mint(user1.address, amount.toString());
      expect(await alva.balanceOf(user1.address)).to.be.equal(amount);
    });

    it("Only Owner can burn", async function () {
      const supply = await alva.totalSupply();
      expect(supply).to.equal(amount);
      let user1Balance = await alva.balanceOf(user1.address);
      expect(user1Balance).to.equal(amount);

      await alva["burn(address, uint256)"](user1.address, amount);

      let newUser1Balance = await alva.balanceOf(user1.address);

      expect(newUser1Balance).to.equal(0);

      const newSupply = await alva.totalSupply();
      expect(newSupply).to.equal(0);
    });

    it("Failed if non-Owner burn", async function () {
      const burnRole = await alva.BURN_ROLE();
      await expect(
        alva.connect(user2)["burn(address, uint256)"](user1.address, amount)
      ).to.be.revertedWith(
        `AccessControl: account ${user2.address.toLowerCase()} is missing role ${burnRole}`
      );
    });

    it("Burn after granting role", async function () {
      await alva.grantRole(alva.BURN_ROLE(), user2.address);
      expect(await alva.hasRole(alva.BURN_ROLE(), user2.address)).to.equal(
        true
      );

      await alva
        .connect(user2)
        ["burn(address, uint256)"](user1.address, amount);
      let newUser1Balance = await alva.balanceOf(user1.address);

      expect(newUser1Balance).to.equal(0);
      const newSupply = await alva.totalSupply();
      expect(newSupply).to.equal(0);
    });

    it("Burn from owner after granting role", async function () {
      await alva.grantRole(alva.BURN_ROLE(), user2.address);
      expect(await alva.hasRole(alva.BURN_ROLE(), user2.address)).to.equal(
        true
      );

      await alva["burn(address, uint256)"](user1.address, amount);

      let newUser1Balance = await alva.balanceOf(user1.address);

      expect(newUser1Balance).to.equal(0);

      const newSupply = await alva.totalSupply();
      expect(newSupply).to.equal(0);
    });

    it("Burn from owner after revoking role", async function () {
      const burnRole = await alva.BURN_ROLE();
      await alva.grantRole(alva.BURN_ROLE(), user2.address);
      expect(await alva.hasRole(alva.BURN_ROLE(), user2.address)).to.equal(
        true
      );

      await alva.revokeRole(alva.BURN_ROLE(), owner.address);
      expect(await alva.hasRole(alva.BURN_ROLE(), owner.address)).to.equal(
        false
      );

      await expect(
        alva["burn(address, uint256)"](user1.address, amount)
      ).to.be.revertedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${burnRole}`
      );
    });
  });

  describe("ALVA Transfer-From", function () {
    const amount = "1000000000";
    beforeEach(async function () {
      await alva.mint(user1.address, amount.toString());
      expect(await alva.balanceOf(user1.address)).to.be.equal(amount);

      await alva.mint(owner.address, amount.toString());
      expect(await alva.balanceOf(owner.address)).to.be.equal(amount);

      const supply = await alva.totalSupply();
      expect(supply).to.equal(amount * 2);
    });

    it("Transfer token from user while listing timestamp is not set yet", async function () {
      alva = alva.connect(user1);
      await alva.approve(user2.address, amount);

      const allowance = await alva.allowance(user1.address, user2.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(user2);
      await expect(
        alva.transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(alva, "SupervisedTranferFrom");
    });

    it("Transfer token from user while listing timestamp is greater then block timestamp", async function () {
      let timestamp = parseInt(Date.now() / 1000) + 1000;

      const newTime = timestamp + 1000;

      alva.setListingTimestamp(newTime);

      alva = alva.connect(user1);
      await alva.approve(user2.address, amount);

      const allowance = await alva.allowance(user1.address, user2.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(user2);
      await expect(
        alva.transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(alva, "SupervisedTranferFrom");
    });

    it("Transfer token from admin while listing timestamp is not set yet", async function () {
      await alva.approve(user2.address, amount);

      const allowance = await alva.allowance(owner.address, user2.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(user2);
      await alva.transferFrom(owner.address, user2.address, amount);

      expect(await alva.balanceOf(user2.address)).to.be.equal(amount);
      expect(await alva.balanceOf(owner.address)).to.be.equal(0);
    });

    it("Transfer token to admin while listing timestamp is not set yet", async function () {
      alva = alva.connect(user1);

      await alva.approve(owner.address, amount);

      const allowance = await alva.allowance(user1.address, owner.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(owner);
      await alva.transferFrom(user1.address, owner.address, amount);

      expect(await alva.balanceOf(user1.address)).to.be.equal(0);
      expect(await alva.balanceOf(owner.address)).to.be.equal(2 * amount);
    });

    it("Transfer token from user while listing timestamp is 0 and sender is admin", async function () {
      alva = alva.connect(user1);

      await alva.approve(owner.address, amount);

      const allowance = await alva.allowance(user1.address, owner.address);
      expect(allowance).to.equal(amount);
      alva = alva.connect(owner);

      await alva.transferFrom(user1.address, user2.address, amount);

      expect(await alva.balanceOf(user2.address)).to.be.equal(amount);
      expect(await alva.balanceOf(owner.address)).to.be.equal(amount);
      expect(await alva.balanceOf(user1.address)).to.be.equal(0);
    });

    it("Transfer token from user while from is allowed for transafer and to doesn't allowed for transfer", async function () {
      const allowedTransferRole = await alva.ALLOWED_TRANSFER_FROM_ROLE();
      alva.grantRole(allowedTransferRole, user1.address);
      alva = alva.connect(user1);
      await alva.approve(user2.address, amount);

      const allowance = await alva.allowance(user1.address, user2.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(user2);
      await expect(
        alva.transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(alva, "SupervisedTranferFrom");
    });

    it("Transfer token from user while from is not allowed for transafer but to is allowed for transfer", async function () {
      const allowedTransferRole = await alva.ALLOWED_TRANSFER_FROM_ROLE();
      alva.grantRole(allowedTransferRole, user2.address);
      alva = alva.connect(user1);
      await alva.approve(user2.address, amount);

      const allowance = await alva.allowance(user1.address, user2.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(user2);
      await alva.transferFrom(user1.address, user2.address, amount);

      expect(await alva.balanceOf(user2.address)).to.be.equal(amount);
      expect(await alva.balanceOf(owner.address)).to.be.equal(amount);
      expect(await alva.balanceOf(user1.address)).to.be.equal(0);
    });
  });

  describe("Additional Edge Cases", function () {
    const zeroAmount = "0";
    const smallAmount = "1000";
    const largeAmount = "1000000000";

    beforeEach(async function () {
      await alva.mint(user1.address, largeAmount);
    });

    it("Should handle zero amount in mint function", async function () {
      // Mint zero tokens - should work but not change balance
      const initialSupply = await alva.totalSupply();
      await alva.mint(user2.address, zeroAmount);
      
      // Balance should be zero
      expect(await alva.balanceOf(user2.address)).to.equal(zeroAmount);
      
      // Total supply shouldn't change
      expect(await alva.totalSupply()).to.equal(initialSupply);
    });

    it("Should handle zero amount in burn function", async function () {
      // Grant burn role to user2
      await alva.grantRole(alva.BURN_ROLE(), user2.address);
      
      // Initial balance and supply
      const initialBalance = await alva.balanceOf(user1.address);
      const initialSupply = await alva.totalSupply();
      
      // Burn zero tokens - explicitly call burn(address,uint256) to avoid ambiguity
      await alva.connect(user2)["burn(address,uint256)"](user1.address, zeroAmount);
      
      // Balance and supply shouldn't change
      expect(await alva.balanceOf(user1.address)).to.equal(initialBalance);
      expect(await alva.totalSupply()).to.equal(initialSupply);
    });

    it("Should handle exactly matching listingTimestamp (time boundary test)", async function () {
      // Set up a timestamp that we'll match exactly
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const currentTimestamp = blockBefore.timestamp;
      
      // Set the listing timestamp to current block timestamp
      await alva.setListingTimestamp(currentTimestamp);
      
      // The next transaction will be in a new block with timestamp > currentTimestamp
      // So transfers should be unrestricted
      
      // Set up for transferFrom
      await alva.connect(user1).approve(user2.address, smallAmount);
      
      // This should succeed because we're at the boundary where restrictions are lifted
      await alva.connect(user2).transferFrom(user1.address, user2.address, smallAmount);
      
      // Verify the transfer worked
      expect(await alva.balanceOf(user2.address)).to.equal(smallAmount);
    });

    it("Standard transfer should work for non-greylisted addresses", async function () {
      // Direct transfer (not transferFrom)
      await alva.connect(user1).transfer(user3.address, smallAmount);
      
      // Verify the transfer worked
      expect(await alva.balanceOf(user3.address)).to.equal(smallAmount);
    });

    it("Should handle complex role and listing timestamp interaction", async function () {
      // First set up future listing timestamp
      let futureTimestamp = (await ethers.provider.getBlock()).timestamp + 1000;
      await alva.setListingTimestamp(futureTimestamp);
      
      // Grant allowed transfer role to user3
      await alva.grantRole(alva.ALLOWED_TRANSFER_FROM_ROLE(), user3.address);
      
      // Setup approval
      await alva.connect(user1).approve(user2.address, smallAmount);
      
      // Case 1: Non-admin, non-allowed destination - should fail
      await expect(
        alva.connect(user2).transferFrom(user1.address, user2.address, smallAmount)
      ).to.be.revertedWithCustomError(alva, "SupervisedTranferFrom");
      
      // Case 2: Non-admin to allowed destination - should succeed
      await alva.connect(user2).transferFrom(user1.address, user3.address, smallAmount);
      expect(await alva.balanceOf(user3.address)).to.equal(smallAmount);
      
      // Case 3: Admin sender overrides restrictions
      await alva.connect(user1).approve(owner.address, smallAmount);
      await alva.transferFrom(user1.address, user4.address, smallAmount);
      expect(await alva.balanceOf(user4.address)).to.equal(smallAmount);
      
      // Now set timestamp to 0 (special case in WithSupervisedTransfersAvax)
      await alva.setListingTimestamp(0);
      
      // Case 4: With timestamp=0, transfers still supervised
      await alva.connect(user1).approve(user2.address, smallAmount);
      await expect(
        alva.connect(user2).transferFrom(user1.address, user5.address, smallAmount)
      ).to.be.revertedWithCustomError(alva, "SupervisedTranferFrom");
    });
  });

  describe("ALVA Ownable", function () {
    it("Transfer-ownership can transfer the ownership to new address", async function () {
      const ownerAddress = await alva.owner();
      expect(ownerAddress).to.equal(owner.address);

      await alva.transferOwnership(user1.address);

      const newOwnerAddress = await alva.owner();
      expect(newOwnerAddress).to.equal(user1.address);
    });

    it("Only current owner can transfer the ownership", async function () {
      const ownerAddress = await alva.owner();
      expect(ownerAddress).to.equal(owner.address);

      await alva.transferOwnership(user1.address);

      const newOwnerAddress = await alva.owner();
      expect(newOwnerAddress).to.equal(user1.address);

      await expect(alva.transferOwnership(user3.address)).to.be.rejectedWith(
        "Ownable: caller is not the owner"
      );
    });
  });
});
