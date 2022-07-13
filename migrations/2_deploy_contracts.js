const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = function (deployer, network, accounts) {
  let firstAirline = accounts[1];
  let firstAirlineName = "Zed Airways";
  console.log("first airline ", firstAirline);

  deployer.deploy(FlightSuretyData, firstAirline, firstAirlineName).then(() => {
    return deployer
      .deploy(FlightSuretyApp, FlightSuretyData.address)
      .then(() => {
        let config = {
          localhost: {
            url: "http://localhost:9545",
            dataAddress: FlightSuretyData.address,
            appAddress: FlightSuretyApp.address,
          },
        };
        fs.writeFileSync(
          __dirname + "/../src/dapp/config.json",
          JSON.stringify(config, null, "\t"),
          "utf-8"
        );
        fs.writeFileSync(
          __dirname + "/../src/server/config.json",
          JSON.stringify(config, null, "\t"),
          "utf-8"
        );
      });
  });
};
