const hre = require("hardhat");

// Monad mainnet addresses, verified on-chain via rpc.monad.xyz.
const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A";

const VAULTS = [
  ["Magma gMON", "0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081"],
  ["Curvance Bluechip cWMON", "0xE01d426B589c7834a5F6B20D7e992A705d3c22ED"],
  ["Curvance Bluechip cAUSD", "0x6E182EB501800C555bd5E662E6D350D627F504D8"],
  ["Curvance cUSDC", "0x8EE9FC28B8Da872c38A496e9dDB9700bb7261774"],
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer: ${deployer.address} (${hre.ethers.formatEther(balance)} MON, network: ${hre.network.name})`);

  const router = await hre.ethers.deployContract("YieldZapRouter", [WMON]);
  await router.waitForDeployment();
  const address = await router.getAddress();
  console.log(`YieldZapRouter: ${address}`);

  for (const [label, vault] of VAULTS) {
    await (await router.setVault(vault, true)).wait();
    console.log(`Whitelisted: ${label} (${vault})`);
  }

  console.log("\nSet in .env.local:");
  console.log(`NEXT_PUBLIC_ROUTER_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
