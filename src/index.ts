import Web3 from 'web3';
import { StorageProvider, IpfsStorageProvider } from './storage';
import ContractsManager from './contracts';
import { ProofPointsRepo } from './proofPoints';

interface ProvenanceSettings {
  web3: Web3;
  storageProvider: StorageProvider | null;
  proofPointStorageAddress: string;
}

class Provenance {
  private _web3: Web3;
  private _storage: StorageProvider;
  contracts: ContractsManager;
  proofPoint: ProofPointsRepo;

  constructor(settings: ProvenanceSettings) {
    if (typeof settings.web3 === 'undefined') {
      throw new Error('web3 must be defined');
    }

    if (settings.storageProvider === null || typeof settings.storageProvider === 'undefined') {
      // eslint-disable-next-line no-param-reassign
      settings.storageProvider = new IpfsStorageProvider({
        host: 'ipfs-cluster.provenance.org',
        port: 443,
        protocol: 'https'
      });
    }

    this._web3 = settings.web3;
    this.contracts = new ContractsManager(
      settings.web3,
      settings.proofPointStorageAddress
    );
    this._storage = settings.storageProvider;
    this.proofPoint = new ProofPointsRepo(this.contracts, this._storage);
  }

  async init(): Promise<void> {
    await this.contracts.init();
  }
}

export { Provenance, Web3, IpfsStorageProvider, StorageProvider };
