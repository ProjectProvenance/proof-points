/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({path: '.env'});

module.exports = {
  defaultNetwork: "alfajores",
  networks: {
    localhost: {
        url: "http://127.0.0.1:7545"
    },
    alfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/52752'/0'/0",
      },
      //chainId: 44787
    },
    celo: {
      url: "https://forno.celo.org",
      accounts: {
        mnemonic: process.env.MNEMONIC,
        path: "m/44'/52752'/0'/0"
      },
      chainId: 42220
    },     
  },
  solidity: "0.6.2",
};
