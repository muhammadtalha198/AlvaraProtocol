const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");
const btsPairBeacon = require("../../artifacts/contracts/BTSBeacon.sol/BTSBeacon.json");
const { verify } = require("../../utils/verify");

async function main() {
  const rpc = network.config.url;
  const chainId = network.config.chainId;
  const priKey = networkConfig[chainId].deployerKey;

  // 1. Setup provider and signer
  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);
  console.log("Using account:", signer.address);

  // 2. Deploy new implementation if not provided
  let IMPLEMENTATION_ADDRESS = "";
  if (!IMPLEMENTATION_ADDRESS) {
    console.log("\nDeploying new BTS Pair implementation...");
    const BTSPair = await ethers.getContractFactory("BasketTokenStandardPair");
    const btsPair = await BTSPair.deploy();
    const deployTx = await btsPair.deploymentTransaction();
    console.log("Deployment transaction hash:", deployTx.hash);
    
    // Wait for 2 confirmations
    console.log("Waiting for 2 confirmations...");
    await deployTx.wait(2);
    
    IMPLEMENTATION_ADDRESS = await btsPair.getAddress();
    console.log("New implementation deployed at:", IMPLEMENTATION_ADDRESS);

    // Wait for 30 seconds before verification
    console.log("Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify the implementation
    console.log("\nVerifying implementation...");
    await verify(IMPLEMENTATION_ADDRESS, [], "contracts/BTSPair.sol:BTSPair");
  } else {
    console.log("\nUsing existing implementation at:", IMPLEMENTATION_ADDRESS);
  }

  // 3. Verify implementation has code
  const implementationCode = await provider.getCode(IMPLEMENTATION_ADDRESS);
  if (implementationCode === '0x') {
    throw new Error(`No contract code found at implementation address ${IMPLEMENTATION_ADDRESS}`);
  }
  console.log("Implementation contract verified!");

  // 4. Connect to beacon contract
  const BEACON_ADDRESS = "0x03d53767140B4660d5aF580D0C283519D0F0741f"; // BTSPair Beacon Address
  const btsPairBeaconContract = new ethers.Contract(BEACON_ADDRESS, btsPairBeacon.abi, signer);

  // 5. Check ownership
  const owner = await btsPairBeaconContract.owner();
  console.log("\nBeacon owner:", owner);
  console.log("Current signer:", signer.address);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the beacon owner. Owner is ${owner}`);
  }

  // 6. Check current implementation
  const currentImpl = await btsPairBeaconContract.implementation();
  console.log("\nCurrent beacon implementation:", currentImpl);

  if (currentImpl.toLowerCase() === IMPLEMENTATION_ADDRESS.toLowerCase()) {
    console.log("Beacon is already pointing to this implementation.");
    return;
  }

  // 7. Update the beacon with new implementation
  console.log("\nUpdating beacon with new implementation...");
  const updateTx = await btsPairBeaconContract.upgradeTo(IMPLEMENTATION_ADDRESS, {
    gasLimit: 500000 // Set explicit gas limit
  });
  console.log("Update transaction hash:", updateTx.hash);

  // Wait for 2 confirmations
  console.log("Waiting for 2 confirmations...");
  await updateTx.wait(2);
  console.log("Update confirmed!");

  // 8. Print final confirmation
  const newImpl = await btsPairBeaconContract.implementation();
  console.log("\nNew beacon implementation:", newImpl);
  console.log("Update complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
