pragma solidity 0.5.16;

contract Versioned {
    int version;
    address previous;

    constructor(int _version, address _previous) internal {
        version = _version;
        previous = _previous;
    }

    function getVersion() public view returns (int) {
        return version;
    }

    function getPrevious() public view returns (address) {
        return previous;
    }
}
