const { ethers } = require("hardhat");

async function main() {
  // Get the signer
  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);

  // Constants - Update these values as needed
  const FACTORY_ADDRESS = "0xd94eD3A0b985909B294fe4Ec91e51A06ebd3D27D"; // Factory proxy address
  const ALVA_ADDRESS = "0x960545D39568423B7e707a2A16d61408a5b9Bf82"; // ALVA token address
  const WETH_ADDRESS = "0x57112DD160Ee9A8E2722DCcF1d977B530Ff61a17"; // WETH address

  // BTS Creation Parameters
  const BTS_PARAMS = {
    name: "Fee Demo Basket",
    symbol: "FEEDEMO",
    tokens: [ALVA_ADDRESS, WETH_ADDRESS],
    weights: [5000, 5000], // 50% ALVA, 50% WETH (must add up to 10000)
    tokenURI: "https://token-uri.com/fee-demo",
    buffer: 50, // 0.5% buffer
    id: "fee-demo-basket-" + Date.now(), // Unique ID
    description: "A basket token demonstrating fee deduction mechanisms",
    deadline: Math.floor(Date.now() / 1000) + 20 * 60,
  };

  // Amount of ETH to send for BTS creation
  const creationAmount = ethers.parseEther("0.05"); // 0.05 ETH

  // Get Factory contract instance
  console.log("\n1. Connecting to Factory contract...");
  const factory = await ethers.getContractAt(
    "Factory",
    FACTORY_ADDRESS,
    signer
  );

  // Step 2: Check min creation amount
  console.log("\n2. Checking minimum BTS creation amount...");
  const minCreationAmount = await factory.minBTSCreationAmount();
  console.log(
    `   Minimum Creation Amount: ${ethers.formatEther(minCreationAmount)} ETH`
  );

  if (creationAmount < minCreationAmount) {
    console.error(
      `   ERROR: Creation amount (${ethers.formatEther(
        creationAmount
      )} ETH) is less than minimum required (${ethers.formatEther(
        minCreationAmount
      )} ETH)`
    );
    return;
  }

  // Step 3: Get platform fee configuration
  console.log("\n3. Getting platform fee configuration...");
  const feeConfig = await factory.getPlatformFeeConfig();

  // Convert fee values to numbers for display
  const creationFeePercent = Number(feeConfig.btsCreationFee) / 100;
  const contributionFeePercent = Number(feeConfig.contributionFee) / 100;
  const withdrawalFeePercent = Number(feeConfig.withdrawalFee) / 100;

  console.log(`   BTS Creation Fee: ${creationFeePercent}%`);
  console.log(`   Contribution Fee: ${contributionFeePercent}%`);
  console.log(`   Withdrawal Fee: ${withdrawalFeePercent}%`);
  console.log(`   Fee Collector: ${feeConfig.feeCollector}`);

  // Calculate expected fee amount using BigInt
  const feeRate = BigInt(feeConfig.btsCreationFee);
  const expectedFeeAmount = (creationAmount * feeRate) / BigInt(10000);
  console.log(
    `   Expected Fee Amount: ${ethers.formatEther(expectedFeeAmount)} ETH`
  );

  // Step 4: Create BTS
  console.log("\n4. Creating BTS...");
  console.log(`   Name: ${BTS_PARAMS.name}`);
  console.log(`   Symbol: ${BTS_PARAMS.symbol}`);
  console.log(`   Tokens: ${BTS_PARAMS.tokens}`);
  console.log(`   Weights: ${BTS_PARAMS.weights}`);
  console.log(`   Creation Amount: ${ethers.formatEther(creationAmount)} ETH`);

  try {
    console.log("\n   Sending transaction to create BTS...");
    const tx = await factory.createBTS(
      BTS_PARAMS.name,
      BTS_PARAMS.symbol,
      BTS_PARAMS.tokens,
      BTS_PARAMS.weights,
      BTS_PARAMS.tokenURI,
      BTS_PARAMS.buffer,
      BTS_PARAMS.id,
      BTS_PARAMS.description,
      BTS_PARAMS.deadline,
      { value: creationAmount, gasLimit: 5000000 } // Higher gas limit for complex operations
    );

    console.log(`   Transaction hash: ${tx.hash}`);
    console.log("\n   Waiting for transaction confirmation...");

    const receipt = await tx.wait();
    console.log(`   Transaction confirmed in block ${receipt.blockNumber}`);

    // Find the CreatedBTS event in the logs
    const createdBTSEvent = receipt.logs
      .filter(
        (log) =>
          log.topics[0] === factory.interface.getEvent("CreatedBTS").topicHash
      )
      .map((log) => factory.interface.parseLog(log))[0];

    if (createdBTSEvent) {
      console.log("\n5. BTS Creation Successful!");
      console.log(`   BTS Address: ${createdBTSEvent.args.bts}`);
      console.log(`   BTS Pair Address: ${createdBTSEvent.args.btsPair}`);
      console.log(`   Creator: ${createdBTSEvent.args.creator}`);
      console.log(
        `   Amount Used: ${ethers.formatEther(createdBTSEvent.args.amount)} ETH`
      );
      console.log(
        `   Fee Amount: ${ethers.formatEther(
          createdBTSEvent.args.feeAmount
        )} ETH`
      );

      // Get BTS contract instance
      const bts = await ethers.getContractAt(
        "BasketTokenStandard",
        createdBTSEvent.args.bts,
        signer
      );
      const btsPair = await ethers.getContractAt(
        "BasketTokenStandardPair",
        createdBTSEvent.args.btsPair,
        signer
      );

      // Get LP token balance
      const lpBalance = await btsPair.balanceOf(signer.address);
      console.log(
        `   LP Token Balance: ${ethers.formatEther(lpBalance)} tokens`
      );

      // Get BTS token balance
      const btsBalance = await bts.balanceOf(signer.address);
      console.log(
        `   BTS Token Balance: ${ethers.formatEther(btsBalance)} tokens`
      );
    } else {
      console.log("\n5. Could not find CreatedBTS event in logs");
    }
  } catch (error) {
    console.error("\n   Error creating BTS:", error);
    if (error.data) {
      console.error("   Error data:", error.data);
    }
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
