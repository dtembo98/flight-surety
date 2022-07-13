var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");
const { expectEvent } = require("@openzeppelin/test-helpers");

contract("Flight Surety Tests", async (accounts) => {
  var config;
  let funds;

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

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Ensure that access is denied for non-Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Ensure that access is allowed for Contract Owner account
    let accessDenied = false;
    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    await config.flightSuretyData.setOperatingStatus(false);

    let reverted = false;
    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) cannot register an Airline using registerAirline() if it is not funded", async () => {
    // ARRANGE
    let airline1 = accounts[2];
    let airline2 = accounts[3];
    let airline1Name = "Emirates";
    let airline2Name = "Zed Airways";
    let errorMessage =
      "Returned error: VM Exception while processing transaction: revert Airline must have funding in order to participate -- Reason given: Airline must have funding in order to participate.";

    funds = web3.utils.toWei("1", "ether");

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(airline1, airline1Name, {
        from: config.firstAirline,
      });

      await config.flightSuretyApp.registerAirline(airline2, airline2Name, {
        from: airline1,
      });

      // ASSERT
    } catch (e) {
      assert.equal(
        e.message,
        errorMessage,
        "Airline should not be able to register another airline if it hasn't provided funding"
      );
    }
  });
  it("(airline) should be able  to register  an Airline  using registerAirline()", async () => {
    // ARRANGE
    let newAirline = accounts[2];
    let newAirlineName = "Emirates";

    // ACT
    try {
      await config.flightSuretyApp.registerAirline(newAirline, newAirlineName, {
        from: config.firstAirline,
      });

      let result = await config.flightSuretyData.isAirline.call(newAirline, {
        from: config.flightSuretyApp.address,
      });
      await config.flightSuretyData.fund(newAirline, {
        from: newAirline,
        value: funds,
      });
      let balance = await config.flightSuretyData.balance.call(newAirline);

      // ASSERT
      assert.equal(
        result,
        true,
        "Airline should able to register another airline "
      );
      assert.equal(
        balance,
        funds,
        "Airline should  be able to be to be funded"
      );
    } catch (e) {
      console.log("Error ", e);
    }
  });

  it("(airline) should be able  to register  a flight using registerFlight()", async () => {
    // ARRANGE
    let flightNumber = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);

    // ACT
    try {
      //Airline registers flight
      let result = await config.flightSuretyApp.registerFlight(
        flightNumber,
        timestamp,
        {
          from: config.firstAirline,
        }
      );

      let eventName = result.logs[0].event;

      // ASSERT
      assert.equal(
        eventName,
        "FlightRegistered",
        "Airline should able to register a flight "
      );

      // ASSERT
    } catch (e) {
      console.log("Error ", e);
    }
  });

  it("(passenger) should be able  to buy  flight insurance using buyInsurance()", async () => {
    // ARRANGE
    let flightNumber = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let passengerAddress = accounts[2];
    let insuranceAmount = web3.utils.toWei("1", "ether");

    // ACT
    try {
      await config.flightSuretyApp.registerFlight(flightNumber, timestamp, {
        from: config.firstAirline,
      });

      let result = await config.flightSuretyApp.buyInsurance(
        config.firstAirline,
        passengerAddress,
        flightNumber,
        timestamp,
        {
          from: passengerAddress,
          value: insuranceAmount,
        }
      );

      let balance = await config.flightSuretyApp.getPassengerBalance(
        passengerAddress
      );

      let eventName = result.logs[0].event;
      let eventPasseger = result.logs[0].args.passenger;
      let eventAmount = result.logs[0].args.insuranceAmount;

      // ASSERT
      assert.equal(
        eventName,
        "FlightInsuranceBought",
        "Passenger should able to buy flight insurance"
      );
      assert(
        balance,
        insuranceAmount,
        "Passenger should able to buy flight insurance"
      );
      assert.equal(
        passengerAddress,
        eventPasseger,
        "Passenger address should be same"
      );

      assert.equal(
        insuranceAmount,
        eventAmount,
        "insurance amount of the bought insurance should be same as the eventAmount"
      );

      // ASSERT
    } catch (e) {
      console.log("Error ", e);
    }
  });

  it("(passenger) should NOT be allowed to buy  flight insurance if amount is less than 0 ether or greater than 1 ether", async () => {
    // ARRANGE
    let flightNumber = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let passenger = accounts[3];
    let insuranceAmount = web3.utils.toWei("0", "ether");

    // ACT
    try {
      await config.flightSuretyApp.registerFlight(flightNumber, timestamp, {
        from: config.firstAirline,
      });

      let result = await config.flightSuretyApp.buyInsurance(
        config.firstAirline,
        passenger,
        flightNumber,
        timestamp,
        {
          from: passenger,
          value: insuranceAmount,
        }
      );

      // ASSERT
    } catch (e) {
      assert.equal(
        e.message,
        "Returned error: VM Exception while processing transaction: revert You can only pay upto 1 ether to buy insurance -- Reason given: You can only pay upto 1 ether to buy insurance.",
        "Should not be able to buy insurance"
      );
    }
  });
});
