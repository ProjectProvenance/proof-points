// import ProofPointRegistry = require('../build/contracts/ProofPointRegistry_v2.json');
// import ProofPointRegistryStorage1 = require('../build/contracts/ProofPointRegistryStorage1.json');
// import Web3 from 'web3';
// import { Contract } from 'web3-eth-contract';

// const PROOF_POINT_REGISTRY_VERSION = 2;

// interface ContractDefinition {
//     abi: any;
//     bytecode: string;
// }

// class ContractsManager {
//   web3: Web3;
//   proofPointStorageAddress: string;
//   ProofPointRegistry: Contract;
//   ProofPointRegistryStorage1: Contract;
//   ProofPointRegistryInstance: Contract;

//   constructor(web3: Web3, proofPointStorageAddress: string) {
//     this.web3 = web3;
//     this.proofPointStorageAddress = proofPointStorageAddress;
//   }

//   async init(): Promise<void> {
//     this.ProofPointRegistry = await this._initContract(ProofPointRegistry, undefined);
//     this.ProofPointRegistryStorage1 = await this._initContract(ProofPointRegistryStorage1, undefined);

//     if (typeof this.proofPointStorageAddress !== 'undefined') {
//       this.ProofPointRegistryInstance = await this._getProofPointRegistry(this.proofPointStorageAddress);
//     }
//   }

//   canDeployProofPointRegistry(): boolean {
//     return typeof this.proofPointStorageAddress === 'undefined';
//   }

//   async deployProofPointRegistry(fromAccount: string): Promise<void> {
//     if (!this.canDeployProofPointRegistry()) {
//       throw new Error('Cannot deploy a proof point registry: Registry is already deployed.');
//     }

//     const eternalStorage = await this
//       .ProofPointRegistryStorage1
//       .deploy()
//       .send({ from: fromAccount, gas: 1000000 });

//     const proofPointRegistry = await this
//       .ProofPointRegistry
//       .deploy({ arguments: [eternalStorage.options.address] })
//       .send({ from: fromAccount, gas: 1000000 });

//     await eternalStorage
//       .methods
//       .setOwner(proofPointRegistry.options.address)
//       .send({ from: fromAccount, gas: 1000000 });

//     this.proofPointStorageAddress = eternalStorage.options.address;
//     this.ProofPointRegistryInstance = await this._getProofPointRegistry(this.proofPointStorageAddress);
//   }

//   async canUpgradeProofPointRegistry(): Promise<boolean> {
//     if (typeof this.ProofPointRegistryInstance === 'undefined') return false;

//     const version = (await this.ProofPointRegistryInstance.methods.getVersion().call()).toNumber();
    
//     return version < PROOF_POINT_REGISTRY_VERSION;
//   }

//   async upgradeProofPointRegistry(): Promise<void> {
//     if (!(await this.canUpgradeProofPointRegistry())) {
//       throw new Error("Cannot upgrade proof point registry: Already at or above current version.");
//     }

//     const storage = await this._initContract(ProofPointRegistryStorage1, this.proofPointStorageAddress);
//     const admin = storage.methods.getAdmin().call();

//     const newRegistry = await ProofPointRegistry.new(this.proofPointStorageAddress, { from: admin });
//     await storage.methods.setOwner(newRegistry.address, { from: admin }).send();
//   }

//   private async _getProofPointRegistry(storageAddress: string): Promise<Contract> {
//     const proofPointStorage1 = await this
//       ._initContract(ProofPointRegistryStorage1, storageAddress);

//     const proofPointRegistryAddress = await proofPointStorage1
//       .methods
//       .getOwner()
//       .call();

//     const proofPointRegistry = await this
//       ._initContract(ProofPointRegistry, proofPointRegistryAddress);

//     return proofPointRegistry;
//   }

//   private _initContract(definition: ContractDefinition, address: string): Contract {
//     const contract = new this.web3.eth.Contract(
//       definition.abi,
//       address,
//       { data: definition.bytecode }
//     );

//     return contract;
//   }
// }

// export default ContractsManager;
