const fse = require("fs-extra");
const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const erc20Artifacts = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");

async function main() {
  const routerABI = [
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable",
  ];
  const erc20ABI = erc20Artifacts.abi;

  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const routerAddress = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; //Router address
  const routerContract = new ethers.Contract(routerAddress, routerABI, signer);

  const tokenAddress = "0x6f5761432849743405551541116a0fca792c9a6e"; //Token Address
  const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);

  let approveTrx = await tokenContract.approve(
    routerAddress,
    ethers.parseEther("100000000000000000")
  );
  console.log("Approve Trx : ", approveTrx.hash);

  await approveTrx.wait(2);

  let ethPriceInUSD = ethers.parseEther("1901.04");
  let tokenPriceInUSD = ethers.parseEther("1");

  let tokenPricePerEth = ethPriceInUSD / tokenPriceInUSD;
  tokenPricePerEth *= BigInt(1e18);
  let sliipage = tokenPricePerEth - (tokenPricePerEth / BigInt(100));
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  console.log("tokenPricePerEth : ", tokenPricePerEth)
  console.log("sliipage : ", sliipage)
  console.log("deadline : ", deadline)
  

  let addLiquidityTrx = await routerContract.addLiquidityETH(
    tokenAddress,
    tokenPricePerEth,
    sliipage,
    ethers.parseEther("0.99"),
    signer.address,
    deadline,
    { value: ethers.parseEther("1") }
  );

  console.log("addLiquidityTrx Trx : ", addLiquidityTrx.hash);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
