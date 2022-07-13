pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    uint256 constant MULTI_PARTY_AIRLINE_THESHOLD = 4;
    uint256 MINIMUM_AIRLINE_FUND_AMOUNT = 10 ether;
    uint256 MINIMUM_PURCHASING_INSURANCE_AMOUNT = 1 ether;

    address private contractOwner; // Account used to deploy contract
    address[] multpartyAirlineCalls = new address[](0);
    address[] private registeredAirlinesQueue;

    FlightSuretyData flightSuretyData;

    struct Flight {
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    mapping(bytes32 => Flight) private flights;

    // Event fired when Airline is registered
    event AirlineRegistered(string airlineName);

    // Event fired when flight is registered
    event FlightRegistered(bytes32 flightKey);
    event TestEvent(uint256 amount);

    // Event fired when insurance is bought
    event FlightInsuranceBought(
        bytes32 flightKey,
        address passenger,
        uint256 insuranceAmount
    );

    event PassengerPaid(address passenger);
    event PassengerAccountCredited(
        bytes32 generatedFlightKey,
        uint8 statusCode,
        address airline
    );

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        // Modify to call data contract's status
        require(
            flightSuretyData.isOperational(),
            "Contract is currently not operational"
        );
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireFunding(address airline) {
        require(
            flightSuretyData.balance(msg.sender) >= MINIMUM_AIRLINE_FUND_AMOUNT,
            "Airline must have funding in order to participate"
        );
        _;
    }

    modifier requireMinimmumInsuraceAmount() {
        require(
            msg.value <= MINIMUM_PURCHASING_INSURANCE_AMOUNT && msg.value > 0,
            "You can only pay upto 1 ether to buy insurance"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor
     *
     */
    constructor(address flightSuretyDataAddress) public {
        contractOwner = msg.sender;
        flightSuretyData = FlightSuretyData(flightSuretyDataAddress);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() public view returns (bool) {
        return flightSuretyData.isOperational(); // Modify to call data contract's status
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */
    function registerAirline(address airline, string name)
        external
        requireFunding(msg.sender)
        requireIsOperational
        returns (bool success, uint256 votes)
    {
        votes = 0;
        // Register a new airline untill there atleast four airlines registered
        if (registeredAirlinesQueue.length >= MULTI_PARTY_AIRLINE_THESHOLD) {
            //Prevent Duplicates votes for Airline
            bool isDuplicate = false;
            for (uint256 c = 0; c < multpartyAirlineCalls.length; c++) {
                if (multpartyAirlineCalls[c] == msg.sender) {
                    isDuplicate = true;
                    break;
                }
            }

            require(!isDuplicate, "Caller has already called this function.");
            multpartyAirlineCalls.push(msg.sender);

            if (
                multpartyAirlineCalls.length >=
                registeredAirlinesQueue.length.div(2)
            ) {
                flightSuretyData.registerAirline(msg.sender, name);
                registeredAirlinesQueue.push(airline);
                multpartyAirlineCalls = new address[](0);
                votes = multpartyAirlineCalls.length;
                emit AirlineRegistered(name);
                success = true;
            }
        } else {
            // Only existing airlines can register a new airline untill thereshold
            require(
                flightSuretyData.isAirline(msg.sender),
                "only registered airlines can add other airlines"
            );

            flightSuretyData.registerAirline(airline, name);
            registeredAirlinesQueue.push(airline);
            emit AirlineRegistered(name);
            success = true;
        }
    }

    /**
     * @dev Register a future flight for insuring.
     *
     */
    function registerFlight(string flightNumber, uint256 timestamp)
        external
        requireIsOperational
    {
        require(
            flightSuretyData.isAirline(msg.sender),
            "only registered airline can add flight"
        );
        address airline = msg.sender;

        bytes32 key = getFlightKey(airline, flightNumber, timestamp);
        flightSuretyData.registerFlight(flightNumber, timestamp, airline, key);

        emit FlightRegistered(key);
    }

    function _isFlightRegistered(
        address airline,
        string flight,
        uint256 timestamp
    ) internal view requireIsOperational returns (bool) {
        bytes32 generatedFlightKey = getFlightKey(airline, flight, timestamp);
        return flightSuretyData.isFlightRegistered(generatedFlightKey);
    }

    /**
     * Buy insurance for a flight
     *
     */
    function buyInsurance(
        address airlineAddress,
        address passengerAddress,
        string flight,
        uint256 timestamp
    ) external payable requireIsOperational requireMinimmumInsuraceAmount {
        bytes32 generatedFlightKey = getFlightKey(
            airlineAddress,
            flight,
            timestamp
        );
        require(
            _isFlightRegistered(airlineAddress, flight, timestamp),
            "Flight is not registered."
        );
        // uint256 insuranceAmount = msg.value;

        // address(flightSuretyData).transfer(msg.value);

        flightSuretyData.buy(passengerAddress, generatedFlightKey, msg.value);
        emit FlightInsuranceBought(
            generatedFlightKey,
            passengerAddress,
            msg.value
        );
    }

    function withDraw() payable requireIsOperational {
        address passengerAddress = msg.sender;
        flightSuretyData.pay(passengerAddress);
        emit PassengerPaid(passengerAddress);
    }

    function getPassengerBalance(address passengerAddress)
        external
        view
        requireIsOperational
        returns (uint256)
    {
        return flightSuretyData.getPassengerBalance(passengerAddress);
    }

    /**
     *  fetch a flight information
     *
     */

    function getFlightInfo(bytes32 key)
        public
        view
        requireIsOperational
        returns (
            string memory flightNumber,
            uint256 timestamp,
            address airline,
            bool isRegistered,
            uint8 statusCode
        )
    {
        return flightSuretyData.getFlightInfo(key);
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    function processFlightStatus(
        address airline,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
    ) internal view {
        bytes32 generatedFlightKey = getFlightKey(airline, flight, timestamp);
        bool isPassengerCredited = flightSuretyData.processFlightStatus(
            generatedFlightKey,
            statusCode
        );
        if (isPassengerCredited) {
            emit PassengerAccountCredited(
                generatedFlightKey,
                statusCode,
                airline
            );
        }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        address airline,
        string flight,
        uint256 timestamp
    ) external {
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        oracleResponses[key] = ResponseInfo({
            requester: msg.sender,
            isOpen: true
        });

        emit OracleRequest(index, airline, flight, timestamp);
    }

    // region ORACLE MANAGEMENT

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 1;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    event OracleReport(
        address airline,
        string flight,
        uint256 timestamp,
        uint8 status
    );

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp
    );

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(msg.value >= REGISTRATION_FEE, "Registration fee is required");

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
    }

    function getMyIndexes() external view returns (uint8[3]) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        address airline,
        string flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(
            abi.encodePacked(index, airline, flight, timestamp)
        );
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(airline, flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(airline, flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(airline, flight, timestamp, statusCode);
        }
    }

    function getFlightKey(
        address airline,
        string flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3]) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    // endregion
}

contract FlightSuretyData {
    function registerAirline(address airline, string name) external;

    function isAirline(address airline) external returns (bool);

    function balance(address airline) external returns (uint256);

    function registerFlight(
        string flightNumber,
        uint256 timestamp,
        address airline,
        bytes32 key
    ) external;

    function isFlightRegistered(bytes32 flightKey) external view returns (bool);

    function getFlightInfo(bytes32 key)
        external
        view
        returns (
            string memory flightNumber,
            uint256 timestamp,
            address airline,
            bool isRegistered,
            uint8 statusCode
        );

    function buy(
        address passenger,
        bytes32 flightkey,
        uint256 insuranceAmount
    ) external payable;

    function pay(address passengerAddress) external payable;

    function isOperational() external view returns (bool);

    function getPassengerBalance(address passengerAddress)
        external
        view
        returns (uint256);

    function processFlightStatus(bytes32 flightKey, uint8 statusCode)
        external
        returns (bool);
}
