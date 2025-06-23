const fse = require("fs-extra");
const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");

async function main() {
  const customTokenABIFilePath =
    "artifacts/contracts/Mock/CustomToken.sol/CustomToken.json";
  const tokenABI = fse.readJSONSync(customTokenABIFilePath).abi;

  const routerFilePath =
    "artifacts/contracts/Mock/UniswapV2Router02.sol/UniswapV2Router02.json";

  const routerABI = fse.readJSONSync(routerFilePath).abi;

  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  // let tokenAddress = ["0x621e4B9938d94e49e88F6d631f5Cce053B4628A1"];
  let tokenAddress = [
    "0xaF0940210EfDD2157F843ca8A34ea70bF6eD0c38", // Ronin
    "0xA52A88D2B32Ec2c6c968dAC2E896a416c7ce5C65", // Smooth Love Potion
    

  ];

  let tokenManagers = [
    "0xA5de4D331f7A61dd0179b4f1493EC1e2D713AE29",
    "0xA5de4D331f7A61dd0179b4f1493EC1e2D713AE29",
  ];

  let prices = [
    ethers.parseEther("10000"), // BEAM
    ethers.parseEther("10000"), // BEAM
  ];

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const routerAddress = "0x73f19dECFd263f09139c5A4DEe9B5aBc535828DF";
  const routerContract = new ethers.Contract(routerAddress, routerABI, signer);

  for (let i = 0; i < tokenAddress.length; i++) {
    let tokenContract = new ethers.Contract(tokenAddress[i], tokenABI, signer);

    let allowedAmount = ethers.parseEther("10000000000000000000000000000");

    const approveAmount = await tokenContract.allowance("0xA5de4D331f7A61dd0179b4f1493EC1e2D713AE29", routerAddress);

    if (approveAmount == 0) {
      let approveTrx = await tokenContract.approve(routerAddress, allowedAmount);
      console.log("Approve Trx : ", approveTrx.hash);        
    } else {
      console.log("Already approved ............... ");              
    }

  }

  let setTokenDetailsTrx = await routerContract.setTokensDetails(
    tokenAddress,
    tokenManagers,
    prices
  );

  console.log("setTokenDetails Trx : ", setTokenDetailsTrx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
