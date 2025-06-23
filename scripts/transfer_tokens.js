const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");

async function main() {
  
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);


  // Set transaction details
  const tx = {
      to: "0xa08946F6C6d502941D86Aa86c5AcBBbe2fc1F128",  // Replace with the recipient's address
      value: ethers.parseEther("2"), // Sending 0.01 ETH
      gasLimit: 21000 // Standard gas limit for ETH transfer
  };

  // Send the transaction
  const txResponse = await signer.sendTransaction(tx);
  console.log(`⏳ Transaction sent! Hash: ${txResponse.hash}`);

  // Wait for confirmation
  await txResponse.wait();
  console.log("✅ Transaction confirmed!");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
