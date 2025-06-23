const { ethers, upgrades, network } = require("hardhat");


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const TokenContract = await ethers.getContractFactory("CustomToken");
  
  let names = [
    "Aventa"
  ];

  // let symbols = ["M87"];

  let symbols = [
    "AVENT"
  ];


  // Deploy multiple instances manually
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const symbol = symbols[i];

    const contract = await upgrades.deployProxy(TokenContract, [
      name,
      symbol
    ]);

    await contract.waitForDeployment();

    //await delay(5000)
    console.log(`Contract instance ${name} deployed at:`, await contract.getAddress());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
