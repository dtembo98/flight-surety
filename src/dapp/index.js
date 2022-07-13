import DOM from "./dom";
import Contract from "./contract";
import "./flightsurety.css";

(async () => {
  let result = null;

  let contract = new Contract("localhost", () => {
    // Read transaction
    contract.isOperational((error, result) => {
      console.log(error, result);
      display("Operational Status", "Check if contract is operational", [
        { label: "Operational Status", error: error, value: result },
      ]);
    });

    // User-submitted transaction
    DOM.elid("submit-oracle").addEventListener("click", () => {
      let flight = DOM.elid("flight-number").value;
      // Write transaction
      contract.fetchFlightStatus(flight, (error, result) => {
        display("Oracles", "Trigger oracles", [
          {
            label: "Fetch Flight Status",
            error: error,
            value: result.flight + " " + result.timestamp,
          },
        ]);
      });
    });

    // User-submitted transaction
    DOM.elid("fund-airline").addEventListener("click", () => {
      let airlineName = DOM.elid("airline-name").value;
      let airlineAddress = DOM.elid("airline-address").value;
      let airlineFunds = DOM.elid("airline-funds").value;

      // Write transaction
      contract.fundAirline(
        airlineName,
        airlineAddress,
        airlineFunds,
        (error, result) => {}
      );
    });

    // User-submitted transaction
    DOM.elid("register-flight").addEventListener("click", () => {
      let flight = DOM.elid("airline-flight-number").value;
      let airline = DOM.elid("flight-airline-address").value;
      // Write transaction
      contract.registerFlight(flight, airline, (error, result) => {});
    });

    // User-submitted transaction
    DOM.elid("buy-flight-insurance").addEventListener("click", () => {
      let flight = DOM.elid("passenger-flight-number").value;
      let flightAmount = DOM.elid("passenger-flight-amount").value;

      // Write transaction
      contract.buyInsurance(flight, flightAmount, (error, result) => {});
    });

    // User-submitted transaction
    DOM.elid("passenger-balance").addEventListener("click", () => {
      // Write transaction
      contract.getPassengerBalance((error, result) => {});
    });
    // User-submitted transaction
    DOM.elid("passenger-balance-withdraw").addEventListener("click", () => {
      // Write transaction
      contract.withDraw((error, result) => {});
    });
  });
})();

function display(title, description, results) {
  let displayDiv = DOM.elid("display-wrapper");
  let section = DOM.section();
  section.appendChild(DOM.h2(title));
  section.appendChild(DOM.h5(description));
  results.map((result) => {
    let row = section.appendChild(DOM.div({ className: "row" }));
    row.appendChild(DOM.div({ className: "col-sm-4 field" }, result.label));
    row.appendChild(
      DOM.div(
        { className: "col-sm-8 field-value" },
        result.error ? String(result.error) : String(result.value)
      )
    );
    section.appendChild(row);
  });
  displayDiv.append(section);
}
