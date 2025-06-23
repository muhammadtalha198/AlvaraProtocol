require("dotenv").config();
const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../../helper-hardhat.config");
const btsBeacon = require("../../artifacts/contracts/BTSBeacon.sol/BTSBeacon.json");
const { verify } = require("../../utils/verify");

async function main() {
  const rpc = network.config.url;
  const chainId = network.config.chainId;
  
  // Get private key from environment variable
  const priKey = process.env.PRIVATE_KEY_SEPOLIA_NETWORK;
  if (!priKey) {
    throw new Error("No private key found in environment variables. Set PRIVATE_KEY_SEPOLIA_NETWORK");
  }

  // 1. Setup provider and signer
  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);
  console.log("Using account:", signer.address);

  // 2. Deploy new implementation if not provided
  let IMPLEMENTATION_ADDRESS = "";
  if (!IMPLEMENTATION_ADDRESS) {
    console.log("\nDeploying new BTS implementation...");
    const BTS = await ethers.getContractFactory("BasketTokenStandard");
    const bts = await BTS.deploy();
    const deployTx = await bts.deploymentTransaction();
    console.log("Deployment transaction hash:", deployTx.hash);
    
    // Wait for 2 confirmations
    console.log("Waiting for 2 confirmations...");
    await deployTx.wait(2);
    
    IMPLEMENTATION_ADDRESS = await bts.getAddress();
    console.log("New implementation deployed at:", IMPLEMENTATION_ADDRESS);

    // Wait for 30 seconds before verification
    console.log("Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Verify the implementation
    console.log("\nVerifying implementation...");
    await verify(IMPLEMENTATION_ADDRESS, [], "contracts/BTS.sol:BasketTokenStandard");
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
  const BEACON_ADDRESS = "0xe832D2ef39fFaC7D1A316887F53f05b55b304Ffb";
  const btsBeaconContract = new ethers.Contract(BEACON_ADDRESS, btsBeacon.abi, signer);

  // 5. Check ownership
  const owner = await btsBeaconContract.owner();
  console.log("\nBeacon owner:", owner);
  console.log("Current signer:", signer.address);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the beacon owner. Owner is ${owner}`);
  }

  // 6. Check current implementation
  const currentImpl = await btsBeaconContract.implementation();
  console.log("\nCurrent beacon implementation:", currentImpl);

  if (currentImpl.toLowerCase() === IMPLEMENTATION_ADDRESS.toLowerCase()) {
    console.log("Beacon is already pointing to this implementation.");
    return;
  }

  // 7. Update the beacon with new implementation
  console.log("\nUpdating beacon with new implementation...");
  const updateTx = await btsBeaconContract.upgradeTo(IMPLEMENTATION_ADDRESS, {
    gasLimit: 500000 // Set explicit gas limit
  });
  console.log("Update transaction hash:", updateTx.hash);

  // Wait for 2 confirmations
  console.log("Waiting for 2 confirmations...");
  await updateTx.wait(2);
  console.log("Update confirmed!");

  // 8. Print final confirmation
  const newImpl = await btsBeaconContract.implementation();
  console.log("\nNew beacon implementation:", newImpl);
  console.log("Update complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
