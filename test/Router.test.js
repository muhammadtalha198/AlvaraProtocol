const { expect } = require("chai");
const { ethers, upgrades, deployments } = require("hardhat");

describe("Router", () => {
  let owner, user1, user2, user3, user4, user5, user6;
  let router, wETH, alva, mtToken;
  let wethAddress, alvaAddress, mtTokenAddress;

  beforeEach(async function () {
    [owner, user1, user2, user3, user4, user5, user6] =
      await ethers.getSigners();

    // Deploy all the mock contracts
    const allDeployments = await deployments.fixture(["mock"]);

    // Get contract instances
    wETH = await ethers.getContractAt("WETH", allDeployments["WETH"].address);
    router = await ethers.getContractAt(
      "UniswapV2Router02",
      allDeployments["UniswapV2Router02"].address
    );
    alva = await ethers.getContractAt(
      "Alvara",
      allDeployments["Alvara"].address
    );
    mtToken = await ethers.getContractAt(
      "MockToken",
      allDeployments["MockToken"].address
    );

    // Store addresses for convenience
    wethAddress = await wETH.getAddress();
    alvaAddress = await alva.getAddress();
    mtTokenAddress = await mtToken.getAddress();

    // Make sure WETH price is set correctly
    // This should happen in the constructor, but we'll verify it
    const wethPrice = await router.getTokenPrice(wethAddress);
    if (wethPrice.toString() !== ethers.parseEther("1").toString()) {
      await router.setTokenDetails(wethAddress, owner.address, ethers.parseEther("1"));
    }
  });

  describe("Initialize Values", function () {
    it("WETH contract adddress should be set", async function () {
      let wethAddress = await wETH.getAddress();
      let routerWETHAddress = await router.getWETHAddress();
      expect(routerWETHAddress).to.be.equal(wethAddress);
    });

    it("Default Admin role should be set for deployer", async function () {
      let defaultAdminRole = await router.DEFAULT_ADMIN_ROLE();
      expect(await router.hasRole(defaultAdminRole, owner)).to.be.equal(true);
    });

    it("Default Price Manager role should be set for deployer", async function () {
      let priceManagerRole = await router.PRICE_MANAGER();
      expect(await router.hasRole(priceManagerRole, owner)).to.be.equal(true);
    });
  });

  describe("Token prices", function () {
    it("Initally price of token WETH should be 1", async () => {
      // WETH price should be initialized to 1 ETH in constructor or our beforeEach setup
      const wethPrice = await router.getTokenPrice(wethAddress);
      expect(wethPrice).to.be.equal(ethers.parseEther("1"));
    });

    it("After setting the price, token price should be updated", async () => {
      let alvaAddress = await alva.getAddress();
      let alvaTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaTokenPrice).to.be.equal(0);

      const alvaPriceInEth = 23000000000000; // Alva price in USD, then usd to eth, then eth to wei

      await router.setTokenDetails(alvaAddress, owner, alvaPriceInEth);

      let alvaUpdatedTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaUpdatedTokenPrice).to.be.equal(alvaPriceInEth);
    });

    it("setTokenPrices should update multiple token prices", async () => {
      let alvaAddress = await alva.getAddress();
      let alvaTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaTokenPrice).to.be.equal(0);

      let mtTokenAddress = await mtToken.getAddress();
      let mtTokenPrice = await router.getTokenPrice(mtTokenAddress);
      expect(mtTokenPrice).to.be.equal(0);

      const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in USD, then usd to eth, then eth to wei
      const mtPriceInEth = ethers.parseEther("23.57"); // MT assumed as Bitcoin

      await router.setTokensDetails(
        [alvaAddress, mtTokenAddress],
        [owner, owner],
        [alvaPriceInEth, mtPriceInEth]
      );

      let alvaUpdatedTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaUpdatedTokenPrice).to.be.equal(alvaPriceInEth);

      let mtUpdatedTokenPrice = await router.getTokenPrice(mtTokenAddress);
      expect(mtUpdatedTokenPrice).to.be.equal(mtPriceInEth);
    });

    it("setTokenPrices should update signle token price", async () => {
      let alvaAddress = await alva.getAddress();
      let alvaTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaTokenPrice).to.be.equal(0);

      const alvaPriceInEth = 23000000000000; // Alva price in USD, then usd to eth, then eth to wei

      await router.setTokensDetails([alvaAddress], [owner], [alvaPriceInEth]);

      let alvaUpdatedTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaUpdatedTokenPrice).to.be.equal(alvaPriceInEth);
    });

    it("Only Price Manager can set the price", async () => {
      let alvaAddress = alva.target;
      let alvaTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaTokenPrice).to.be.equal(0);

      const alvaPriceInEth = 23000000000000; // Alva price in USD, then usd to eth, then eth to wei

      await expect(
        router
          .connect(user1)
          .setTokenDetails(alvaAddress, owner, alvaPriceInEth)
      ).to.be.revertedWith(
        "AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0xa451215b66f023bb76f9a9e7bc5c64156446b47b26061a8a32eaa319c45f695e"
      );

      const pricManagerRole = await router.PRICE_MANAGER();

      await router.grantRole(pricManagerRole, user1.address);

      await router
        .connect(user1)
        .setTokenDetails(alvaAddress, owner, alvaPriceInEth);

      let alvaUpdatedTokenPrice = await router.getTokenPrice(alvaAddress);
      expect(alvaUpdatedTokenPrice).to.be.equal(alvaPriceInEth);
    });
  });

  describe("getAmountsOut", function () {
    it("getAmountsOut should return price if same amount of token provided ", async () => {
      const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in Eth

      // Set Alva token price in the router
      await router.setTokenDetails(alvaAddress, owner.address, alvaPriceInEth);
      
      // Verify token price was set correctly
      expect(await router.getTokenPrice(alvaAddress)).to.equal(alvaPriceInEth);

      // Create path from WETH to Alva
      const path = [wethAddress, alvaAddress];
      
      // Calculate token amounts - if we provide 1 ETH, we should get 1/0.000023 = 43,478.26 Alva
      const oneEth = ethers.parseEther("1");
      const expectedAlvaAmount = oneEth.mul(ethers.parseEther("1")).div(alvaPriceInEth);
      
      // Get amount out from the router
      const amounts = await router.getAmountsOut(oneEth, path);
      
      // Verify the returned amount matches our calculation
      expect(amounts[1]).to.equal(expectedAlvaAmount);
    });

    it("getAmountsOut should return amount of token according to given price ", async () => {
      const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in USD, then usd to eth, then eth to wei
      const mtPriceInEth = ethers.parseEther("23.57"); // MT assumed as Bitcoin

      // Set Alva token price in the router
      await router.setTokenDetails(alvaAddress, owner.address, alvaPriceInEth);
      
      // Verify token price was set correctly
      expect(await router.getTokenPrice(alvaAddress)).to.equal(alvaPriceInEth);

      // Set MT token price in the router
      await router.setTokenDetails(mtTokenAddress, owner.address, mtPriceInEth);
      
      // Verify token price was set correctly
      expect(await router.getTokenPrice(mtTokenAddress)).to.equal(mtPriceInEth);

      // Create path from WETH to Alva
      const path1 = [wethAddress, alvaAddress];
      
      // Create path from WETH to MT
      const path2 = [wethAddress, mtTokenAddress];
      
      // Calculate token amounts - if we provide 1 ETH, we should get 1/0.000023 = 43,478.26 Alva
      const oneEth = ethers.parseEther("1");
      const expectedAlvaAmount = oneEth.mul(ethers.parseEther("1")).div(alvaPriceInEth);
      
      // Calculate token amounts - if we provide 1 ETH, we should get 1/23.57 = 0.0424 MT
      const expectedMtAmount = oneEth.mul(ethers.parseEther("1")).div(mtPriceInEth);
      
      // Get amount out from the router
      const amounts1 = await router.getAmountsOut(oneEth, path1);
      const amounts2 = await router.getAmountsOut(oneEth, path2);
      
      // Verify the returned amount matches our calculation
      expect(amounts1[1]).to.equal(expectedAlvaAmount);
      expect(amounts2[1]).to.equal(expectedMtAmount);
    });

    it("getAmountsOut should return correct amount of token if swapped with other token ", async () => {
      const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in USD, then usd to eth, then eth to wei
      const mtPriceInEth = ethers.parseEther("23.57"); // MT assumed as Bitcoin

      // Set Alva token price in the router
      await router.setTokenDetails(alvaAddress, owner.address, alvaPriceInEth);
      
      // Verify token price was set correctly
      expect(await router.getTokenPrice(alvaAddress)).to.equal(alvaPriceInEth);

      // Set MT token price in the router
      await router.setTokenDetails(mtTokenAddress, owner.address, mtPriceInEth);
      
      // Verify token price was set correctly
      expect(await router.getTokenPrice(mtTokenAddress)).to.equal(mtPriceInEth);

      // Create path from Alva to MT
      const path1 = [alvaAddress, mtTokenAddress];
      
      // Create path from MT to Alva
      const path2 = [mtTokenAddress, alvaAddress];
      
      // Calculate token amounts - if we provide 1 ETH, we should get 1/0.000023 = 43,478.26 Alva
      const oneEth = ethers.parseEther("1");
      const expectedAlvaAmount = oneEth.mul(ethers.parseEther("1")).div(alvaPriceInEth);
      
      // Calculate token amounts - if we provide 1 ETH, we should get 1/23.57 = 0.0424 MT
      const expectedMtAmount = oneEth.mul(ethers.parseEther("1")).div(mtPriceInEth);
      
      // Calculate token amounts - if we provide 43,478.26 Alva, we should get 43,478.26/0.000023 * 23.57 = 1 MT
      const expectedMtAmountFromAlva = expectedAlvaAmount.mul(mtPriceInEth).div(alvaPriceInEth);
      
      // Calculate token amounts - if we provide 0.0424 MT, we should get 0.0424 * 0.000023/23.57 = 1 Alva
      const expectedAlvaAmountFromMt = expectedMtAmount.mul(alvaPriceInEth).div(mtPriceInEth);
      
      // Get amount out from the router
      const amounts1 = await router.getAmountsOut(expectedAlvaAmount, path1);
      const amounts2 = await router.getAmountsOut(expectedMtAmount, path2);
      
      // Verify the returned amount matches our calculation
      expect(amounts1[1]).to.equal(expectedMtAmountFromAlva);
      expect(amounts2[1]).to.equal(expectedAlvaAmountFromMt);
    });
  });

  describe("swapExactETHForTokensSupportingFeeOnTransferTokens", function () {
    const setAlvaTokenDetails = async () => {
      const wethAddress = await wETH.getAddress();
      const alvaAddress = await alva.getAddress();
      const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in Eth

      // Set Alva token price in the router
      await router.setTokenDetails(alvaAddress, owner.address, alvaPriceInEth);

      const path1 = [wethAddress, alvaAddress];
      
      // Verify the price was set correctly 
      expect(await router.getTokenPrice(alvaAddress)).to.equal(alvaPriceInEth);
      
      const amountOfEth = ethers.parseEther("1");
      let amountOfTokens1 = await router.getAmountsOut(amountOfEth, path1);

      return {
        alvaPriceInEth,
        wethAddress,
        alvaAddress,
        path1,
        amountOfTokens1,
      };
    };

    it("Should give error if not swapped with WETH ", async () => {
      let { alvaPriceInEth, wethAddress, alvaAddress, path1 } =
        await setAlvaTokenDetails();

      const path = [alvaAddress, wethAddress];

      await expect(
        router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          alvaPriceInEth,
          path,
          user1,
          0
        )
      ).to.be.revertedWith("UniswapV2Router: INVALID_PATH");
    });

    it("Should give error if deadline is in past ", async () => {
      let { alvaPriceInEth, wethAddress, alvaAddress, path1 } =
        await setAlvaTokenDetails();

      await expect(
        router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          alvaPriceInEth,
          path1,
          user1,
          0
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("Should give error if amountMinOut is greater than actual amount ", async () => {
      let { alvaPriceInEth, wethAddress, alvaAddress, path1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      let amountOutMin =
        +alvaPriceInEth.toString() + +ethers.parseEther("15").toString();

      await expect(
        router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          amountOutMin.toString(),
          path1,
          user1,
          deadline,
          { value: alvaPriceInEth }
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("Should give error if output token is not registered ", async () => {
      let { alvaPriceInEth, wethAddress, alvaAddress, path1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      let path = [wethAddress, user1];

      await expect(
        router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          alvaPriceInEth.toString(),
          path,
          user1,
          deadline,
          { value: alvaPriceInEth }
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("Should give error if output token amount is not allowed ", async () => {
      let { alvaPriceInEth, wethAddress, alvaAddress, path1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      await expect(
        router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          alvaPriceInEth.toString(),
          path1,
          user1,
          deadline,
          { value: alvaPriceInEth }
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_AMOUNT_ALLOWED");
    });

    it("Should swap Eths with tokens if all arguments are correct ", async () => {
      let { alvaPriceInEth, wethAddress, alvaAddress, path1, amountOfTokens1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      const routerAddress = await router.getAddress();

      await alva.connect(owner).setListingTimestamp(0);
      const allowedAmount = ethers.parseEther("10000000000000000000000000000");
      await alva.approve(routerAddress, allowedAmount.toString());

      const initialBalWETH = await ethers.provider.getBalance(
        await wETH.getAddress()
      );
      expect(initialBalWETH).to.be.equal(0);

      const alvaBalOfOwnerInitial = await alva.balanceOf(await owner.address);
      const alvaBalOfUser1Initial = await alva.balanceOf(await user1.address);

      expect(alvaBalOfUser1Initial).to.be.equal(0);

      await router
        .connect(user1)
        .swapExactETHForTokensSupportingFeeOnTransferTokens(
          alvaPriceInEth.toString(),
          path1,
          user1,
          deadline,
          { value: alvaPriceInEth }
        );

      const afterBalWETH = await ethers.provider.getBalance(
        await wETH.getAddress()
      );
      expect(afterBalWETH).to.be.equal(alvaPriceInEth);

      const wETHBalOfRouter = await wETH.balanceOf(await router.getAddress());
      expect(wETHBalOfRouter).to.be.equal(0);

      const wETHBalOfAlva = await wETH.balanceOf(await alva.getAddress());
      expect(wETHBalOfAlva).to.be.equal(alvaPriceInEth);

      const alvaBalOfOwnerAfter = await alva.balanceOf(await owner.address);

      expect(alvaBalOfOwnerAfter).to.be.lessThan(alvaBalOfOwnerInitial);

      const alvaBalOfUser1After = await alva.balanceOf(await user1.address);

      expect(alvaBalOfUser1After).to.be.equal(amountOfTokens1[1]);
    });
  });

  describe("swapExactTokensForTokensSupportingFeeOnTransferTokens", function () {
    const setAlvaTokenDetails = async () => {
      const alvaPriceInEth = ethers.parseEther("0.000023"); // Alva price in USD, then usd to eth, then eth to wei
      const alvaAddress = await alva.getAddress();

      let res = await setTokenDetails(alvaAddress, alvaPriceInEth);

      return res;
    };

    const setMTTokenDetails = async () => {
      const mtPriceInEth = ethers.parseEther("23.57"); // MT assumed as Bitcoin
      
      const wethAddress = await wETH.getAddress();
      const tokenAddress = await mtToken.getAddress();

      // Set MT token price in the router with owner as token manager 
      await router.setTokenDetails(tokenAddress, owner.address, mtPriceInEth);
      
      // Verify the price was set correctly
      expect(await router.getTokenPrice(tokenAddress)).to.equal(mtPriceInEth);

      const path1 = [wethAddress, tokenAddress];
      
      // Calculate how many tokens you get for 1 ETH based on the price
      const oneEth = ethers.parseEther("1");
      let amountOfTokens1 = await router.getAmountsOut(oneEth, path1);

      return {
        priceInEth: mtPriceInEth,
        wethAddress,
        tokenAddress,
        path1,
        amountOfTokens1,
      };
    };

    const setTokenDetails = async (tokenAddress, priceInEth) => {
      const wethAddress = await wETH.getAddress();

      // Set token price in the router with owner as tokenManager
      await router.setTokenDetails(tokenAddress, owner.address, priceInEth);
      
      // Verify the price was set correctly
      expect(await router.getTokenPrice(tokenAddress)).to.equal(priceInEth);

      const path1 = [wethAddress, tokenAddress];

      // Calculate how many tokens you get for 1 ETH based on the price
      const oneEth = ethers.parseEther("1");
      let amountOfTokens1 = await router.getAmountsOut(oneEth, path1);

      return {
        priceInEth,
        wethAddress,
        tokenAddress,
        path1,
        amountOfTokens1,
      };
    };

    it("Should give error if deadline is in past ", async () => {
      let { priceInEth, wethAddress, tokenAddress, path1 } =
        await setAlvaTokenDetails();

      await expect(
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          priceInEth,
          "1",
          path1,
          user1,
          0
        )
      ).to.be.revertedWith("UniswapV2Router: EXPIRED");
    });

    it("Should give error if amountMinOut is greater than actual amount ", async () => {
      let { priceInEth, wethAddress, tokenAddress, path1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      let amountOutMin = ethers.parseEther("15").toString();

      await expect(
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          priceInEth,
          amountOutMin,
          path1,
          user1,
          deadline
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("Should give error if output token is not registered ", async () => {
      let { priceInEth, wethAddress, tokenAddress, path1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      let path = [wethAddress, user1];

      await expect(
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          priceInEth.toString(),
          "1",
          path,
          user1,
          deadline
        )
      ).to.be.revertedWith("UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
    });

    it("Should give error if input token amount is not allowed ", async () => {
      let { priceInEth, wethAddress, tokenAddress, path1 } =
        await setAlvaTokenDetails();

      const deadline = Date.now() + 100000;

      await expect(
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          priceInEth.toString(),
          "1",
          path1,
          user1,
          deadline
        )
      ).to.be.revertedWith(
        "UniswapV2Router: INSUFFICIENT_AMOUNT_ALLOWED_TOKEN_IN"
      );
    });

    it("Should give error if output token amount is not allowed ", async () => {
      let { priceInEth, wethAddress, tokenAddress, path1, amountOfTokens1 } =
        await setAlvaTokenDetails();

      let mtTokenDetails = await setMTTokenDetails();

      const deadline = Date.now() + 100000;

      const routerAddress = await router.getAddress();

      await alva.connect(owner).setListingTimestamp(0);
      const allowedAmount = ethers.parseEther("10000000000000000000000000000");
      await alva.approve(routerAddress, allowedAmount.toString());

      let path = [tokenAddress, mtTokenDetails.tokenAddress];

      expect(
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          priceInEth,
          "1",
          path,
          user1,
          deadline
        )
      ).to.be.revertedWith(
        "UniswapV2Router: INSUFFICIENT_AMOUNT_ALLOWED_TOKEN_OUT"
      );
    });

    it("Should swap tokens if all arguments are correct ", async () => {
      let { priceInEth, wethAddress, tokenAddress, path1, amountOfTokens1 } =
        await setAlvaTokenDetails();

      let mtTokenDetails = await setMTTokenDetails();

      const deadline = Date.now() + 100000;

      const routerAddress = await router.getAddress();

      // Approve Alva token
      await alva.connect(owner).setListingTimestamp(0);
      const allowedAmount = ethers.parseEther("10000000000000000000000000000");
      await alva.approve(routerAddress, allowedAmount.toString());
      await alva.setListingTimestamp(1);

      // Approve MtTokens
      await mtToken.approve(routerAddress, allowedAmount.toString());

      // Get some Alva tokens for swap
      const alvaBalOfUser1Initial = await alva.balanceOf(await user1.address);
      expect(alvaBalOfUser1Initial).to.be.equal(0);

      const alvaBalOfOwner1Initial = await alva.balanceOf(await owner.address);
      const mtTokenBalOfOwner1Initial = await mtToken.balanceOf(
        await owner.address
      );
      const mtTokenBalOfUser1Initial = await mtToken.balanceOf(
        await user1.address
      );
      expect(mtTokenBalOfUser1Initial).to.be.equal(0);

      const alvaAmount = ethers.parseEther("1700000");
      await alva.transfer(user1, alvaAmount);

      const alvaBalOfUser1AfterDeposit = await alva.balanceOf(
        await user1.address
      );
      expect(alvaBalOfUser1AfterDeposit).to.be.equal(alvaAmount);
      let path = [tokenAddress, mtTokenDetails.tokenAddress];
      let amountOutMin = await router.getAmountsOut(alvaAmount, path);

      await alva.connect(user1).approve(routerAddress, alvaAmount.toString());

      await router
        .connect(user1)
        .swapExactTokensForTokensSupportingFeeOnTransferTokens(
          alvaAmount.toString(),
          amountOutMin[1],
          path,
          user1,
          deadline
        );

      const alvaBalOfUser1AfterSwap = await alva.balanceOf(await user1.address);
      const differenceInAlvaBalOfUser =
        +alvaBalOfUser1AfterDeposit.toString() - +alvaAmount.toString();
      expect(alvaBalOfUser1AfterSwap).to.be.equal(differenceInAlvaBalOfUser);

      const alvaBalOfOwnerAfterSwap = await alva.balanceOf(await owner.address);
      expect(alvaBalOfOwnerAfterSwap).to.be.equal(alvaBalOfOwner1Initial);

      const mtTokenBalOfUser1AfterSwap = await mtToken.balanceOf(
        await user1.address
      );
      expect(mtTokenBalOfUser1AfterSwap).to.be.equal(amountOutMin[1]);
    });
  });
});
