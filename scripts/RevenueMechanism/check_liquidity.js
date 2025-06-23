const { ethers } = require("hardhat");

async function main() {
    const DEFAULT_ROUTER_ADDRESS = "0x4D5C51b196292116CE851Dd622F77EB2D3a85F76"; // Router address
    const DEFAULT_WETH_ADDRESS = "0x57112DD160Ee9A8E2722DCcF1d977B530Ff61a17"; // WETH address
    const DEFAULT_ALVA_ADDRESS = "0x960545D39568423B7e707a2A16d61408a5b9Bf82"; // ALVA token address

    // Parse command line arguments
    const args = process.argv.slice(2);
    const routerAddress = args[0] || DEFAULT_ROUTER_ADDRESS;
    const tokenAddress = args[1] || DEFAULT_ALVA_ADDRESS;
    const wethAddress = args[2] || DEFAULT_WETH_ADDRESS;

    try {
        // Get the custom router contract
        const router = await ethers.getContractAt("UniswapV2Router02", routerAddress);
        
        // Get token details from the router
        const tokenDetail = await router.getTokenDetails(tokenAddress);
        const wethDetail = await router.getTokenDetails(wethAddress);
        
        // Check token balances
        const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", tokenAddress);
        const weth = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", wethAddress);
        
        const tokenManagerBalance = await token.balanceOf(tokenDetail.tokenManager);
        const wethManagerBalance = await weth.balanceOf(wethDetail.tokenManager);
        
        // Check allowances
        const tokenManagerAllowance = await token.allowance(tokenDetail.tokenManager, routerAddress);
        const wethManagerAllowance = await weth.allowance(wethDetail.tokenManager, routerAddress);
        
        // Calculate swap amounts
        const testAmount = ethers.parseEther("0.01"); // 0.01 ETH
        const path = [wethAddress, tokenAddress];
        const amounts = await router.getAmountsOut(testAmount, path);
        
        console.log(`\nAvailable Liquidity:`);
        console.log(`-----------------`);
        console.log(`Router Address: ${routerAddress}`);
        console.log(`Token: ${tokenAddress}`);
        console.log(`WETH: ${wethAddress}`);
        console.log(`Token Manager Balance: ${ethers.formatEther(tokenManagerBalance)} tokens`);
        console.log(`WETH Manager Balance: ${ethers.formatEther(wethManagerBalance)} WETH`);
        console.log(`Token Price: ${ethers.formatEther(tokenDetail.price)} ETH`);
        console.log(`For 0.01 ETH, you get ${ethers.formatEther(amounts[1])} tokens`);
        return true;
        
    } catch (error) {
        console.error("\nERROR: Cannot check liquidity -", error.message);
        return false;
    }
}

// Execute the script
main()
    .then((result) => {
        process.exit(result ? 0 : 1);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
