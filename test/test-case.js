const { ethers, upgrades } = require("hardhat");

describe("Factory", () => {
  it("Should initialize with right parameters", async () => {
    const [owner] = await ethers.getSigners();

    const wethHolderAddress = "0x8EB8a3b98659Cce290402893d0123abb75E3ab28";
    const uniswapRouterAddress = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008";
    const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
    const DAI = "0x69e1E3Ecb93acb8271d4392D71a04076c22d799a";
    const USDT = "0xC3121820dEB161CFBe30e3855790fDcd1084d3f6";
    const USDC = "0xc07268AC290065A04fe11a4a1b7C85F59Bd28265";

    const weth = await ethers.getContractAt("IERC20Upgradeable", WETH);
    const dai = await ethers.getContractAt("IERC20Upgradeable", DAI);
    const usdt = await ethers.getContractAt("IERC20Upgradeable", USDT);
    const usdc = await ethers.getContractAt("IERC20Upgradeable", USDC);

    const BTS = await ethers.getContractFactory("BasketTokenStandard");
    const bts1 = await BTS.deploy();
    console.log("bts", bts1.address);

    const BTSPair = await ethers.getContractFactory("BasketTokenStandardPair");
    const btsPair1 = await BTSPair.deploy();
    console.log("btsPair1", btsPair1.address);

    const Factory = await hre.ethers.getContractFactory("Factory");
    const factory = await hre.upgrades.deployProxy(Factory, [
      dai.address,
      500,
      bts1.address,
      btsPair1.address,
    ]);
    await factory.deployed();
    console.log("factory", factory.address);

    await factory.createBTS(
      "hi",
      "HI",
      [dai.address],
      [10000],
      "Test",
      false,
      4500,
      "Test Description",
      {
        value: ethers.utils.parseEther("1"),
      }
    );

    const btsAddress = await factory.ownerToBTS(owner.address, 0);
    console.log("bts address", btsAddress);
    const bts = await ethers.getContractAt("BasketTokenStandard", btsAddress);
    console.log("BTS", bts.address);

    console.log("Owner BTS count", await bts.balanceOf(owner.address));

    const btsPairAddress = await bts.btsPair();
    const btsPair = await ethers.getContractAt(
      "BasketTokenStandardPair",
      btsPairAddress
    );
    console.log("owner of BTS Pair", await btsPair.owner());
    console.log("BTS Pair", btsPair.address);
    console.log(
      "LP tokens after minting",
      await btsPair.balanceOf(owner.address)
    );

    console.log(
      "\nBalance of DAI on BTS Pair and Owner",
      (await dai.balanceOf(btsPair.address)) / 1e18,
      (await dai.balanceOf(owner.address)) / 1e18
    );
    console.log(
      "Balance of USDT on BTS and Owner",
      (await usdt.balanceOf(btsPair.address)) / 1e6,
      (await usdt.balanceOf(owner.address)) / 1e6
    );
    console.log(
      "Balance of USDC on BTS Pair and Owner",
      (await usdc.balanceOf(btsPair.address)) / 1e6,
      (await usdc.balanceOf(owner.address)) / 1e6
    );

    console.log(
      "calculate the share of LP",
      await btsPair.calculateShareLP(ethers.utils.parseEther("1"))
    );
    console.log(
      "calculate the share of ETH",
      await btsPair.calculateShareETH(ethers.utils.parseEther("1"))
    );
    console.log(
      "calculate the share of tokens",
      await btsPair.calculateShareTokens(ethers.utils.parseEther("1"))
    );

    await bts.contribute(1000, { value: ethers.utils.parseEther("1") });
    console.log(
      "LP tokens after contribution",
      await btsPair.balanceOf(owner.address)
    );

    console.log(
      "\nBalance of DAI on BTS Pair and Owner after Contribute",
      (await dai.balanceOf(btsPair.address)) / 1e18,
      (await dai.balanceOf(owner.address)) / 1e18
    );
    console.log(
      "Balance of USDT on BTS Pair and Owner after Contribute",
      (await usdt.balanceOf(btsPair.address)) / 1e6,
      (await usdt.balanceOf(owner.address)) / 1e6
    );
    console.log(
      "Balance of USDC on BTS Pair and Owner after Contribute",
      (await usdc.balanceOf(btsPair.address)) / 1e6,
      (await usdc.balanceOf(owner.address)) / 1e6
    );

    await btsPair.approve(bts.address, await btsPair.balanceOf(owner.address));

    console.log(
      "\nBefore balance of WETH on Owner after Withdraw",
      (await weth.balanceOf(owner.address)) / 1e18
    );

    await bts.withdrawETH(ethers.utils.parseEther("100"), 1000);

    console.log(
      "After balance of WETH on Owner after Withdraw",
      (await weth.balanceOf(owner.address)) / 1e18
    );

    await bts.withdraw(ethers.utils.parseEther("100"));

    console.log(
      "\nBalance of DAI on BTS Pair and Owner after Withdraw",
      (await dai.balanceOf(btsPair.address)) / 1e18,
      (await dai.balanceOf(owner.address)) / 1e18
    );
    console.log(
      "Balance of USDT on BTS Pair and Owner after Withdraw",
      (await usdt.balanceOf(btsPair.address)) / 1e6,
      (await usdt.balanceOf(owner.address)) / 1e6
    );
    console.log(
      "Balance of USDC on BTS Pair and Owner after Withdraw",
      (await usdc.balanceOf(btsPair.address)) / 1e6,
      (await usdc.balanceOf(owner.address)) / 1e6
    );

    console.log(
      "balance of eth after",
      await ethers.provider.getBalance(owner.address)
    );

    console.log("balance on BTS Pair", await usdc.balanceOf(btsPair.address));

    await dai.approve(uniswapRouterAddress, ethers.utils.parseEther("1000"));
    await usdc.approve(uniswapRouterAddress, ethers.utils.parseEther("1000"));
    await usdc.approve(uniswapRouterAddress, ethers.utils.parseEther("1000"));

    await bts.rebalance(
      [dai.address, usdc.address, usdt.address],
      [7000, 2000, 1000],
      1000
    );

    await bts.contribute(1000, { value: ethers.utils.parseEther("1") });
    console.log(
      "LP tokens after contribution",
      await btsPair.balanceOf(owner.address)
    );

    console.log(
      "\nBalance of DAI on BTS Pair and Owner after Rebalance",
      (await dai.balanceOf(btsPair.address)) / 1e18,
      (await dai.balanceOf(owner.address)) / 1e18
    );
    console.log(
      "Balance of USDT on BTS Pair and Owner after Rebalance",
      (await usdt.balanceOf(btsPair.address)) / 1e6,
      (await usdt.balanceOf(owner.address)) / 1e6
    );
    console.log(
      "Balance of USDC on BTS Pair and Owner after Rebalance",
      (await usdc.balanceOf(btsPair.address)) / 1e6,
      (await usdc.balanceOf(owner.address)) / 1e6
    );

    await bts.withdraw(ethers.utils.parseEther("100"));

    console.log(
      "\nBalance of DAI on BTS Pair and Owner after Withdraw",
      (await dai.balanceOf(btsPair.address)) / 1e18,
      (await dai.balanceOf(owner.address)) / 1e18
    );
    console.log(
      "Balance of USDT on BTS Pair and Owner after Withdraw",
      (await usdt.balanceOf(btsPair.address)) / 1e6,
      (await usdt.balanceOf(owner.address)) / 1e6
    );
    console.log(
      "Balance of USDC on BTS Pair and Owner after Withdraw",
      (await usdc.balanceOf(btsPair.address)) / 1e6,
      (await usdc.balanceOf(owner.address)) / 1e6
    );

    await bts.updateUpperLimit(1);
    await bts.updateLowerLimit(1);
  });
});
