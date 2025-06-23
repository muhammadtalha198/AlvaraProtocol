const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const customTokenABI = require("../artifacts/contracts/Mock/CustomToken.sol/CustomToken.json");

async function main() {
  const tokenABI = customTokenABI.abi;
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;
  // "SHIBA INU", //0x2aF89eD60c7213b742033cBcc0abb25c26d824FA
  // "Cult DAO", //0xDe06799Fd25406D65733B011B136a1D6e8f3A22A
  // "Pepe", // 0xd35db61Cf5732b294b17b58E397Ccff55775f978
  // "MESSIER", // 0x6F91e17034ee3fE309De9dE741F3C7Ab33061b63
  // "Coq Inu", // 0x9AcE19E8C7EF67D3288cf39f55aba15927141E05
  // "Bencoin", //0xF3e07F71f0cD10fE4E61Bf4F794d9811a3BA029F

  const tokenAddress = "0xF3e07F71f0cD10fE4E61Bf4F794d9811a3BA029F";

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer);

  const mintTrx = await tokenContract.mint();

  console.log("mint trx : ", mintTrx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
