const { run } = require("hardhat");

const verify = async (contractAddress, args, beaconPath) => {
  console.log("Verifying contract...");

  let verifyArgs = {
    address: contractAddress,
    constructorArguments: args,
    timeout: 60000
  }


  if (beaconPath) {
    console.log("Adding Beacon path...");
    verifyArgs["contract"] = beaconPath
  }


  try {
    await run("verify:verify", verifyArgs);
  } catch (e) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.log(e);
    }
  }
};

module.exports = { verify };
