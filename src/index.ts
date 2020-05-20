import Web3 from 'web3';
import { StorageProvider, IpfsStorageProvider, IpfsStorageProviderSettings } from './storage';
import ContractsManager from './contracts';
import { ProofPointsRepo } from './proofPoints';

interface ProvenanceSettings {
  web3: Web3;
  storageSettings: IpfsStorageProviderSettings;
  proofPointStorageAddress: string;
}

class Provenance {
  web3: Web3;
  contracts: ContractsManager;
  storage: StorageProvider;
  proofPoint: ProofPointsRepo;

  constructor(settings: ProvenanceSettings) {
    if (typeof settings === 'undefined') {
      // eslint-disable-next-line no-param-reassign
      settings = {
        web3: undefined,
        storageSettings: undefined,
        proofPointStorageAddress: undefined
      }
    }

    if (typeof settings.web3 === 'undefined') {
      throw new Error('web3 must be defined');
    }

    if (typeof settings.storageSettings === 'undefined') {
      // eslint-disable-next-line no-param-reassign
      settings.storageSettings = {
        host: 'ipfs-cluster.provenance.org',
        port: 443,
        protocol: 'https'
      };
    }

    this.web3 = settings.web3;
    this.contracts = new ContractsManager(
      settings.web3,
      settings.proofPointStorageAddress
    );
    this.storage = new IpfsStorageProvider(settings.storageSettings);
    this.proofPoint = new ProofPointsRepo(this.contracts, this.storage);
  }

  async init(): Promise<void> {
    await this.contracts.init();
  }
}

export { Provenance, Web3 };