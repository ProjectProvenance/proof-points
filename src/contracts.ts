const ProofPointRegistry = require('../build/contracts/ProofPointRegistry.json');
const ProofPointRegistryStorage1 = require('../build/contracts/ProofPointRegistryStorage1.json');

interface ContractDefinition {
    abi: any;
    bytecode: string;
}

class ContractsManager {
  web3: any;
  proofPointStorageAddress: string;
  ProofPointRegistry: any;
  ProofPointRegistryStorage1: any;
  ProofPointRegistryInstance: any;

  constructor(web3: any, proofPointStorageAddress: string) {
    this.web3 = web3;
    this.proofPointStorageAddress = proofPointStorageAddress;
  }

  initContract(definition: ContractDefinition) {
    const contract = new this.web3.eth.Contract(
      definition.abi,
      null, // address
      { data: definition.bytecode }
    );

    contract.setProvider(this.web3.currentProvider);

    contract.at = (address: string) => new this
      .web3
      .eth
      .Contract(
        definition.abi,
        address,
        { data: definition.bytecode }
      );

    return contract;
  }

  async init() {
    this.ProofPointRegistry = this.initContract(ProofPointRegistry);
    this.ProofPointRegistryStorage1 = this.initContract(ProofPointRegistryStorage1);

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

export default ContractsManager;
