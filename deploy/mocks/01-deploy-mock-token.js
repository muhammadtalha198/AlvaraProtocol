module.exports = async ({ getNamedAccounts, deployments }) => {
  const { log, deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  let mtTokenAddress;

  const mtToken = await deploy("MockToken", {
    from: deployer,
    args: [],
    waitConfirmations: 1,
  });

  mtTokenAddress = mtToken.address;
  log(`MT token deployed at ${mtTokenAddress}`);
};

module.exports.tags = ["all-eth","custom", "mt", "mock", "tokens", "all-custom-test"];
