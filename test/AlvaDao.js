// const { expect } = require("chai");
// const { ethers, upgrades } = require("hardhat");

// describe("AlvaDao", () => {
//   let owner, user1, user2, user3, user4, user5, user6;

//   beforeEach(async function () {
//     [owner, user1, user2, user3, user4, user5, user6] =
//       await ethers.getSigners();

//     MockToken = await ethers.getContractFactory("MockToken");
//     alva = await MockToken.deploy(owner.address);

//     xAlvaToken = await ethers.getContractFactory("xAlvaToken");
//     xALVA = await xAlvaToken.deploy(
//       owner.address,
//       owner.address,
//       owner.address
//     );

//     Sanctuary = await ethers.getContractFactory("AlvaraDao");
//     sanctuary = await upgrades.deployProxy(Sanctuary, [
//       alva.address,
//       xALVA.address,
//       10000000,
//     ]);
//     await sanctuary.deployed();

//     await xALVA.grantRole(
//       "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
//       sanctuary.address
//     );

//     await alva.connect(owner).mint(owner.address, "1000000000000000000000000");
//     await alva.connect(owner).mint(user1.address, "1000000000000000000000000");
//     await alva.connect(owner).mint(user2.address, "1000000000000000000000000");
//     await alva.connect(owner).mint(user3.address, "1000000000000000000000000");
//     await alva.connect(owner).mint(user4.address, "1000000000000000000000000");

//     await alva
//       .connect(owner)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await alva
//       .connect(user1)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await alva
//       .connect(user2)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await alva
//       .connect(user3)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await alva
//       .connect(user4)
//       .approve(sanctuary.address, "1000000000000000000000");

//     await xALVA
//       .connect(owner)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await xALVA
//       .connect(user1)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await xALVA
//       .connect(user2)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await xALVA
//       .connect(user3)
//       .approve(sanctuary.address, "1000000000000000000000");
//     await xALVA
//       .connect(user4)
//       .approve(sanctuary.address, "1000000000000000000000");
//   });

//   describe("Initialize Values", function () {
//     it("should set correct xALVA address", async function () {
//       expect(await sanctuary.owner()).to.equal(owner.address);
//       expect(await sanctuary.xALVA()).to.equal(xALVA.address);
//     });

//     it("should set correct ALVA address", async function () {
//       expect(await sanctuary.ALVA()).to.equal(alva.address);
//     });
//   });

//   describe("Stake/Enter", function () {
//     it("Stake ALVA token(Single User)", async function () {
//       await sanctuary.enter(10000);
//       expect(await xALVA.balanceOf(owner.address)).to.equal(10000);
//       expect(await alva.balanceOf(sanctuary.address)).to.equal(10000);
//     });

//     it("Multiple users stake", async function () {
//       await sanctuary.enter(10000);
//       await sanctuary.connect(user1).enter(10000);
//       await sanctuary.connect(user2).enter(10000);
//       expect(await xALVA.balanceOf(owner.address)).to.equal(10000);
//       expect(await xALVA.balanceOf(user1.address)).to.equal(10000);
//       expect(await xALVA.balanceOf(user2.address)).to.equal(10000);
//       expect(await alva.balanceOf(sanctuary.address)).to.equal(30000);
//     });

//     it("Stake by user1 and send xALVA to user2 wallet address", async function () {
//       await sanctuary.enter(10000);
//       await sanctuary.connect(user1).enter(10000);
//       expect(await xALVA.balanceOf(owner.address)).to.equal(10000);
//       expect(await xALVA.balanceOf(user1.address)).to.equal(10000);
//       await expect(sanctuary.connect(user2).leave(10000)).to.be.revertedWith(
//         "ERC20: burn amount exceeds balance"
//       );
//     });
//   });

//   describe("Unstake/Leave", function () {
//     it("Leave ALVA token(Single User) if lock period not cover", async function () {
//       await sanctuary.enter(10000);
//       await expect(sanctuary.leave(10000)).to.be.revertedWith(
//         "Can not unStake"
//       );
//     });

//     it("Leave ALVA token(Single User)", async function () {
//       await sanctuary.enter(10000);

//       await ethers.provider.send("evm_increaseTime", [10000000]);
//       await ethers.provider.send("evm_mine");

//       await sanctuary.leave(10000);
//       expect(await xALVA.balanceOf(owner.address)).to.equal(0);
//       expect(await xALVA.balanceOf(sanctuary.address)).to.equal(0);
//       expect(await alva.balanceOf(owner.address)).to.equal(
//         "1000000000000000000000000"
//       );
//     });

//     it("Failed if not approve", async function () {
//       await alva
//         .connect(user5)
//         .mint(user5.address, "1000000000000000000000000");
//       await alva
//         .connect(user5)
//         .approve(sanctuary.address, "1000000000000000000000");
//       await sanctuary.connect(user5).enter(10000);

//       await ethers.provider.send("evm_increaseTime", [10000000]);
//       await ethers.provider.send("evm_mine");

//       await expect(sanctuary.connect(user5).leave(10000)).to.be.revertedWith(
//         "ERC20: insufficient allowance"
//       );
//     });
//   });

//   describe("updateLockPeriod", function () {
//     it("Update Lock Period by owner", async function () {
//       await sanctuary.updateLockPeriod(500000);
//       expect(await sanctuary.lockedPeriod()).to.be.equal(500000);
//     });

//     it("Failed if not owner", async function () {
//       await expect(
//         sanctuary.connect(user5).updateLockPeriod(100000)
//       ).to.be.revertedWith("Ownable: caller is not the owner");
//     });
//   });
// });
