pragma solidity 0.6.2;


contract ProofPointRegistryStorage1 {


    mapping(address=>mapping(bytes32=>bool)) claimsByIssuer;
    mapping(address=>mapping(bytes32=>bool)) comittmentsByIssuer;
    address admin;
    address owner;

    modifier onlyAdmin() {
        if (msg.sender != admin) revert("Not authorized");
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert("Not authorized");
        _;
    }

    constructor() public {
        admin = msg.sender;
        owner = msg.sender;
    }

    function getAdmin() public view returns(address) {
        return admin;
    }

    function getOwner() public view returns(address) {
        return owner;
    }

    function setAdmin(address newAdmin) public onlyAdmin {
        admin = newAdmin;
    }

    function setOwner(address newOwner) public onlyAdmin {
        owner = newOwner;
    }

    function set(address _issuer, bytes32 _claim, bool _isValid) public onlyOwner {
        claimsByIssuer[_issuer][_claim] = _isValid;
    }

    function commit(address _issuer, bytes32 _claim) public onlyOwner {
        comittmentsByIssuer[_issuer][_claim] = true;
    }

    function get(address _issuer, bytes32 _claim) public view returns(bool) {
        
        return comittmentsByIssuer[_issuer][_claim] || claimsByIssuer[_issuer][_claim];
    }
}
