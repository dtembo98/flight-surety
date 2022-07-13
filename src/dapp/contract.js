import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";

import Config from "./config.json";
import Web3 from "web3";
import DOM from "./dom";

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));

    this.flightSuretyAppAddress = config.appAddress;

    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appAddress
    );

    this.flightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataAddress
    );

    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
    this.firstAirline = null;
    this.fundedAirlines = [];
    this.flights = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((error, accts) => {
      this.owner = accts[0];
      this.firstAirline = accts[1];

      //authorize contract to call functions on behalf of airline
      this.authorizeCaller(this.flightSuretyAppAddress, (error, result) => {
        if (error) {
          console.log("error", error);
          return;
        }
        console.log(
          "authorized contract to call functions on behalf of airline",
          result
        );
      });

      // fund first airline
      let firstAirlineName = "Airline 1";
      let firstAirlinefundAmount = "10";

      this.fundAirline(
        firstAirlineName,
        this.firstAirline,
        firstAirlinefundAmount,
        (error, result) => {
          if (error) {
            console.log("Error funding", error);
            return;
          }

          console.log(this.firstAirline, "funded");
        }
      );

      let counter = 1;

      while (this.airlines.length < 4) {
        counter++;

        const airlineName = `Airline ${counter}`;
        const airline = accts[counter];
        this.airlines.push({
          label: airlineName,
          value: airline,
        });

        console.log("init ", airlineName);
        this.registerAirline(airline, airlineName, (error, result) => {
          if (error) {
            console.log("Error occred", error);
            return;
          }
          console.log("airline registered ", result);
          this.addAirlineInfoToUI(airlineName, airline);
        });
      }

      while (this.passengers.length < 4) {
        counter++;
        this.passengers.push(accts[counter]);
      }

      callback();
    });
  }

  isOperational(callback) {
    let self = this;
    self.flightSuretyApp.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  async authorizeCaller(contractAddress, callback) {
    let self = this;
    await self.flightSuretyData.methods
      .authorizeCaller(contractAddress)
      .send({ from: self.owner, gas: 650000 }, (error, result) => {
        callback(error, result);
      });
  }

  addAirlineInfoToUI(airlineName, airlineAddress) {
    let displayDiv = DOM.elid("registered-airlines");
    let p = DOM.p();
    p = DOM.p(airlineName + "  Address: " + airlineAddress);
    displayDiv.append(p);
  }
  addFundedAirlineInfoToUI(airlineName, airlineAddress) {
    let displayDiv = DOM.elid("funded-airlines");
    let p = DOM.p();
    p = DOM.p(airlineName + "  Address: " + airlineAddress);
    displayDiv.append(p);
  }

  addFlightInfoToUI(airlineAddress, flightNumber, timestamp) {
    let displayDiv = DOM.elid("flights");
    let div = DOM.div();

    div.appendChild(DOM.h5("Flight: " + flightNumber));
    div.appendChild(DOM.p(" " + airlineAddress));
    div.appendChild(DOM.p("Timestamp: " + timestamp));

    displayDiv.append(div);
  }

  addPassengerBalanceInfoToUI(passengerAddress, passengerBalance) {
    let displayDiv = DOM.elid("passenger-balance-container");
    let p = DOM.p();
    p = DOM.p(passengerAddress + "  balance " + passengerBalance + " ETH");
    displayDiv.append(p);
  }
  addPassengerWithDrawStatusInfoToUI(status, amount) {
    if (!status) {
      let displayDiv = DOM.elid("passenger-withdraw-status");
      let p = DOM.p();
      p = DOM.p("Withdrawal failed");
      displayDiv.append(p);
      return;
    }

    let displayDiv = DOM.elid("passenger-withdraw-status");
    let p = DOM.p();
    p = DOM.p(
      " You've successfully withdrawn your flight insurance of  " +
        amount +
        " ETH"
    );
    displayDiv.append(p);
  }

  async registerAirline(airline, airliName, callback) {
    let self = this;
    console.log("airline", airline, "airlineName", airliName);
    await self.flightSuretyApp.methods
      .registerAirline(airline, airliName)
      .send({ from: this.firstAirline, gas: 650000 }, (error, result) => {
        callback(error, result);
      });
  }

  async registerFlight(flight, airline, callback) {
    let payload = {
      airline: airline,
      flight: flight,
      timestamp: Math.floor(Date.now() / 1000),
    };
    let self = this;
    await self.flightSuretyApp.methods
      .registerFlight(payload.flight, payload.timestamp)
      .send({ from: payload.airline, gas: 650000 }, (error, result) => {
        if (!error) {
          this.addFlightInfoToUI(
            payload.airline,
            payload.flight,
            payload.timestamp
          );

          this.flights.push({
            airline: payload.airline,
            flight: payload.flight,
            timestamp: payload.timestamp,
          });
        }

        callback(error, result);
      });
  }

  async fundAirline(airlineName, airline, amount, callback) {
    let self = this;
    let fundAmount = this.web3.utils.toWei(amount, "ether");

    await self.flightSuretyData.methods
      .fund(airline)
      .send({ from: airline, value: fundAmount }, (error, result) => {
        if (!error) {
          this.addFundedAirlineInfoToUI(airlineName, airline);
        }
        callback(error, result);
      });
  }

  async buyInsurance(flight, amount, callback) {
    const registeredFlight = this.flights.find((f) => f.flight === flight);
    if (!registeredFlight) {
      callback("Flight not registered", null);
      return;
    }

    let self = this;

    let insuranceAmount = this.web3.utils.toWei(amount, "ether");

    let payload = {
      airline: registeredFlight.airline,
      flight: registeredFlight.flight,
      timestamp: registeredFlight.timestamp,
      passenger: this.passengers[0],
    };

    try {
      await self.flightSuretyApp.methods
        .buyInsurance(
          payload.airline,
          payload.passenger,
          payload.flight,
          payload.timestamp
        )
        .send(
          { from: payload.passenger, value: insuranceAmount, gas: 4712388 },
          (error, result) => {
            if (!error) {
              console.log("insurance bought", result);
            }
            callback(error, result);
          }
        );
    } catch (error) {
      console.log("Buy Insurance", error);
    }
  }

  async getPassengerBalance(callback) {
    let self = this;
    let passenger = this.passengers[0];

    await self.flightSuretyApp.methods
      .getPassengerBalance(passenger)
      .call({ from: passenger }, (error, balance) => {
        if (!error) {
          console.log(this.web3.utils.fromWei(`${balance}`, "ether"));
          this.addPassengerBalanceInfoToUI(
            passenger,
            this.web3.utils.fromWei(balance.toString(), "ether")
          );
        }
        callback(error, this.web3.utils.fromWei(balance.toString(), "ether"));
      });
  }
  async withDraw(callback) {
    let self = this;
    let passenger = this.passengers[0];

    const amount = await self.flightSuretyApp.methods
      .getPassengerBalance(passenger)
      .call({ from: passenger });

    await self.flightSuretyApp.methods
      .withDraw()
      .send({ from: passenger }, (error, result) => {
        if (!error) {
          console.log("withdraw successful", result);

          this.addPassengerWithDrawStatusInfoToUI(
            true,
            this.web3.utils.fromWei(amount.toString(amount), "ether")
          );
        }
        callback(error, result);
      });
  }

  fetchFlightStatus(flight, callback) {
    let self = this;

    const registeredFlight = this.flights.find((f) => f.flight === flight);
    if (!registeredFlight) {
      callback("Flight not registered", null);
      return;
    }

    let payload = {
      airline: registeredFlight.airline,
      flight: registeredFlight.flight,
      timestamp: registeredFlight.timestamp,
    };
    self.flightSuretyApp.methods
      .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
      .send({ from: self.owner }, (error, result) => {
        callback(error, payload);
      });
  }

  //   fetchAirlines(callback) {
  //     callback(null, this.airlines);
  //   }
}
