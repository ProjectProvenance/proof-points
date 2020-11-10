pragma solidity 0.6.2;

abstract contract Versioned {
    int version;
    address previous;

    constructor(int _version, address _previous) public {
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
