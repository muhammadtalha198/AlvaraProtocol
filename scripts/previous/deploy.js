// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const ALVA = await hre.ethers.getContractFactory("Alvara");
  const alva = await hre.upgrades.deployProxy(ALVA);
  await alva.waitForDeployment();
  const alvaAddress = await alva.getAddress();
  console.log("alva", alvaAddress);

  const BTS = await hre.ethers.getContractFactory("BasketTokenStandard");
  const bts = await BTS.deploy();
  await bts.waitForDeployment();
  const btsAddress = await bts.getAddress();
  console.log("BTS", btsAddress);

  const BTSPair = await hre.ethers.getContractFactory(
    "BasketTokenStandardPair"
  );
  const btsPair = await BTSPair.deploy();
  await btsPair.waitForDeployment();
  const btsPairAddress = await btsPair.getAddress();
  console.log("BTS Pair", btsPairAddress);

  const Factory = await hre.ethers.getContractFactory("Factory");
  const factory = await hre.upgrades.deployProxy(Factory, [
    alvaAddress,
    500,
    btsAddress,
    btsPairAddress,
  ]);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("factory", factoryAddress);

  // const Factory = await hre.ethers.getContractFactory("Factory");
  // const fact = await Factory.deploy();
  // await fact.deployed();
  // console.log("factory", fact.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
