pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    uint256 MINIMUM_AIRLINE_FUND_AMOUNT = 10 ether;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;

    uint8 private constant STATUS_CODE_UNKNOWN = 0;

    uint256 constant MULTI_PARTY_AIRLINE_THERESHOLD = 4;
    mapping(address => Airline) private registeredAirlines;
    mapping(address => uint256) private authorizedContracts;
    mapping(bytes32 => Flight) private flights;
    mapping(bytes32 => Insurance[]) private boughtInsurances;
    mapping(address => PassengerAccount) private passengerAccount;
    mapping(bytes32 => Insurance) private passengerInsurance;

    struct Airline {
        bool isRegistered;
        bool approved;
        string name;
        uint256 funds;
    }

    struct Flight {
        string flightNumber;
        bool isRegistered;
        uint8 statusCode;
        uint256 updatedTimestamp;
        address airline;
    }

    struct Insurance {
        address passengerAddress;
        uint256 insuranceAmount;
    }
    struct PassengerAccount {
        uint256 balance;
    }

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/
    event PassengerCreditInfo(address passenger, uint256 amount);
    event TestEvent(
        address passenger,
        bytes32 flightkey,
        uint256 insuranceAmount
    );

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address firstAirline, string firstAirlineName) public {
        contractOwner = msg.sender;
        _registerAirline(firstAirline, firstAirlineName);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    modifier onlyBuyOnceOffPurchase(bytes32 flightKey) {
        Insurance[] storage insurances = boughtInsurances[flightKey];
        for (uint256 i = 0; i < insurances.length; i++) {
            require(
                insurances[i].passengerAddress == msg.sender,
                "Passenger already bought insurance for this flight"
            );
        }
        _;
    }
    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
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
     * @dev Modifier that requires that only the authorized accounts to be the function caller
     */
    modifier requireMinimunFunding() {
        require(
            msg.value >= MINIMUM_AIRLINE_FUND_AMOUNT,
            "Mininum funding of 10 ether or more is required"
        );
        _;
    }
    /**
     * @dev Modifier that requires that only the authorized accounts to be the function caller
     */
    modifier requireRegisteredAirline(address airline) {
        require(
            registeredAirlines[airline].isRegistered == true,
            "Airline is not registered"
        );
        _;
    }

    /**
     * @dev Modifier that requires that only the authorized accounts to be the function caller
     */
    modifier isCallerAuthorized() {
        require(
            authorizedContracts[msg.sender] == 1,
            "Caller is not authorized here (* _ *)"
        );
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() external view returns (bool) {
        return operational;
    }

    function authorizeCaller(address contractAddress)
        public
        requireContractOwner
    {
        authorizedContracts[contractAddress] = 1;
    }

    function deauthorizeCaller(address contractAddress)
        public
        requireContractOwner
    {
        delete authorizedContracts[contractAddress];
    }

    function balance(address airline)
        external
        requireIsOperational
        requireRegisteredAirline(airline)
        returns (uint256)
    {
        return registeredAirlines[airline].funds;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) public requireContractOwner {
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address airline, string name)
        external
        requireIsOperational
        isCallerAuthorized
    {
        _registerAirline(airline, name);
    }

    function isAirline(address airline)
        external
        requireIsOperational
        returns (bool isAirlineRegistered)
    {
        return registeredAirlines[airline].isRegistered;
    }

    function _registerAirline(address airline, string memory name)
        internal
        requireIsOperational
    {
        registeredAirlines[airline] = Airline({
            isRegistered: true,
            approved: false,
            name: name,
            funds: 0 ether
        });
    }

    function registerFlight(
        string flightNumber,
        uint256 timestamp,
        address airline,
        bytes32 key
    ) external requireIsOperational isCallerAuthorized {
        flights[key] = Flight({
            flightNumber: flightNumber,
            isRegistered: true,
            statusCode: STATUS_CODE_UNKNOWN,
            updatedTimestamp: timestamp,
            airline: airline
        });
    }

    function isFlightRegistered(bytes32 flightKey)
        external
        view
        requireIsOperational
        returns (bool)
    {
        return flights[flightKey].isRegistered;
    }

    function getFlightInfo(bytes32 key)
        external
        view
        requireIsOperational
        isCallerAuthorized
        returns (
            string memory flightNumber,
            uint256 updatedTimestamp,
            address airline,
            bool isRegistered,
            uint8 statusCode
        )
    {
        return (
            flights[key].flightNumber,
            flights[key].updatedTimestamp,
            flights[key].airline,
            flights[key].isRegistered,
            flights[key].statusCode
        );
    }

    function processFlightStatus(bytes32 flightKey, uint8 statusCode)
        external
        requireIsOperational
        isCallerAuthorized
        returns (bool)
    {
        flights[flightKey].statusCode = statusCode;

        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            creditInsurees(flightKey);
            return true;
        }
        return false;
    }

    /**
     * @dev Buy insurance for a flight
     *
     */
    function buy(
        address passenger,
        bytes32 flightkey,
        uint256 insuranceAmount
    )
        external
        requireIsOperational
        isCallerAuthorized
        onlyBuyOnceOffPurchase(flightkey)
    {
        // emit TestEvent(passenger, flightkey, insuranceAmount);

        // boughtInsurances[flightkey].push(
        //     Insurance({
        //         passengerAddress: passenger,
        //         flightInsuranceAmount: insuranceAmount
        //     })
        // );

        Insurance[] storage insus = boughtInsurances[flightkey];
        for (uint256 i = 0; i < insus.length; i++) {
            if (insus[i].passengerAddress == passenger) {
                revert("Passenger already bought insurance for this flight");
            }
        }

        insus.push(Insurance(passenger, insuranceAmount));
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(bytes32 flightKey)
        internal
        view
        requireIsOperational
        isCallerAuthorized
    {
        Insurance[] storage insurances = boughtInsurances[flightKey];
        for (uint256 i = 0; i < insurances.length; i++) {
            address passengerAddress = insurances[i].passengerAddress;
            uint256 insuranceAmount = insurances[i].flightInsuranceAmount;

            // calculate passenger withdrawl amount
            uint256 insuranceAmountBenefit = insuranceAmount.mul(3).div(2);
            emit PassengerCreditInfo(passengerAddress, insuranceAmount);

            // Credit passenger with insurance payout
            passengerAccount[passengerAddress] = passengerAccount[
                passengerAddress
            ].add(insuranceAmountBenefit);
        }
    }

    function getPassengerBalance(address passenger)
        external
        view
        requireIsOperational
        isCallerAuthorized
        returns (uint256)
    {
        return passengerAccount[passenger];
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address passengerAddress)
        external
        payable
        requireIsOperational
        isCallerAuthorized
    {
        //checks
        uint256 amount = passengerAccount[passengerAddress];
        require(amount > 0, "Insufficient funds");

        passengerAccount[passengerAddress] = 0;
        passengerAddress.transfer(amount);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fund(address airline)
        public
        payable
        requireRegisteredAirline(airline)
    {
        uint256 airlineFunds = registeredAirlines[airline].funds;
        registeredAirlines[airline].funds = airlineFunds.add(msg.value);
        address(this).transfer(msg.value);
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        // fund(this);
    }
}
