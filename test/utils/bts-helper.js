const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

const createBTSAndGetInstance = async (
  factory,
  user,
  name,
  symbol,
  tokenAddresses,
  weights,
  tokenURI,
  buffer,
  id,
  description,
  autoRebalance,
  price
) => {
  const btsDetails = {
    name: name,
    symbol: symbol,
    tokens: tokenAddresses,
    weights: weights,
    tokenURI: tokenURI,
    autoRebalance: autoRebalance,
    buffer: buffer,
    id: id,
    description: description,
  };

  const tx = await factory
    .connect(user)
    .createBTS(
      btsDetails.name,
      btsDetails.symbol,
      btsDetails.tokens,
      btsDetails.weights,
      btsDetails.tokenURI,
      btsDetails.buffer,
      btsDetails.id,
      btsDetails.description,
      calculateDeadline(20),
      { value: ethers.parseEther(price) }
    );

  const receipt = await tx.wait();
  let createdBTSAddress = null;

  for (const log of receipt.logs) {
    try {
      const parsedLog = factory.interface.parseLog(log);
      if (parsedLog.name === "BTSCreated") {
        createdBTSAddress = parsedLog.args.bts;
        break;
      }
    } catch {}
  }

  const btsInstance = await ethers.getContractAt(
    "BasketTokenStandard",
    createdBTSAddress
  );
  return btsInstance;
};

// Reusable function to increase time by seconds
const increaseTimeBy = async (seconds) => {
  await time.increase(seconds);
  await mine();
};

// Calculate Deadline
function calculateDeadline(minutes = 20) {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const buffer = minutes * 60; // Convert minutes to seconds
  return currentTime + buffer;
}

module.exports = { createBTSAndGetInstance, increaseTimeBy, calculateDeadline };
