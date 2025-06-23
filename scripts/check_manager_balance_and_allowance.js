const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const customTokenABI = require("../artifacts/contracts/Mock/CustomToken.sol/CustomToken.json");

async function main() {

  // '0x0fc4580f70C517B148a141f3721C5138f74401b1',
  //     '0x1497cf7bbFd5EDD039E47aCe640A84C14353aF7d',
  //     '0x223f073760e580e9F2f8da9629654bA56E721038',
  //     '0x9765bD06cb869A3514Bd014DD7582f18654ECb1a',
  //     '0x621e4B9938d94e49e88F6d631f5Cce053B4628A1',
  //     '0xEd587c2Ae187B4b2D6c878C56cfe5C15f718bCcc',
  //   '0x9272CDb136d233aE5bFB4a3091D4c123c1cfCcE2'


  // "SHIBA INU", //0x2aF89eD60c7213b742033cBcc0abb25c26d824FA
  // "Cult DAO", //0xDe06799Fd25406D65733B011B136a1D6e8f3A22A
  // "Pepe", // 0xd35db61Cf5732b294b17b58E397Ccff55775f978
  // "MESSIER", // 0x6F91e17034ee3fE309De9dE741F3C7Ab33061b63
  // "Coq Inu", // 0x9AcE19E8C7EF67D3288cf39f55aba15927141E05
  // "Bencoin", //0xF3e07F71f0cD10fE4E61Bf4F794d9811a3BA029F

  
  const tokenABI = customTokenABI.abi;
  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;
  const tokenAddress = "0x2aF89eD60c7213b742033cBcc0abb25c26d824FA";
  const isTrxRequired = false;

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer);

  const managerAddress = "0xA5de4D331f7A61dd0179b4f1493EC1e2D713AE29";
  const routerAddress = "0x73f19dECFd263f09139c5A4DEe9B5aBc535828DF";

  /**
   * Check manager token balance
   */
  let managerBalance = await tokenContract.balanceOf(managerAddress);

  // console.log("Manager Balance : ", ethers.utils.formatEther(managerBalance));
  console.log("Manager Balance : ", managerBalance);

  /**
   * Check allowance token balance
   */
  let managerAllowance = await tokenContract.allowance(
    managerAddress,
    routerAddress
  );

  // console.log("Manager Allowance : ", ethers.utils.formatEther(managerAllowance));
  console.log("Manager Allowance : ", managerAllowance);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
