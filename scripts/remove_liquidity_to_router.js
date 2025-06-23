const fse = require("fs-extra");
const { ethers, upgrades, network } = require("hardhat");
const { networkConfig } = require("../helper-hardhat.config");
const erc20Artifacts = require("../artifacts/contracts/interfaces/IERC20.sol/IERC20.json");

async function main() {
  const routerABI = [
    "function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) public returns (uint amountToken, uint amountETH)"
  ];
  const erc20ABI = erc20Artifacts.abi;

  const rpc = network.config.url;
  const chainId = network.config.chainId;

  const priKey = networkConfig[chainId].deployerKey;

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const routerAddress = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3"; //Router address
  const routerContract = new ethers.Contract(routerAddress, routerABI, signer);

  const lpTokenAddress = "0xf00bd3680086341a03a2b93415d95597931fa027"; //Token Address
  const lpTokenContract = new ethers.Contract(lpTokenAddress, erc20ABI, signer);

  const tokenContractAddress = "0x6f5761432849743405551541116a0fca792c9a6e";

  const lpBalance = await lpTokenContract.balanceOf(signer.address);

  console.log("Lp balance : ", lpBalance)

  let approveTrx = await lpTokenContract.approve(
    routerAddress,
    lpBalance
  );
  console.log("Approve Trx : ", approveTrx.hash);

  await approveTrx.wait(2);

  const deadline = Math.floor(Date.now() / 1000) + 1200;

  let addLiquidityTrx = await routerContract.removeLiquidityETH(
    tokenContractAddress,
    lpBalance,
    0,
    0,
    signer.address,
    deadline,
  );

  console.log("removeLiquidityTrx Trx : ", addLiquidityTrx.hash);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
