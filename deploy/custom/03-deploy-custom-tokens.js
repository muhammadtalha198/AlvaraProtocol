const { network, ethers } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat.config");
const { verify } = require("../../utils/verify");

const wait = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = network.config.chainId;

  // // let names = ["Pea Pod"];

  let names = [
    // "Ronin", // 0xaF0940210EfDD2157F843ca8A34ea70bF6eD0c38
    "Smooth Love Potion", // 0xA52A88D2B32Ec2c6c968dAC2E896a416c7ce5C65
  ];

  // let symbols = ["M87"];

  let symbols = [
    // "RON", //0xaF0940210EfDD2157F843ca8A34ea70bF6eD0c38
    "SLP", // 0xA52A88D2B32Ec2c6c968dAC2E896a416c7ce5C65
  ];

  for (let i = 0; i < names.length; i++) {
    // const i = 5;
    const name = names[i];
    const symbol = symbols[i];

    const customToken = await deploy("CustomToken", {
      from: deployer,
      args: [],
      waitConfirmations: 1,
      proxy: {
        execute: {
          init: {
            methodName: "initialize",
            args: [name, symbol],
            owner: deployer,
          },
        },
        proxyContract: "OpenZeppelinTransparentProxy",
      },
    });

    const tokenAddress = customToken.address;
    log(`${name} deployed at ${tokenAddress}`);

    await wait(500);

    // if (!developmentChains.includes(networkConfig[chainId].name)) {
    //   await verify(tokenAddress, []);
    // }
  }
};

module.exports.tags = [
  "custom",
  "custom-token",
  "mock",
  "all-custom-test",
  "tokens",
  "all-eth"
];
