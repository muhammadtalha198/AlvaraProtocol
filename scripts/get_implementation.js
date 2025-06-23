const { ethers, upgrades } = require("hardhat");

async function main(address) {
  const proxyAddress = address; // Replace with your proxy address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );
  console.log("Implementation address:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
