const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("AlvaV2", function () {
  let accounts;
  let tokenContract;

  beforeEach(async () => {
    accounts = await ethers.getSigners();

    const contractName = "Alvara"
    const tags = ["alva"];

    const allDeployments = await deployments.fixture(tags);
    // console.log("allDeployments : ", allDeployments)
    tokenContract = await ethers.getContractAt(contractName, allDeployments[contractName].address);
  })

  describe("Initialize Values", async () => {
    
    it("Token Name should be set",async () => {
      expect(await tokenContract.name()).to.be.equal("Alvara")      
    })

    it("Token Symbol should be set",async () => {
      expect(await tokenContract.symbol()).to.be.equal("ALVA")      
    })

    it("Token Supply should be 200_000_000", async () => {
      expect(await tokenContract.totalSupply()).to.be.equal(ethers.parseEther("200000000"))      
    })

  })

  describe("Transfer tokens", async () => {

    beforeEach(async () => {
      const time = 10;
      await tokenContract.setListingTimestamp(time);
    })
  
    
    it("Admin can transfer to any user", async () => {
      //user initial balance should be 0
      const user1 = accounts[1];
      const userInitialBalance = await tokenContract.balanceOf(user1.address);
      expect(userInitialBalance).to.be.equal(0);

      const amount = ethers.parseEther("100");
      await tokenContract.transfer(user1.address, amount); 
      
      const userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount);

    })

    it("User 1 can transfer to user 2",async () => {
      //user initial balance should be 0
      const user1 = accounts[1];
      const user2 = accounts[2];

      const userInitialBalance = await tokenContract.balanceOf(user1.address);
      expect(userInitialBalance).to.be.equal(0);

      const user2InitialBalance = await tokenContract.balanceOf(user2.address);
      expect(user2InitialBalance).to.be.equal(0);

      const amount = ethers.parseEther("100");
      await tokenContract.transfer(user1.address, amount); 
      
      const userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount);


      const amount2 = ethers.parseEther("20");
      await tokenContract.connect(user1).transfer(user2.address, amount2); 
      
      const user2PostBalance = await tokenContract.balanceOf(user2.address);
      expect(user2PostBalance).to.be.equal(amount2);

    })

    it("User can transfer to any other user if that is blocked", async () => {
      const owner = accounts[0];
      //user initial balance should be 0
      const user1 = accounts[1];
      const userInitialBalance = await tokenContract.balanceOf(user1.address);
      expect(userInitialBalance).to.be.equal(0);

      const amount = ethers.parseEther("100");

      //grant role
      const transferManagerRole = await tokenContract.GREYLIST_MANAGER_ROLE();
      await tokenContract.grantRole(transferManagerRole,owner.address);

      //check if address added in the list ?
      let isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(false);

      await tokenContract.addToGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(true);


      // await  expect(tokenContract.transfer(user1.address, amount)).to.be.rejectedWith("TransferBlocked()"); 
      await tokenContract.transfer(user1.address, amount); 
      
      let userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount);

      //admin can send after unblock user
      await tokenContract.removeFromGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(false);


      await tokenContract.transfer(user1.address, amount); 
      
      userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount*2n);


    })

    it("User can't transfer to other user if blocked", async () => {
      const owner = accounts[0];
      //user initial balance should be 0
      const user1 = accounts[1];
      const user2 = accounts[2];

      const userInitialBalance = await tokenContract.balanceOf(user1.address);
      expect(userInitialBalance).to.be.equal(0);

      const user2InitialBalance = await tokenContract.balanceOf(user2.address);
      expect(user2InitialBalance).to.be.equal(0);

      const amount = ethers.parseEther("100");

      //grant role
      const transferManagerRole = await tokenContract.GREYLIST_MANAGER_ROLE();
      await tokenContract.grantRole(transferManagerRole,owner.address);

      //check if address added in the list ?
      let isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(false);

      await tokenContract.addToGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(true);


      // await  expect(tokenContract.transfer(user1.address, amount)).to.be.rejectedWith("TransferBlocked()"); 
      await tokenContract.transfer(user1.address, amount); 
      
      let userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount);

      //admin can send after unblock user
      await tokenContract.removeFromGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(false);


      await tokenContract.transfer(user1.address, amount); 
      
      userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount*2n);

      const amount2 = ethers.parseEther("30");
      await tokenContract.addToGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(true);

      await  expect(tokenContract.connect(user1).transfer(user2.address, amount2)).to.be.rejectedWith("ActionRestricted()"); 

    })

    it("User can't transfer to other user if blocked via transferFrom", async () => {
      const owner = accounts[0];
      //user initial balance should be 0
      const user1 = accounts[1];
      const user2 = accounts[2];

      const userInitialBalance = await tokenContract.balanceOf(user1.address);
      expect(userInitialBalance).to.be.equal(0);

      const user2InitialBalance = await tokenContract.balanceOf(user2.address);
      expect(user2InitialBalance).to.be.equal(0);

      const amount = ethers.parseEther("100");

      //grant role
      const transferManagerRole = await tokenContract.GREYLIST_MANAGER_ROLE();
      await tokenContract.grantRole(transferManagerRole,owner.address);

      //check if address added in the list ?
      let isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(false);

      await tokenContract.addToGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(true);


      // await  expect(tokenContract.transfer(user1.address, amount)).to.be.rejectedWith("TransferBlocked()"); 
      await tokenContract.transfer(user1.address, amount); 
      
      let userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount);

      //admin can send after unblock user
      await tokenContract.removeFromGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(false);


      await tokenContract.transfer(user1.address, amount); 
      
      userPostBalance = await tokenContract.balanceOf(user1.address);
      expect(userPostBalance).to.be.equal(amount*2n);

      const amount2 = ethers.parseEther("30");
      await tokenContract.addToGreyList(user1.address);

      //check if address added in the list ?
      isUserBlocked = await tokenContract.isGreyListed(user1.address);
      expect(isUserBlocked).to.be.equal(true);

      await  expect(tokenContract.connect(user1).transfer(user2.address, amount2)).to.be.rejectedWith("ActionRestricted()"); 


      await tokenContract.connect(user1).approve(user2.address, amount2);

      const approvedTokens = await tokenContract.allowance(user1.address, user2.address);
      expect(approvedTokens).to.be.equal(amount2);

      await  expect(tokenContract.connect(user2).transferFrom(user1.address, user2.address, amount2)).to.be.rejectedWith("ActionRestricted()"); 

    })

  })

  describe("Burn tokens", async () => {
    it("Admin can burn own tokens", async () => {
      const initialSupply = await tokenContract.totalSupply();
      const burnAmount = ethers.parseEther("100");
      
      await tokenContract.burn(burnAmount);
      
      const finalSupply = await tokenContract.totalSupply();
      expect(finalSupply).to.be.equal(initialSupply - burnAmount);
    });

    it("User can burn own tokens", async () => {
      const user1 = accounts[1];
      const amount = ethers.parseEther("100");
      const burnAmount = ethers.parseEther("50");

      // Transfer tokens to user
      await tokenContract.transfer(user1.address, amount);
      
      // User burns tokens
      await tokenContract.connect(user1).burn(burnAmount);
      
      const userBalance = await tokenContract.balanceOf(user1.address);
      expect(userBalance).to.be.equal(amount - burnAmount);
    });
  });

  describe("Supervised transfers", async () => {
    it("Before listing, only admin and whitelisted can receive transferFrom", async () => {
      const owner = accounts[0];
      const user1 = accounts[1];
      const user2 = accounts[2];
      const amount = ethers.parseEther("100");
      
      // Set listing timestamp to future
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      await tokenContract.setListingTimestamp(futureTime);
      
      // Transfer tokens to user1
      await tokenContract.transfer(user1.address, amount);
      
      // User1 approves user2 to spend tokens
      await tokenContract.connect(user1).approve(user2.address, amount);
      
      // User2 attempts to transferFrom user1 to user2 should fail
      await expect(
        tokenContract.connect(user2).transferFrom(user1.address, user2.address, amount)
      ).to.be.revertedWithCustomError(tokenContract, "SupervisedTranferFrom");
      
      // Add user2 to ALLOWED_TRANSFER_FROM_ROLE
      const allowedRole = await tokenContract.ALLOWED_TRANSFER_FROM_ROLE();
      await tokenContract.grantRole(allowedRole, user2.address);
      
      // Now transferFrom should succeed
      await tokenContract.connect(user2).transferFrom(user1.address, user2.address, amount);
      expect(await tokenContract.balanceOf(user2.address)).to.equal(amount);
    });
    
    it("After listing, anyone can use transferFrom", async () => {
      const user1 = accounts[1];
      const user2 = accounts[2];
      const user3 = accounts[3];
      const amount = ethers.parseEther("100");
      
      // Set listing timestamp to past
      const pastTime = 1; // Very old timestamp
      await tokenContract.setListingTimestamp(pastTime);
      
      // Transfer tokens to user1
      await tokenContract.transfer(user1.address, amount);
      
      // User1 approves user3 to spend tokens
      await tokenContract.connect(user1).approve(user3.address, amount);
      
      // User3 (not whitelisted) should be able to transferFrom after listing
      await tokenContract.connect(user3).transferFrom(user1.address, user3.address, amount);
      expect(await tokenContract.balanceOf(user3.address)).to.equal(amount);
    });
    
    it("Cannot change listing timestamp after token is listed", async () => {
      // Set listing timestamp to past
      const pastTime = 1; // Very old timestamp
      await tokenContract.setListingTimestamp(pastTime);
      
      // Attempt to change listing timestamp should fail
      const newTime = Math.floor(Date.now() / 1000) + 3600;
      await expect(
        tokenContract.setListingTimestamp(newTime)
      ).to.be.revertedWithCustomError(tokenContract, "TokenAlreadyListed");
    });
  });

  describe("Role management", async () => {
    it("Only admin can grant greylist manager role", async () => {
      const user1 = accounts[1];
      const user2 = accounts[2];
      
      // Admin grants role to user1
      const greylistRole = await tokenContract.GREYLIST_MANAGER_ROLE();
      await tokenContract.grantRole(greylistRole, user1.address);
      
      // Verify user1 has the role
      expect(await tokenContract.hasRole(greylistRole, user1.address)).to.be.true;
      
      // User1 (not admin) attempts to grant role to user2 should fail
      await expect(
        tokenContract.connect(user1).grantRole(greylistRole, user2.address)
      ).to.be.reverted;
    });
    
    it("Greylist errors are handled correctly", async () => {
      const user1 = accounts[1];
      
      // Grant greylist manager role to admin
      const greylistRole = await tokenContract.GREYLIST_MANAGER_ROLE();
      await tokenContract.grantRole(greylistRole, accounts[0].address);
      
      // Add user1 to greylist
      await tokenContract.addToGreyList(user1.address);
      
      // Attempting to add already greylisted address should fail
      await expect(
        tokenContract.addToGreyList(user1.address)
      ).to.be.revertedWithCustomError(tokenContract, "AddressAlreadyGreylisted");
      
      // Remove user1 from greylist
      await tokenContract.removeFromGreyList(user1.address);
      
      // Attempting to remove address not in greylist should fail
      await expect(
        tokenContract.removeFromGreyList(user1.address)
      ).to.be.revertedWithCustomError(tokenContract, "AddressNotInGreyList");
    });
  });
});
