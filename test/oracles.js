var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Oracles", async (accounts) => {
  const TEST_ORACLES_COUNT = 10;
  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);

    funds = web3.utils.toWei("10", "ether");

    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
    await config.flightSuretyData.fund(config.firstAirline, {
      from: config.firstAirline,
      value: funds,
    });
  });

  it("can register oracles", async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({
        from: accounts[a],
        value: fee,
      });
      let result = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      console.log(
        `Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`
      );
    }
  });

  it("can request flight status", async () => {
    // ARRANGE
    let flight = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );

    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });

      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            config.firstAirline,
            flight,
            timestamp,
            STATUS_CODE_ON_TIME,
            { from: accounts[a] }
          );
        } catch (e) {
          // Enable this when debugging
          //console.log(e);
          console.log(
            "\nError",
            idx,
            oracleIndexes[idx].toNumber(),
            flight,
            timestamp
          );
        }
      }
    }
  });
  it("passenger can recieve flight surety Money", async () => {
    // ARRANGE
    let flight = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let passengerAddress = accounts[2];
    let insuranceAmount = web3.utils.toWei("1", "ether");

    // register flight
    await config.flightSuretyApp.registerFlight(flight, timestamp, {
      from: config.firstAirline,
    });

    // buy insurance
    await config.flightSuretyApp.buyInsurance(
      config.firstAirline,
      passengerAddress,
      flight,
      timestamp,
      {
        from: passengerAddress,
        value: insuranceAmount,
      }
    );

    // Submit a request for oracles to get status information for a flight
    const results = await config.flightSuretyApp.fetchFlightStatus(
      config.firstAirline,
      flight,
      timestamp
    );

    // ACT
    const index = results.logs[0].args["0"].toNumber();

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });

      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match

          if (index == oracleIndexes[idx].toNumber()) {
            await config.flightSuretyApp.submitOracleResponse(
              oracleIndexes[idx],
              config.firstAirline,
              flight,
              timestamp,
              STATUS_CODE_LATE_AIRLINE,
              { from: accounts[a] }
            );
          }
        } catch (e) {
          // Enable this when debugging
          console.log(e);
        }
      }
    }

    let balance = await config.flightSuretyApp.getPassengerBalance(
      passengerAddress
    );

    assert.equal(balance > 0, true, "the balance should be greater than 0");
  });

  it("Passenger can withdraw funds", async () => {
    // ARRANGE
    let passengerAddress = accounts[2];

    // ACT

    let balance = await config.flightSuretyApp.getPassengerBalance(
      passengerAddress
    );

    let accountBalance = await web3.eth.getBalance(passengerAddress);

    // Withdraw funds
    await config.flightSuretyApp.withDraw({
      from: passengerAddress,
    });

    let newBbalance = await config.flightSuretyApp.getPassengerBalance(
      passengerAddress
    );

    let newAccountBalance = await web3.eth.getBalance(passengerAddress);

    //ASSERT
    assert.equal(newBbalance, 0, "the balance should be 0");
    assert.equal(
      balance != newBbalance,
      true,
      "the balance should be different"
    );
    assert(newAccountBalance > accountBalance, true),
      "The balance should be greater than the previous balance";
  });
});
