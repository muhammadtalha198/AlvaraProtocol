const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("AlvaEth", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let alva;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    // Use deployments.fixture to properly deploy the contracts using hardhat-deploy
    // This will follow the same deployment pattern defined in the deploy scripts
    const contractName = "Alvara";
    const tags = ["alva"];  // Tag defined in the deployment script
    
    await deployments.fixture(tags);
    const alvaDeployment = await deployments.get(contractName);
    alva = await ethers.getContractAt(contractName, alvaDeployment.address);
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
    it("Name of token should be Alvara", async function () {
      expect(await alva.name()).be.equal("Alvara");
    });
    it("Symbol of token should be ALVA", async function () {
      expect(await alva.symbol()).to.equal("ALVA");
    });

    it("Total supply of token should be 200_000_000", async function () {
      expect(await alva.totalSupply()).to.equal("200000000000000000000000000");
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
        alva.grantRole(alva.DEFAULT_ADMIN_ROLE(), user2.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(true);
      expect(
        await alva.hasRole(alva.DEFAULT_ADMIN_ROLE(), user2.address)
      ).to.equal(false);
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

  describe("ALVA Transfer-From", function () {
    const amount = "1000000000";
    let totalSupply;
    beforeEach(async function () {
      await alva.transfer(user1.address, amount.toString());
      expect(await alva.balanceOf(user1.address)).to.be.equal(amount);

      totalSupply = await alva.totalSupply();
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
      expect(await alva.balanceOf(owner.address)).to.be.equal(
        "199999999999999998000000000"
      );
    });

    it("Transfer token to admin while listing timestamp is not set yet", async function () {
      alva = alva.connect(user1);

      await alva.approve(owner.address, amount);

      const allowance = await alva.allowance(user1.address, owner.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(owner);
      await alva.transferFrom(user1.address, owner.address, amount);

      expect(await alva.balanceOf(user1.address)).to.be.equal(0);
      expect(await alva.balanceOf(owner.address)).to.be.equal(
        "200000000000000000000000000"
      );
    });

    it("Transfer token from user while listing timestamp is 0 and sender is admin", async function () {
      alva = alva.connect(user1);

      await alva.approve(owner.address, amount);

      const allowance = await alva.allowance(user1.address, owner.address);
      expect(allowance).to.equal(amount);
      alva = alva.connect(owner);

      await alva.transferFrom(user1.address, user2.address, amount);

      expect(await alva.balanceOf(user2.address)).to.be.equal(amount);
      expect(await alva.balanceOf(owner.address)).to.be.equal(
        "199999999999999999000000000"
      );
      expect(await alva.balanceOf(user1.address)).to.be.equal(0);
    });

    it("Transfer token from user while from is allowed for transafer and to doesn't allowed for transfer", async function () {
      const allowedTransferRole = await alva.ALLOWED_TRANSFER_FROM_ROLE();
      alva.grantRole(allowedTransferRole, user1.address);
      alva = alva.connect(user1);
      await alva.approve(user3.address, amount);

      const allowance = await alva.allowance(user1.address, user3.address);
      expect(allowance).to.equal(amount);

      alva = alva.connect(user3);
      await expect(
        alva.transferFrom(user1.address, user4.address, amount)
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
      expect(await alva.balanceOf(owner.address)).to.be.equal(
        "199999999999999999000000000"
      );
      expect(await alva.balanceOf(user1.address)).to.be.equal(0);
    });
  });

  describe("Greylist Management", function () {
    it("Only GREYLIST_MANAGER_ROLE can add to greylist", async function () {
      // Grant greylist manager role to user1
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, user1.address);
      
      // User without role cannot add to greylist
      await expect(
        alva.connect(user2).addToGreyList(user3.address)
      ).to.be.reverted;
      
      // User with role can add to greylist
      await alva.connect(user1).addToGreyList(user3.address);
      expect(await alva.isGreyListed(user3.address)).to.equal(true);
    });

    it("Adding to greylist emits GreyListed event", async function () {
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      await expect(alva.addToGreyList(user1.address))
        .to.emit(alva, "GreyListed")
        .withArgs(user1.address);
    });
    
    it("Removing from greylist emits RemovedFromGreyList event", async function () {
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      await alva.addToGreyList(user1.address);
      expect(await alva.isGreyListed(user1.address)).to.equal(true);
      
      await expect(alva.removeFromGreyList(user1.address))
        .to.emit(alva, "RemovedFromGreyList")
        .withArgs(user1.address);
    });
    
    it("Cannot add already greylisted address", async function () {
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      await alva.addToGreyList(user1.address);
      
      await expect(
        alva.addToGreyList(user1.address)
      ).to.be.revertedWithCustomError(alva, "AddressAlreadyGreylisted");
    });
    
    it("Cannot remove address not in greylist", async function () {
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      await expect(
        alva.removeFromGreyList(user1.address)
      ).to.be.revertedWithCustomError(alva, "AddressNotInGreyList");
    });
  });
  
  describe("Burn Functionality with Restrictions", function () {
    const burnAmount = ethers.parseEther("10");
    
    beforeEach(async function () {
      // Transfer tokens to users for burning
      await alva.transfer(user1.address, ethers.parseEther("100"));
      await alva.transfer(user2.address, ethers.parseEther("100"));
    });
    
    it("User can burn their own tokens", async function () {
      const initialBalance = await alva.balanceOf(user1.address);
      await alva.connect(user1).burn(burnAmount);
      const finalBalance = await alva.balanceOf(user1.address);
      
      expect(finalBalance).to.equal(initialBalance - burnAmount);
    });
    
    it("Greylisted user can still burn tokens", async function () {
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      // Add user2 to greylist
      await alva.addToGreyList(user2.address);
      
      // Verify user is greylisted
      expect(await alva.isGreyListed(user2.address)).to.equal(true);
      
      // Greylisted user can still burn tokens since burn doesn't use _transfer
      const initialBalance = await alva.balanceOf(user2.address);
      await alva.connect(user2).burn(burnAmount);
      const finalBalance = await alva.balanceOf(user2.address);
      
      expect(finalBalance).to.equal(initialBalance - burnAmount);
    });
    
    it("Burning reduces total supply", async function () {
      const initialSupply = await alva.totalSupply();
      
      // User1 burns tokens
      await alva.connect(user1).burn(burnAmount);
      
      const finalSupply = await alva.totalSupply();
      expect(finalSupply).to.equal(initialSupply - burnAmount);
    });
  });

  describe("Combined Functionality Tests", function () {
    const amount = ethers.parseEther("50");
    
    beforeEach(async function () {
      await alva.transfer(user1.address, ethers.parseEther("100"));
    });
    
    it("Cannot transferFrom when sender is greylisted even if allowed", async function () {
      // Grant roles
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      const allowedRole = await alva.ALLOWED_TRANSFER_FROM_ROLE();
      await alva.grantRole(allowedRole, user2.address);
      
      // Set up approval
      await alva.connect(user1).approve(owner.address, amount);
      
      // Add user1 to greylist
      await alva.addToGreyList(user1.address);
      
      // Attempt transferFrom - should fail due to greylist
      await expect(
        alva.transferFrom(user1.address, user3.address, amount)
      ).to.be.revertedWithCustomError(alva, "ActionRestricted");
    });
    
    it("Greylisted user can receive tokens but cannot send them", async function () {
      const greylistRole = await alva.GREYLIST_MANAGER_ROLE();
      await alva.grantRole(greylistRole, owner.address);
      
      // Add user1 to greylist
      await alva.addToGreyList(user1.address);
      
      // User1 can receive tokens
      await alva.transfer(user1.address, amount);
      const balanceAfterReceive = await alva.balanceOf(user1.address);
      expect(balanceAfterReceive).to.equal(ethers.parseEther("150"));
      
      // User1 cannot send tokens
      await expect(
        alva.connect(user1).transfer(user2.address, amount)
      ).to.be.revertedWithCustomError(alva, "ActionRestricted");
    });
    
    it("Past listing time makes transferFrom unrestricted regardless of roles", async function () {
      // Set listing timestamp to past
      const pastTime = 1;
      await alva.setListingTimestamp(pastTime);
      
      // Setup approval
      await alva.connect(user1).approve(user3.address, amount);
      
      // User3 (not whitelisted) should be able to transferFrom
      await alva.connect(user3).transferFrom(user1.address, user3.address, amount);
      
      // Check balance
      expect(await alva.balanceOf(user3.address)).to.equal(amount);
    });
  });
});
