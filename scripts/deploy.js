const hre = require("hardhat");

const AAVE = 0;
const MORPHO = 1;

// Full demo deployment for Monad testnet: WMON wrapper, mock pools (there
// are no live Aave/Morpho deployments on Monad testnet), the aggregator,
// protocol registration and asset whitelisting — everything the frontend
// needs for a working one-click invest flow with native MON.
async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address} (network: ${hre.network.name})`);

  // 1. WMON — reuse an existing wrapper if provided, otherwise deploy ours.
  let wmonAddress = process.env.WMON_ADDRESS;
  if (!wmonAddress) {
    const wmon = await hre.ethers.deployContract("WMON");
    await wmon.waitForDeployment();
    wmonAddress = await wmon.getAddress();
    console.log(`WMON deployed:            ${wmonAddress}`);
  } else {
    console.log(`WMON (from env):          ${wmonAddress}`);
  }

  // 2. Mock pools, unless real pool addresses are supplied via env.
  let aavePoolAddress = process.env.AAVE_POOL_ADDRESS;
  if (!aavePoolAddress) {
    const aavePool = await hre.ethers.deployContract("MockAavePool");
    await aavePool.waitForDeployment();
    aavePoolAddress = await aavePool.getAddress();
    console.log(`MockAavePool deployed:    ${aavePoolAddress}`);
  }

  let morphoVaultAddress = process.env.MORPHO_VAULT_ADDRESS;
  if (!morphoVaultAddress) {
    const morphoVault = await hre.ethers.deployContract("MockMorphoVault", [wmonAddress]);
    await morphoVault.waitForDeployment();
    morphoVaultAddress = await morphoVault.getAddress();
    console.log(`MockMorphoVault deployed: ${morphoVaultAddress}`);
  }

  // 3. Aggregator wired to WMON.
  const aggregator = await hre.ethers.deployContract("ProtocolAggregator", [wmonAddress]);
  await aggregator.waitForDeployment();
  const aggregatorAddress = await aggregator.getAddress();
  console.log(`ProtocolAggregator:       ${aggregatorAddress}`);

  // 4. Registration + whitelist.
  await (await aggregator.registerProtocol(AAVE, aavePoolAddress, "Aave V3")).wait();
  await (await aggregator.registerProtocol(MORPHO, morphoVaultAddress, "Morpho Blue")).wait();
  await (await aggregator.addSupportedAsset(wmonAddress)).wait();
  console.log("Protocols registered, WMON whitelisted.");

  if (process.env.INVEST_ASSET_ADDRESS) {
    await (await aggregator.addSupportedAsset(process.env.INVEST_ASSET_ADDRESS)).wait();
    console.log(`Extra asset whitelisted:  ${process.env.INVEST_ASSET_ADDRESS}`);
  }

  console.log("\nSet in .env.local:");
  console.log(`NEXT_PUBLIC_AGGREGATOR_ADDRESS=${aggregatorAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
