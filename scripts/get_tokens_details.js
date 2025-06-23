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
    "0x10DBdB7b3ef6721941BdF0ce4e2FBC7927B9b910", // Centrifuge
    "0xd63ea4c4999A84891C08a3C2Da13693eEFc85A7C", // Synthetix Network
    "0x7021f90C3040fCe7Bb6F5D1BC807Cf7CfC602D34", // Maple
    "0xd48C2182965De763eCB36c456FB0d6Ef0613E31a", // Maple Finance
    "0xD3B3187b3c1E66Ad90538186216B22C02932817F", // Goldfinch
    "0x84b66e00Ef39D0800764886241a3F4F890236a40", // Ethena
    "0x6e692a4067B1D5fAD8140Cf4DA833B1228311866", // OPUL
    "0xBC876cBf9CF48fC9d84675040064Aa6dE012b4fa", // BOSON
    "0xCD37fF9C528E3C4940E07C57d09ebBA8E24e3dBe", // PROPC
    "0xf8211401a660AF1ef38d7eD48007fBBfAFA2cFB5", //RDX
    "0x7077CE0BDEa8F7cd722a2825cd9E5bEAddCD3a21", //CHR
    "0x8bd982dac915070ed221ac5d7f5eac333db90918", // PalmAi
    "0x311E3ea591fe1110e99FefC4af73719fe2356aa1", // Defender Bot
    "0xB6Eda7C0c00e4020c0703aBbCB62AaAABcE9B020", // infraX
    "0xF5FbC1BBFACBAe346DBD86575D07ce6E82Ea4C0f", //CNCT
    "0x4439E91D02787b1156577bc9893568fE1836abb6", //Deployyyyer
    "0x2EAe726CAb9397Ed05972C16EEe6135C0a8505f9", //COSMIC
    "0xD4675DE1581b89D8f44EB0FA26f4d4969AaCf268", //ARC
    "0x5b3ebc9655a5d747B34eDc5B33c0Ad80C996212f", //NFINITY AI
    "0x0659FBA1F75A078b61d88bfaB8dB3EB42515b38E", //Neurahub
    "0x890C702FDD41DAB53C633D7da1Fc2e184b6b90d9", //InnoviaTrust
    "0x203966b203B366fbb831CC544c268C80AAE91c26", //Pudgy Penguins
    "0x99Ccfee084B06a81B2900E1c48B6EF606c72cBb5", //Vertical AI
    "0x474554F00FA5B1eeF48A452e4E377Fb0651CC10C", //Hyperliquid
    "0xd5D50c1C0a6F081760c65D51493ee589da7C34E2", //Celestia
    "0x8875644e4c0857d59393928dBA605f292cF13Dfb", //Avail
    "0x103731888a0B43e6b93c1d272E7D09DB116C498B", //ANYONE
    "0x13D67E805a3D5C97AB18235ED589527A5d352A16", //Spectre
    "0xA5a979A950f585957FBCd0680de4458ecdC66d99", //Xerberus

    "0xb88f3DF5204f44d7BCcf345195F6Ea6160926eA0", //Index
    "0x9D0d527AE59A16811aa668A411F4A22A29DFDA2b", //TypeAI
    "0x84594F959C5Fc1E5C3F77732Bd9C30A09A165150", //Chainpal
    "0x6BabdA0CaE6437a3595b3E4849e81D1a05f86512", //EVA
    "0xAc3b49EF26b778a81fEe66e4d34f40DcA0B1cb59", //CRX
    "0xE8f2313245FAD0e15F1cD3f7dF794A80cFd09f5F", //SUDO
    "0x6b391c4d3C9d11e67131cfc7634Fe311Cc40d88b", //PROOF
    "0x0176B0B9074ddD20ac471e46a2f46cb24C9A7992", //NXCP
    "0x808e851b833d02B0Ec84Eb5a9D1E1596F14DF132", //ORBIT
    "0xB676e320f8F33725EfAF25336f0fb7dAcc42c1f9", //OMIRA
    "0x0F0Ebf1DFb896d6ca93BE58018a38AdD4e32CaA7", //Aventa
  ];

  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const signer = new ethers.Wallet(priKey, provider);

  const routerAddress = "0x73f19dECFd263f09139c5A4DEe9B5aBc535828DF";
  const routerContract = new ethers.Contract(routerAddress, routerABI, signer);

  for (let i = 0; i < tokenAddress.length; i++) {
    const token = tokenAddress[i];
    const tokenDetails = await routerContract.getTokenDetails(token);
    console.log(`Token : ${token} :`, tokenDetails);

    let tokenContract = new ethers.Contract(token, tokenABI, signer);

    const approveAmount = await tokenContract.allowance(
      "0xA5de4D331f7A61dd0179b4f1493EC1e2D713AE29",
      routerAddress
    );

    if (approveAmount < 10)
      console.log(`Token Allowance: ${token} :`, approveAmount);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
