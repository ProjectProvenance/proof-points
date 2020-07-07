pragma solidity 0.5.16;

import "./ProofPointRegistryStorage1.sol";


contract ProofPointRegistry {


    ProofPointRegistryStorage1 eternalStorage1;

    event Issued(address indexed _issuer, bytes indexed _claim);
    event Committed(address indexed _issuer, bytes indexed _claim);
    event Revoked(address indexed _issuer, bytes indexed _claim);

    constructor(address _eternalStorage1) public {
        eternalStorage1 = ProofPointRegistryStorage1(_eternalStorage1);
    }
    
    function issue(bytes memory _claim) public {

        bytes32 claimKey = keccak256(_claim);
        eternalStorage1.set(msg.sender, claimKey, true);

        emit Issued(msg.sender, _claim);
    }

    function commit(bytes memory _claim) public {

        bytes32 claimKey = keccak256(_claim);
        eternalStorage1.commit(msg.sender, claimKey);

        emit Committed(msg.sender, _claim);
    }

    function revoke(bytes memory _claim) public {

        bytes32 claimKey = keccak256(_claim);
        eternalStorage1.set(msg.sender, claimKey, false);

        emit Revoked(msg.sender, _claim);
    }

    function validate(address _issuer, bytes memory _claim) public view returns(bool) {
        
        bytes32 claimKey = keccak256(_claim);
        return eternalStorage1.get(_issuer, claimKey);
    }


}
