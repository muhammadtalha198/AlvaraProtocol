const { ethers, upgrades, network } = require("hardhat");
const crypto = require("crypto");
const {
  AxelarQueryAPI,
  Environment,
  EvmChain,
  GasToken,
} = require("@axelar-network/axelarjs-sdk");
const { networkConfig } = require("../../helper-hardhat.config");

const interchainTokenServiceContractABI = require("./utils/interchainTokenServiceABI.json");
const alvaEtherTokenABI = require("./utils/Eth_Alva_Abi.json");
const alvaAvaxTokenABI = require("./utils/Avalanche_Alva_Abi.json");

const LOCK_UNLOCK = 2;
const MINT_BURN = 4;

const interchainTokenServiceContractAddress =
  "0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C";

const alvaEthAddress = "0x8e729198d1C59B82bd6bBa579310C40d740A11C2";
const alvaAvalancheAddress = "0xd18555A6C2FDa350069735419900478eec4Abd96";

const rpc = network.config.url;
const chainId = network.config.chainId;
const priKey = networkConfig[chainId].deployerKey;
const userKey = networkConfig[chainId].user1Key;

async function getSigner() {
  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);
  return signer;
}

async function getUser() {
  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(userKey, provider);
  return signer;
}

async function getContractInstance(contractAddress, contractABI, signer) {
  return new ethers.Contract(contractAddress, contractABI, signer);
}

// Deploy token manager : Eth
async function deployTokenManagerEth() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  // Get the InterchainTokenService contract instance
  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );

  // Generate a random salt
  const salt = "0x" + crypto.randomBytes(32).toString("hex");

  // Create params
  const params = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "address"],
    [signer.address, alvaEthAddress]
  );

  // Deploy the token manager
  const deployTxData = await interchainTokenServiceContract.deployTokenManager(
    salt,
    "",
    LOCK_UNLOCK,
    params,
    ethers.parseEther("0.01") //utils.parseEther("0.01")
  );

  // Get the tokenId
  const tokenId = await interchainTokenServiceContract.interchainTokenId(
    signer.address,
    salt
  );

  // Get the token manager address
  const expectedTokenManagerAddress =
    await interchainTokenServiceContract.tokenManagerAddress(tokenId);

  console.log(
    `
	Salt: ${salt},
	Transaction Hash: ${deployTxData.hash},
	Token ID: ${tokenId},
	Expected token manager address: ${expectedTokenManagerAddress},
	`
  );
}

const api = new AxelarQueryAPI({ environment: Environment.MAINNET });

// Estimate gas costs
async function gasEstimatorEth() {
  const gas = await api.estimateGasFee(
    EvmChain.ETHEREUM,
    EvmChain.AVALANCHE,
    "700000",
    1.1
  );

  console.log("Gas for eth-to-avalanche :", gas);
  return gas;
}

// Estimate gas costs
async function gasEstimatorAvalanche() {
  const gas = await api.estimateGasFee(
    EvmChain.AVALANCHE,
    EvmChain.ETHEREUM,
    "700000",
    1.1
  );

  console.log("Gas for avalanche-to-eth :", gas);

  return gas;
}

// Deploy remote token manager : Avalanche
async function deployRemoteTokenManagerAvalanche() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  // Get the InterchainTokenService contract instance
  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );

  // Create params
  const param = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "address"],
    [signer.address, alvaAvalancheAddress]
  );

  const gasAmount = await gasEstimatorEth();

  // Deploy the token manager
  const deployTxData = await interchainTokenServiceContract.deployTokenManager(
    "0x1d62d0656a5fb66d99d98270df07a9c27d898fb6b281298b2de5b2f179d271ba", // change salt
    "Avalanche",
    MINT_BURN,
    param,
    ethers.parseEther("0.001"),
    { value: gasAmount }
  );

  // Get the tokenId
  const tokenId = await interchainTokenServiceContract.interchainTokenId(
    signer.address,
    "0x1d62d0656a5fb66d99d98270df07a9c27d898fb6b281298b2de5b2f179d271ba" // change salt
  );

  // Get the token manager address
  const expectedTokenManagerAddress =
    await interchainTokenServiceContract.tokenManagerAddress(tokenId);

  console.log(
    `
	Transaction Hash: ${deployTxData.hash},
	Token ID: ${tokenId},
	Expected token manager address: ${expectedTokenManagerAddress},
	`
  );
}

