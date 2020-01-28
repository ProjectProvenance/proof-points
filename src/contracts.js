const ProofPointRegistry = require('../build/contracts/ProofPointRegistry.json');
const ProofPointRegistryStorage1= require('../build/contracts/ProofPointRegistryStorage1.json');

class ContractsManager {
  constructor(web3, proofPointStorageAddress) {
    this.web3 = web3;
    this.proofPointStorageAddress = proofPointStorageAddress;
  }

  async init() {
    this.ProofPointRegistry = new this.web3.eth.Contract(
      ProofPointRegistry.abi,
      null, // address
      { data: ProofPointRegistry.bytecode }
    );
    this.ProofPointRegistryStorage1 = new this.web3.eth.Contract(
      ProofPointRegistryStorage1.abi,
      null, // address
      { data: ProofPointRegistryStorage1.bytecode }
    );


    this.ProofPointRegistry.setProvider(this.web3.currentProvider);
    this.ProofPointRegistryStorage1.setProvider(this.web3.currentProvider);

    this.ProofPointRegistry.at = address => new this
      .web3
      .eth
      .Contract(
        ProofPointRegistry.abi,
        address,
        { data: ProofPointRegistry.bytecode }
      );

    this.ProofPointRegistryStorage1.at = address => new this
      .web3
      .eth
      .Contract(
        ProofPointRegistryStorage1.abi,
        address,
        { data: ProofPointRegistryStorage1.bytecode }
      );

    if (typeof this.proofPointStorageAddress !== 'undefined') {
      const eternalStorage = await this
        .ProofPointRegistryStorage1
        .at(this.proofPointStorageAddress);
      const proofPointRegistryAddress = await eternalStorage
        .methods
        .getOwner()
        .call();
      this.ProofPointRegistryInstance = await this.ProofPointRegistry.at(proofPointRegistryAddress);
    }
  }
}

module.exports = ContractsManager;
