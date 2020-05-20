import ProofPointRegistry = require('../build/contracts/ProofPointRegistry.json');
import ProofPointRegistryStorage1 = require('../build/contracts/ProofPointRegistryStorage1.json');
import Web3 from 'Web3';
import { Contract } from 'web3-eth-contract';

interface ContractDefinition {
    abi: any;
    bytecode: string;
}

class ContractsManager {
  web3: Web3;
  proofPointStorageAddress: string;
  ProofPointRegistry: Contract;
  ProofPointRegistryStorage1: Contract;
  ProofPointRegistryInstance: Contract;

  constructor(web3: Web3, proofPointStorageAddress: string) {
    this.web3 = web3;
    this.proofPointStorageAddress = proofPointStorageAddress;
  }

  async getProofPointRegistry(storageAddress: string): Promise<Contract> {
    const proofPointStorage1 = await this
      .initContract(ProofPointRegistryStorage1, storageAddress);

    const proofPointRegistryAddress = await proofPointStorage1
      .methods
      .getOwner()
      .call();

    const proofPointRegistry = await this
      .initContract(ProofPointRegistry, proofPointRegistryAddress);

    return proofPointRegistry;
  }

  initContract(definition: ContractDefinition, address: string): Contract {
    const contract = new this.web3.eth.Contract(
      definition.abi,
      address,
      { data: definition.bytecode }
    );

    return contract;
  }

  async init(): Promise<void> {
    this.ProofPointRegistry = await this.initContract(ProofPointRegistry, undefined);
    this.ProofPointRegistryStorage1 = await this.initContract(ProofPointRegistryStorage1, undefined);

    if (typeof this.proofPointStorageAddress !== 'undefined') {
      this.ProofPointRegistryInstance = await this.getProofPointRegistry(this.proofPointStorageAddress);
    }
  }
}

export default ContractsManager;
