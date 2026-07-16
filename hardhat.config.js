require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      // OpenZeppelin's ERC4626 (used by the Mock4626 test helper) needs
      // ^0.8.24 and the mcopy opcode from the Cancun EVM. Tests only.
      {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
      },
    ],
  },
  networks: {
    monadTestnet: {
      url: process.env.MONAD_RPC_TESTNET || "https://testnet-rpc.monad.xyz",
      accounts,
      chainId: 10143,
    },
    monadMainnet: {
      url: process.env.MONAD_RPC_MAINNET || "https://rpc.monad.xyz",
      accounts,
      chainId: 143,
    },
  },
};