// Transfer mint access on all chains to the Expected Token Manager : Avalanche
async function transferMintAccessToTokenManagerOnAvalanche() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  const tokenContract = await getContractInstance(
    alvaAvalancheAddress,
    alvaAvaxTokenABI,
    signer
  );

  // Get the minter role
  const getMinterRole = await tokenContract.MINTER_ROLE();

  const grantRoleTxn = await tokenContract.grantRole(
    getMinterRole,
    "0x94f829bD79879a879E3F7bf31851eF1853Cc140B" // Change with token-Manager address
  );
  await grantRoleTxn.wait(2);
  console.log("grantRoleTxn: ", grantRoleTxn.hash);

  // Get the burn role
  const getBurnRole = await tokenContract.BURN_ROLE();

  const grantBrunRoleTxn = await tokenContract.grantRole(
    getBurnRole,
    "0x94f829bD79879a879E3F7bf31851eF1853Cc140B" // Change with token-Manager address
  );
  await grantBrunRoleTxn.wait(2);
  console.log("grantBrunRoleTxn: ", grantBrunRoleTxn.hash);
}

// Transfer tokens : Etheruem -> Avalanche
async function transferTokensSep2Avax() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );
  const gasAmount = await gasEstimatorEth();
  console.log("Gas AMount : ", gasAmount);
  const transfer = await interchainTokenServiceContract.interchainTransfer(
    "0xd204999e30637de0289ac8ae6800708578f813054751ac07f6e73cb11ab40aa5", // tokenId, the one you store in the earlier step
    "Avalanche",
    "0x16867a85C80cC76E4d80be0b834B7B61f96A4158", // receiver address
    ethers.parseEther("2"), // amount of token to transfer
    "0x",
    ethers.parseEther("0.0001"), // gasValue
    {
      value: gasAmount,
    }
  );

  console.log("Transfer Transaction Hash:", transfer.hash);
  // 0x65258117e8133397b047a6192cf69a1b48f59b0cb806be1c0fa5a7c1efd747ef
}

// Transfer tokens : Sepolia -> Avalanche
async function allowTokens() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  const tokenContract = await getContractInstance(
    alvaAvalancheAddress,
    alvaAvaxTokenABI,
    signer
  );

  let trx = await tokenContract.approve(
    "0x98C218879f5457cCBEca4182f023215618D93c85",
    ethers.parseEther("2")
  );

  console.log("Allow Transaction Hash:", trx.hash);

  // // Setting listing Time only for first-time on testnet
  // const time = 1720183113; //parseInt(Date.now() / 1000) + 10;
  // console.log("Time : ", time);
  // let trx2 = await tokenContract.setListingTimestamp(time);
  // console.log("Listing Transaction Hash:", trx2.hash);
}

// Transfer tokens : Avalanche -> Etheruem
async function transferTokensAvax2Sep() {
  // Get a signer to sign the transaction
  const signer = await getSigner();

  const interchainTokenServiceContract = await getContractInstance(
    interchainTokenServiceContractAddress,
    interchainTokenServiceContractABI,
    signer
  );
  const gasAmount = await gasEstimatorAvalanche();
  console.log("Gas AMount : ", gasAmount);
  const transfer = await interchainTokenServiceContract.interchainTransfer(
    "0xd204999e30637de0289ac8ae6800708578f813054751ac07f6e73cb11ab40aa5", // tokenId, the one you store in the earlier step
    "Ethereum", // ETHERUEM Chain-name
    "0x16867a85C80cC76E4d80be0b834B7B61f96A4158", // receiver address
    ethers.parseEther("0.01"), // amount of token to transfer
    "0x",
    ethers.parseEther("0.0001"), // gasValue
    {
      value: gasAmount,
    }
  );

  console.log("Transfer Transaction Hash:", transfer.hash);
  // 0x65258117e8133397b047a6192cf69a1b48f59b0cb806be1c0fa5a7c1efd747ef
}

async function main() {
  const functionName = process.env.FUNCTION_NAME;

  switch (functionName) {
    case "deployTokenManagerEth":
      await deployTokenManagerEth(); // on Eth
      break;

    case "deployRemoteTokenManager":
      await deployRemoteTokenManagerAvalanche(); // on Eth
      break;

    case "transferMintAccessToTokenManagerOnAvalanche":
      await transferMintAccessToTokenManagerOnAvalanche(); // on Avalanche
      break;

    case "transferTokensSep2Avax":
      await transferTokensSep2Avax(); // On Eth
      break;

    case "allowTokens":
      await allowTokens(); // On Eth
      break;

    case "transferTokensAvax2Sep":
      await transferTokensAvax2Sep(); // On Avalanche
      break;

    case "gasEstimatorEth":
      await gasEstimatorEth(); // Estimate gas
      break;

    case "gasEstimatorAvalanche":
      await gasEstimatorAvalanche(); // Estimate gas
      break;

    default:
      console.error(`Unknown function: ${functionName}`);
      process.exitCode = 1;
      return;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
