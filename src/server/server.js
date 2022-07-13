import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

const STATUS_CODE_UNKNOWN = 20;
const STATUS_CODE_ON_TIME = 20;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 20;
const STATUS_CODE_LATE_TECHNICAL = 20;
const STATUS_CODE_LATE_OTHER = 20;

const fligthStatusCodes = [
  STATUS_CODE_UNKNOWN,
  STATUS_CODE_ON_TIME,
  STATUS_CODE_LATE_AIRLINE,
  STATUS_CODE_LATE_WEATHER,
  STATUS_CODE_LATE_TECHNICAL,
  STATUS_CODE_LATE_OTHER,
];

let config = Config["localhost"];
let web3 = new Web3(
  new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
);
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(
  FlightSuretyApp.abi,
  config.appAddress
);

let flightSuretyData = new web3.eth.Contract(
  FlightSuretyData.abi,
  config.dataAddress
);

let oracles = [];

const registerOracles = async (callback) => {
  try {
    console.log("start oracle registration");
    const REGISTRATION_FEE = web3.utils.toWei("1", "ether");
    let accounts = await web3.eth.getAccounts();
    let numberOfOracles = 20;
    if (accounts.length < numberOfOracles) {
      numberOfOracles = accounts.length;
    }

    for (let i = 0; i < numberOfOracles; i++) {
      oracles.push(accounts[i]);
      await flightSuretyApp.methods.registerOracle().send({
        from: accounts[i],
        value: REGISTRATION_FEE,
        gas: 4712388,
      });
    }
    console.log("registred oracles :::", oracles);
    callback();
  } catch (error) {
    console.log("Error occured::", error);
  }
};

const generateRandomStatusCode = () => {
  const randomInt = Math.floor(Math.random() * (fligthStatusCodes.length - 1));
  return fligthStatusCodes[randomInt];
};

const handleOracleEvents = () => {
  flightSuretyApp.events.OracleRequest(
    {
      fromBlock: 0,
    },
    oracleRequestEventHandler
  );

  //event handlers
  function oracleRequestEventHandler(error, event) {
    if (error) console.log(error);
    console.log(event);
    const oracleRequestIndex = event.returnValues.index;

    oracles.forEach(async (oracle) => {
      const oracleIndexes = await flightSuretyApp.methods
        .getMyIndexes()
        .call({ from: oracle });

      if (oracleIndexes.includes(oracleRequestIndex)) {
        const randomStatusCode = generateRandomStatusCode();
        console.log(
          "oracle found ",
          oracle,
          " random status code is ",
          randomStatusCode
        );

        await flightSuretyApp.methods
          .submitOracleResponse(
            oracleRequestIndex,
            event.returnValues.airline,
            event.returnValues.flight,
            event.returnValues.timestamp,
            randomStatusCode
          )
          .send({
            from: oracle,
            gas: 4712388,
          });

        flightSuretyData.events.TestEvent(
          {
            fromBlock: 0,
          },
          function (error, event) {
            if (error) console.log(error);
            console.log("TestEvent", event);
          }
        );
      }
    });
  }
};

registerOracles(handleOracleEvents);

const app = express();
app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});

export default app;
