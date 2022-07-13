var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic =
  "muffin midnight media gossip note attract lizard art foot off volcano kid";

module.exports = {
  networks: {
    development: {
      provider: function () {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:9545/", 0, 50);
      },
      network_id: "*",
      // gas: 6721975,
    },
  },
  compilers: {
    solc: {
      version: "^0.4.24",
    },
  },
};
