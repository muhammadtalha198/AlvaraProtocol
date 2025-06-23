const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");
const { createBTSAndGetInstance } = require("./utils/bts-helper");

describe.only("Royalty", () => {
  let owner, user1, user2, user3, seller, buyer;
  let factory, wETH, alva, mtToken, router;
  let wETHAddress, alvaAddress, mtTokenAddress, routerAddress;

  beforeEach(async function () {
    [owner, user1, user2, user3, seller, buyer] = await ethers.getSigners();

    const allDeployments = await deployments.fixture(["all-eth"]);
    // Deploy MockMarketplace
    const MockMarketplace = await ethers.getContractFactory("MockMarketplace");
    marketplace = await MockMarketplace.deploy();
    await marketplace.waitForDeployment();

    wETH = await ethers.getContractAt("WETH", allDeployments["WETH"].address);

    factory = await ethers.getContractAt(
      "Factory",
      allDeployments["Factory"].address
    );

    alva = await ethers.getContractAt(
      "Alvara",
      allDeployments["Alvara"].address
    );

    mtToken = await ethers.getContractAt(
      "MockToken",
      allDeployments["MockToken"].address
    );

    router = await ethers.getContractAt(
      "UniswapV2Router02",
      allDeployments["UniswapV2Router02"].address
    );

    wETHAddress = await wETH.getAddress();
    alvaAddress = await alva.getAddress();
    mtTokenAddress = await mtToken.getAddress();
    routerAddress = await router.getAddress();

    await factory.grantRole(await factory.ADMIN_ROLE(), owner.address);
    await factory.grantRole(await factory.FEE_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.WHITELIST_MANAGER_ROLE(), owner.address);
    await factory.grantRole(await factory.UPGRADER_ROLE(), owner.address);
    await factory.grantRole(await factory.URI_MANAGER_ROLE(), owner.address);

    //set price to Router
    await router.setTokenDetails(
      wETHAddress,
      owner.address,
      ethers.parseEther("1")
    );
    await router.setTokenDetails(
      alvaAddress,
      owner.address,
      ethers.parseEther("1")
    );
    await router.setTokenDetails(
      mtTokenAddress,
      owner.address,
      ethers.parseEther("1")
    );

    //allow token amount
    await wETH.approve(routerAddress, ethers.parseEther("100000000000"));
    await alva.approve(routerAddress, ethers.parseEther("100000000000"));
    await mtToken.approve(routerAddress, ethers.parseEther("100000000000"));
  });

  describe("Royalty Functionality", function () {
    it("Should return 0 royalty for a sale price of 0", async function () {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      const { royaltyAmount } = await btsInstance.royaltyInfo(0, 0);
      expect(royaltyAmount).to.equal(0);
    });
    it("Should return default royalty receiver and calculate correct royalty amount", async function () {
      const ethValue = ethers.parseEther("1");
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );

      const royaltyReceiver = await factory.royaltyReceiver();

      const { receiver, royaltyAmount } = await btsInstance.royaltyInfo(
        0,
        ethValue
      );
      expect(royaltyReceiver).to.be.equal(receiver);
      expect(royaltyAmount).to.be.equal(ethers.parseEther("0.02"));
    });
    it("Should update royalty receiver on the factory and reflect the change in BTS royalty info", async function () {
      const newRoyaltyReceiver = user3.address;
      const ethValue = ethers.parseEther("1");

      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );

      const royaltyReceiver = await factory.royaltyReceiver();

      const [receiver] = await btsInstance.royaltyInfo(0, ethValue);

      expect(receiver).to.equal(royaltyReceiver);
      await factory.updateRoyaltyReceiver(newRoyaltyReceiver);
      expect(await factory.royaltyReceiver()).to.not.equal(royaltyReceiver);
      expect(await factory.royaltyReceiver()).to.equal(newRoyaltyReceiver);

      const [updatedReceiver, _] = await btsInstance.royaltyInfo(
        0,
        ethers.parseEther("1")
      );

      expect(updatedReceiver).to.equal(newRoyaltyReceiver);
    });
    it("Should update royalty percentage on the factory and reflect updated royalty amount in BTS", async function () {
      const newRoyaltyPercentage = 300;
      const ethValue = ethers.parseEther("1");
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await factory.updateRoyaltyPercentage(newRoyaltyPercentage);

      const royaltyReceiver = await factory.royaltyReceiver();

      const { receiver, royaltyAmount } = await btsInstance.royaltyInfo(
        0,
        ethValue
      );
      expect(royaltyReceiver).to.be.equal(receiver);
      expect(royaltyAmount).to.be.equal(ethers.parseEther("0.03"));
    });

    it("Should restrict royalty updates to the owner and emit proper events when updating settings", async function () {
      const newRoyaltyPercentage = 300;
      const newRoyaltyReceiver = user3.address;

      await expect(
        factory.connect(user1).updateRoyaltyPercentage(newRoyaltyPercentage)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.FEE_MANAGER_ROLE()}`);
      await expect(
        factory.connect(user1).updateRoyaltyReceiver(newRoyaltyReceiver)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.FEE_MANAGER_ROLE()}`);

      await expect(factory.updateRoyaltyPercentage(newRoyaltyPercentage))
        .to.emit(factory, "RoyaltyUpdated")
        .withArgs(newRoyaltyPercentage);
      await expect(factory.updateRoyaltyReceiver(newRoyaltyReceiver))
        .to.emit(factory, "RoyaltyReceiverUpdated")
        .withArgs(newRoyaltyReceiver);

      const royaltyReceiver = await factory.royaltyReceiver();
      const royaltyPercentage = await factory.royaltyPercentage();

      expect(royaltyReceiver).to.be.equal(newRoyaltyReceiver);
      expect(royaltyPercentage).to.be.equal(newRoyaltyPercentage);
    });
  });
  describe("Royalty Management", function () {
    const newRoyaltyPercentage = 250;
    const zeroRoyaltyPercentage = 0;
    const zeroAddress = ethers.ZeroAddress;
    const outOfRangeRoyaltyValue = 301;

    it("Should revert if unauthorized user tries to update royalties", async function () {
      await expect(
        factory.connect(user1).updateRoyaltyPercentage(newRoyaltyPercentage)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.FEE_MANAGER_ROLE()}`);

      await expect(
        factory.connect(user1).updateRoyaltyReceiver(zeroAddress)
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.FEE_MANAGER_ROLE()}`);
    });

    it("Should revert if royalty percentage is out of range or unchanged", async function () {
      await expect(
        factory.connect(owner).updateRoyaltyPercentage(zeroRoyaltyPercentage)
      ).to.be.revertedWithCustomError(factory, "InvalidRoyaltyPercentage");

      await expect(
        factory.updateRoyaltyPercentage(outOfRangeRoyaltyValue)
      ).to.be.revertedWithCustomError(factory, "InvalidRoyaltyPercentage");
    });

    it("Should revert if royalty percentage is the same as the currently set value", async function () {
      await expect(
        factory.connect(owner).updateRoyaltyPercentage(newRoyaltyPercentage)
      ).to.not.be.reverted;

      await expect(
        factory.updateRoyaltyPercentage(newRoyaltyPercentage)
      ).to.be.revertedWithCustomError(factory, "DuplicateRoyaltyValue");
    });

    it("Should revert if royalty receiver is zero or unchanged", async function () {
      await factory.updateRoyaltyReceiver(user1.address);
      await expect(
        factory.updateRoyaltyReceiver(zeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidAddress");
    });
  });
  describe("Factory Contract - Whitelist Functionality", function () {
    it("should allow owner to whitelist a contract", async () => {
      await factory.addWhitelistedContract(await marketplace.getAddress());
      expect(await factory.isWhitelistedContract(await marketplace.getAddress())).to.be.true;
    });

    it("should emit the event after whitelisting the contract", async () => {
      await expect(factory.addWhitelistedContract(await marketplace.getAddress()))
        .to.emit(factory, "ContractWhitelisted")
        .withArgs(await marketplace.getAddress());
      expect(await factory.isWhitelistedContract(await marketplace.getAddress())).to.be.true;
    });

    it("should fail to whitelist 0x0 address", async () => {
      await expect(
        factory.addWhitelistedContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidWhitelistAddress");
    });

    it("should prevent adding already whitelisted contract", async () => {
      await factory.addWhitelistedContract(await marketplace.getAddress());
      await expect(
        factory.addWhitelistedContract(await marketplace.getAddress())
      ).to.be.revertedWithCustomError(factory, "InvalidWhitelistAddress");
    });

    it("should allow owner to remove whitelisted contract", async () => {
      await factory.addWhitelistedContract(await marketplace.getAddress());
      await factory.dewhitelistContract(await marketplace.getAddress());
      expect(await factory.isWhitelistedContract(await marketplace.getAddress())).to.be.false;
    });

    it("should emit event after removing whitelisted contract", async () => {
      await factory.addWhitelistedContract(await marketplace.getAddress());

      await expect(factory.dewhitelistContract(await marketplace.getAddress()))
        .to.emit(factory, "ContractRemovedFromWhitelist")
        .withArgs(await marketplace.getAddress());
      expect(await factory.isWhitelistedContract(await marketplace.getAddress())).to.be.false;
    });

    it("should fail to remove unwhitelisted address", async () => {
      await expect(
        factory.dewhitelistContract(user1.address)
      ).to.be.revertedWithCustomError(factory, "InvalidWhitelistAddress");
    });

    it("should fail to remove 0x0 address", async () => {
      await expect(
        factory.dewhitelistContract(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidWhitelistAddress");
    });
    it("should restrict non-owner from updating whitelist", async () => {
      await expect(
        factory.connect(user1).addWhitelistedContract(await marketplace.getAddress())
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.WHITELIST_MANAGER_ROLE()}`);
    });
    it("should restrict non-owner from removing whitelist", async () => {
      await expect(factory.connect(owner).addWhitelistedContract(await marketplace.getAddress()))
        .to.not.be.reverted;
      await expect(
        factory.connect(user1).dewhitelistContract(await marketplace.getAddress())
      ).to.be.rejectedWith(`AccessControl: account ${user1.address.toString().toLowerCase()} is missing role ${await factory.WHITELIST_MANAGER_ROLE()}`);
    });
  });
  describe("BTS Royalty & Whitelisting Functionality", function () {
    it("Should return 0 royalty on salePrice 0", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      const [, royaltyAmount] = await btsInstance.royaltyInfo(0, 0);
      expect(royaltyAmount).to.equal(0);
    });

    it("Should handle very large sale prices without overflow", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      const largePrice = ethers.parseEther("1000000000"); // 1 billion ETH
      const { receiver, royaltyAmount } = await btsInstance.royaltyInfo(
        0,
        largePrice
      );

      // Expected royalty is 2% of sale price (assuming default 200 basis points)
      const expectedRoyalty = (largePrice * BigInt(200)) / BigInt(10000);
      expect(royaltyAmount).to.equal(expectedRoyalty);
      expect(receiver).to.equal(await factory.royaltyReceiver());
    });

    it("Should handle minimum non-zero sale price", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      const minPrice = BigInt(1); // Smallest possible non-zero value
      const { royaltyAmount } = await btsInstance.royaltyInfo(0, minPrice);

      // With 20% royalty (2000 basis points), anything less than 5 wei should result in 0 royalty
      // due to rounding down in integer division
      expect(royaltyAmount).to.equal(0);
    });

    it("Should calculate correct royalties before and after royalty percentage update", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      const salePrice = ethers.parseEther("1");

      // Check initial royalty (20%)
      let { royaltyAmount } = await btsInstance.royaltyInfo(0, salePrice);
      expect(royaltyAmount).to.equal(ethers.parseEther("0.02")); // 2% of 1 ETH

      // Update royalty to 2.5%
      await factory.connect(owner).updateRoyaltyPercentage(250);

      // Check updated royalty
      ({ royaltyAmount } = await btsInstance.royaltyInfo(0, salePrice));
      expect(royaltyAmount).to.equal(ethers.parseEther("0.025")); // 25% of 1 ETH
    });
    it("Should allow approve to whitelisted contract", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await factory
        .connect(owner)
        .addWhitelistedContract(await marketplace.getAddress());
      await expect(
        btsInstance
          .connect(seller)
          .setApprovalForAll(await marketplace.getAddress(), true)
      ).to.not.be.reverted;
    });
    it("Should reject approve to non-whitelisted contract", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await expect(
        btsInstance
          .connect(seller)
          .setApprovalForAll(await marketplace.getAddress(), true)
      ).to.be.revertedWithCustomError(btsInstance, "ContractNotWhitelisted");
    });
    it("Should allow transfer to whitelisted marketplace", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await factory
        .connect(owner)
        .addWhitelistedContract(await marketplace.getAddress());
      await btsInstance
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true);
      const price = ethers.parseEther("1");
      await marketplace
        .connect(seller)
        .listNFT(await btsInstance.getAddress(), 0, price);
      await marketplace
        .connect(buyer)
        .buyNFT(await btsInstance.getAddress(), 0, { value: price });

      const newOwner = await btsInstance.ownerOf(0);
      expect(newOwner).to.equal(buyer.address);
    });
    it("Should reject transferFrom to non-whitelisted address (e.g., non-whitelisted marketplace)", async () => {
      const AnotherMarketplace = await ethers.getContractFactory(
        "MockMarketplace"
      );
      const nonWhitelisted = await AnotherMarketplace.deploy();
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await expect(
        btsInstance
          .connect(seller)
          .transferFrom(seller.address, await nonWhitelisted.getAddress(), 0)
      ).to.be.revertedWithCustomError(btsInstance, "ContractNotWhitelisted");
    });
    it("Should reject safeTransferFrom to non-whitelisted address", async () => {
      const AnotherMarketplace = await ethers.getContractFactory(
        "MockMarketplace"
      );
      const nonWhitelisted = await AnotherMarketplace.deploy();
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await expect(
        btsInstance
          .connect(seller)
          ["safeTransferFrom(address,address,uint256)"](
            seller.address,
            await nonWhitelisted.getAddress(),
            0
          )
      ).to.be.revertedWithCustomError(btsInstance, "ContractNotWhitelisted");
    });
    it("should transfer NFT via whitelisted marketplace and send correct royalty to receiver", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );

      await factory
        .connect(owner)
        .addWhitelistedContract(await marketplace.getAddress());
      await btsInstance
        .connect(seller)
        .setApprovalForAll(await marketplace.getAddress(), true);

      const price = ethers.parseEther("10");
      const royaltyPercent = await factory.royaltyPercentage(); // e.g., 2000

      const expectedRoyalty = (price * royaltyPercent) / 10000n;
      const expectedSellerAmount = price - expectedRoyalty;

      // List for Sale
      await marketplace
        .connect(seller)
        .listNFT(await btsInstance.getAddress(), 0, price);

      const royaltyReceiverAddress = await factory.royaltyReceiver();
      const royaltyReceiverBalanceBefore = await ethers.provider.getBalance(
        royaltyReceiverAddress
      );
      const sellerBalanceBefore = await ethers.provider.getBalance(
        seller.address
      );

      // Buy
      await marketplace
        .connect(buyer)
        .buyNFT(await btsInstance.getAddress(), 0, { value: price });

      const royaltyReceiverBalanceAfter = await ethers.provider.getBalance(
        royaltyReceiverAddress
      );
      const sellerBalanceAfter = await ethers.provider.getBalance(
        seller.address
      );

      const newOwner = await btsInstance.ownerOf(0);
      expect(newOwner).to.equal(buyer.address);

      // Check royalty was received correctly
      const royaltyDiff =
        royaltyReceiverBalanceAfter - royaltyReceiverBalanceBefore;
      expect(royaltyDiff).to.equal(expectedRoyalty);

      // Seller received remaining amount
      const sellerDiff = sellerBalanceAfter - sellerBalanceBefore;
      expect(sellerDiff).to.equal(expectedSellerAmount); // (minor gas deviation may occur, optional check)
    });
  });
  describe("Coverage Edge Cases", () => {
    it("Should transfer NFT to a non-contract wallet", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await btsInstance
        .connect(seller)
        .transferFrom(seller.address, user1.address, 0);

      // Verify the transfer was successful
      expect(await btsInstance.ownerOf(0)).to.equal(user1.address);
      expect(await btsInstance.balanceOf(user1.address)).to.equal(1);
      expect(await btsInstance.balanceOf(seller.address)).to.equal(0);
    });
    it("Should support ERC2981 interface", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      const ERC2981_INTERFACE_ID = "0x2a55205a";
      expect(
        await btsInstance.supportsInterface(ERC2981_INTERFACE_ID)
      ).to.equal(true);
    });
    it("Should revert transferFrom to non-whitelisted address", async () => {
      const AnotherMarketplace = await ethers.getContractFactory(
        "MockMarketplace"
      );
      const nonWhitelisted = await AnotherMarketplace.deploy();
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await expect(
        btsInstance
          .connect(seller)
          .transferFrom(seller.address, nonWhitelisted.getAddress(), 0)
      ).to.be.revertedWithCustomError(btsInstance, "ContractNotWhitelisted");
    });

    it("Should revert safeTransferFrom to non-whitelisted address", async () => {
      const AnotherMarketplace = await ethers.getContractFactory(
        "MockMarketplace"
      );
      const nonWhitelisted = await AnotherMarketplace.deploy();
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await expect(
        btsInstance
          .connect(seller)
          ["safeTransferFrom(address,address,uint256, bytes)"](
            seller.address,
            nonWhitelisted.getAddress(),
            0,
            "0x"
          )
      ).to.be.revertedWithCustomError(btsInstance, "ContractNotWhitelisted");
    });

    it("Should allow approve for whitelisted address", async () => {
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await factory.addWhitelistedContract(await marketplace.getAddress());
      await expect(btsInstance.connect(seller).approve(await marketplace.getAddress(), 0)).to.not
        .be.reverted;
    });

    it("Should revert approve for non-whitelisted address", async () => {
      const AnotherMarketplace = await ethers.getContractFactory(
        "MockMarketplace"
      );
      const nonWhitelisted = await AnotherMarketplace.deploy();
      const btsInstance = await createBTSAndGetInstance(
        factory,
        seller,
        "MyBTS",
        "MBTS",
        [mtTokenAddress, alvaAddress],
        [5000, 5000],
        "ipfs://bts-uri",
        100n,
        "BTS123",
        "Testing BTS",
        true,
        "1"
      );
      await expect(
        btsInstance.connect(seller).approve(nonWhitelisted.getAddress(), 0)
      ).to.be.revertedWithCustomError(btsInstance, "ContractNotWhitelisted");
    });
  });
});
