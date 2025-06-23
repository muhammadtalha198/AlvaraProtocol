const { ethers, network } = require("hardhat");

// Function to get the selector for an error
function getErrorSelector(errorSignature) {
  return ethers.id(errorSignature).substring(0, 10);
}

async function main() {
  let errors = [
    "InvalidToken()",
    "InsufficientLiquidity()",
    "DuplicateToken()",
    "ZeroBalance()",
    "InvalidRecipient()",
    "OnlyOwnerAllowed()",
    "InvalidLength()",
    "InvalidWeight()",
    "InvalidOwner()",
    "InvalidBuffer()",
    "ContractNotWhitelisted()",
    "ZeroContributionAmount()",
    "InvalidEmergencyParams()",
    "NoAlvaTokenIncluded()",
    "InsufficientAlvaPercentage()",
    "ZeroTokenWeight()",
    "InvalidInterfaceId()",
    "InvalidWithdrawalAmount()",
    "EmptyStringParameter()",
    "InvalidLimitValue()",
    'ERC20InsufficientBalance(address, uint256, uint256)',
    "SupervisedTranferFrom()"
  ];

  let errorInJson = {};
  for (i = 0; i < errors.length; i++) {
    console.log(
      `${errors[i]} : `,
      getErrorSelector(errors[i])
    );
    errorInJson[errors[i]] = getErrorSelector(errors[i])
  }

  console.log("errors in json : ", JSON.stringify(errorInJson))
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
