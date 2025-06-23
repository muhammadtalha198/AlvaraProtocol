const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("veALVA", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let veAlva;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    // Use the specific veAlva tag for deployment
    await deployments.fixture(["veAlva"]);
    
    // Get the deployed contract
    const veALVADeployment = await deployments.get("veALVA");
    
    // Get the contract instance
    veAlva = await ethers.getContractAt("veALVA", veALVADeployment.address);
  });

  describe("Initialize Values", function () {
    it("msg sender has default-admin-role", async function () {
      expect(
        await veAlva.hasRole(veAlva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(true);
    });

    it("Name should be vote-escrowed ALVA", async function () {
      expect(await veAlva.name()).to.equal("vote-escrowed ALVA");
    });

    it("Symbol should be veALVA", async function () {
      expect(await veAlva.symbol()).to.equal("veALVA");
    });
  });

  describe("Granting Roles", function () {
    it("granting & revoking default admin role", async function () {
      await veAlva.grantRole(veAlva.DEFAULT_ADMIN_ROLE(), user1.address);
      expect(
        await veAlva.hasRole(veAlva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(true);
      expect(
        await veAlva.hasRole(veAlva.DEFAULT_ADMIN_ROLE(), user1.address)
      ).to.equal(true);

      await veAlva.revokeRole(veAlva.DEFAULT_ADMIN_ROLE(), owner.address);
      expect(
        await veAlva.hasRole(veAlva.DEFAULT_ADMIN_ROLE(), owner.address)
      ).to.equal(false);
      expect(
        await veAlva.hasRole(veAlva.DEFAULT_ADMIN_ROLE(), user1.address)
      ).to.equal(true);
    });

    it("granting & revoking admin role", async function () {
      await veAlva.grantRole(veAlva.ADMIN_ROLE(), user1.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), owner.address)).to.equal(
        false
      );
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user1.address)).to.equal(
        true
      );

      await veAlva.revokeRole(veAlva.ADMIN_ROLE(), user1.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user1.address)).to.equal(
        false
      );
    });

    it("Only admin can grant role", async function () {
      veAlva = veAlva.connect(user1);
      const adminRole = await veAlva.DEFAULT_ADMIN_ROLE();
      await expect(
        veAlva.grantRole(veAlva.DEFAULT_ADMIN_ROLE(), user2.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
    });

    it("Only default admin can grant role", async function () {
      veAlva = veAlva.connect(user1);
      const adminRole = await veAlva.DEFAULT_ADMIN_ROLE();
      await expect(
        veAlva.grantRole(veAlva.ADMIN_ROLE(), user2.address)
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${adminRole}`
      );
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user2.address)).to.equal(
        false
      );

      //Now adding role from default admin
      await veAlva.connect(owner).grantRole(veAlva.ADMIN_ROLE(), user2.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user2.address)).to.equal(
        true
      );
    });
  });

  describe("Minting", function () {
    it("Only Admin can mint", async function () {
      const adminRole = await veAlva.ADMIN_ROLE();

      await veAlva.grantRole(adminRole, user1.address);

      await expect(
        veAlva.mint(user1.address, "10000000000000000000")
      ).to.be.rejectedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${adminRole}`
      );

      await veAlva.connect(user1).mint(user2.address, "10000000000000000000");

      expect(await veAlva.balanceOf(user2.address)).to.be.equal(
        "10000000000000000000"
      );
    });
    it("Mint after granting role", async function () {
      await veAlva.grantRole(veAlva.ADMIN_ROLE(), owner.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), owner.address)).to.equal(
        true
      );

      await veAlva.mint(user3.address, "10000000000000000000");
      expect(await veAlva.balanceOf(user3.address)).to.be.equal(
        "10000000000000000000"
      );
    });

    it("Mint from admin after revoking role", async function () {
      const minterRole = await veAlva.ADMIN_ROLE();
      await veAlva.grantRole(veAlva.ADMIN_ROLE(), user1.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user1.address)).to.equal(
        true
      );

      await veAlva.connect(user1).mint(user3.address, "10000000000000000000");
      expect(await veAlva.balanceOf(user3.address)).to.be.equal(
        "10000000000000000000"
      );

      await veAlva.revokeRole(veAlva.ADMIN_ROLE(), user1.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user1.address)).to.equal(
        false
      );

      await expect(
        veAlva.connect(user1).mint(user2.address, "10000000000000000000")
      ).to.be.revertedWith(
        `AccessControl: account ${user1.address.toLowerCase()} is missing role ${minterRole}`
      );
    });
  });

  describe("Burning", function () {
    const amount = "1000000000";
    beforeEach(async function () {
      const adminRole = await veAlva.ADMIN_ROLE();
      await veAlva.grantRole(adminRole, user1.address);

      await veAlva.connect(user1).mint(user2.address, amount);
      expect(await veAlva.balanceOf(user2.address)).to.be.equal(amount);
    });

    it("Only Admin can burn", async function () {
      const adminRole = await veAlva.ADMIN_ROLE();

      const supply = await veAlva.totalSupply();
      expect(supply).to.equal(amount);

      let user2Balance = await veAlva.balanceOf(user2.address);
      expect(user2Balance).to.equal(amount);

      await expect(veAlva.burnTokens(user2.address, amount)).to.be.rejectedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${adminRole}`
      );

      user2Balance = await veAlva.balanceOf(user2.address);
      expect(user2Balance).to.equal(amount);

      await veAlva.connect(user1).burnTokens(user2.address, amount);

      let newUser2Balance = await veAlva.balanceOf(user2.address);

      expect(newUser2Balance).to.equal(0);

      const newSupply = await veAlva.totalSupply();
      expect(newSupply).to.equal(0);
    });

    it("Burn after granting role", async function () {
      const adminRole = await veAlva.ADMIN_ROLE();

      let user2Balance = await veAlva.balanceOf(user2.address);
      expect(user2Balance).to.equal(amount);

      await expect(veAlva.burnTokens(user2.address, amount)).to.be.rejectedWith(
        `AccessControl: account ${owner.address.toLowerCase()} is missing role ${adminRole}`
      );

      await veAlva.grantRole(veAlva.ADMIN_ROLE(), owner.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), owner.address)).to.equal(
        true
      );

      await veAlva.burnTokens(user2.address, amount);

      let newUser2Balance = await veAlva.balanceOf(user2.address);

      expect(newUser2Balance).to.equal(0);

      const newSupply = await veAlva.totalSupply();
      expect(newSupply).to.equal(0);
    });

    it("Burn from owner after revoking role", async function () {
      const burnRole = await veAlva.ADMIN_ROLE();
      await veAlva.grantRole(veAlva.ADMIN_ROLE(), user3.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user3.address)).to.equal(
        true
      );

      await veAlva.connect(user3).burnTokens(user2.address, "500000000");
      expect(await veAlva.balanceOf(user2.address)).to.be.equal("500000000");

      await veAlva.revokeRole(veAlva.ADMIN_ROLE(), user3.address);
      expect(await veAlva.hasRole(veAlva.ADMIN_ROLE(), user3.address)).to.equal(
        false
      );

      await expect(
        veAlva.connect(user3).burnTokens(user2.address, amount)
      ).to.be.rejectedWith(
        `AccessControl: account ${user3.address.toLowerCase()} is missing role ${burnRole}`
      );
    });
  });

  describe("Non-Transferrable", function () {
    const amount = "1000000000";

    beforeEach(async function () {
      const adminRole = await veAlva.ADMIN_ROLE();
      await veAlva.grantRole(adminRole, user1.address);

      await veAlva.connect(user1).mint(user2.address, amount.toString());
      expect(await veAlva.balanceOf(user2.address)).to.be.equal(amount);
    });

    it("User can't transfer by calling transfer method", async function () {
      await expect(
        veAlva.connect(user2).transfer(user1.address, amount)
      ).to.be.rejectedWith("Tokens cannot be transferred");
    });

    it("User can't tansfer by calling transferFrom method", async function () {
      await veAlva.connect(user2).approve(user1.address, amount);

      const allowance = await veAlva.allowance(user2.address, user1.address);
      expect(allowance).to.equal(amount);

      await expect(
        veAlva.connect(user1).transferFrom(user2.address, user1.address, amount)
      ).to.be.rejectedWith("Tokens cannot be transferred");
    });

    it("User can't transfer to 0x address", async function () {
      const zeroAddress = "0x0000000000000000000000000000000000000000";
      await expect(
        veAlva.connect(user2).transfer(zeroAddress, amount)
      ).to.be.rejectedWith("ERC20: transfer to the zero address");
    });
  });
});
