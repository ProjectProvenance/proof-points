pragma solidity 0.5.16;

import "./ProofPointRegistryStorage1.sol";
import "./ProofPointRegistry.sol";
import "./Versioned.sol";


contract ProofPointRegistry_v2 is ProofPointRegistry, Versioned {


    event Published(bytes _claim);

    constructor(address _eternalStorage1) ProofPointRegistry(_eternalStorage1) Versioned(2, ProofPointRegistryStorage1(_eternalStorage1).getOwner()) public {
    }
    
    function issue(bytes memory _claim) public {

        super.issue(_claim);
        emit Published(_claim);
    }

    function commit(bytes memory _claim) public {

        super.commit(_claim);
        emit Published(_claim);
    }
}
