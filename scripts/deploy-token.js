const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying MockERC20 USDC with ${deployer.address}...`);

  const usdc = await hre.ethers.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  await usdc.waitForDeployment();
  const address = await usdc.getAddress();

  console.log(`✓ USDC deployed to: ${address}`);
  console.log(`\nSet this in .env.local:`);
  console.log(`NEXT_PUBLIC_INVEST_ASSET_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
