const Web3 = require('web3');
const IPFSProvider = require('./storage/providers/ipfs.js');
const ContractsManager = require('./contracts');
const Storage = require('./storage');
const ProofPointsController = require('./controllers/ProofPoints');

class Provenance {
  constructor(settings) {
    if (typeof settings === 'undefined') {
      // eslint-disable-next-line no-param-reassign
      settings = {}
    }

    if (typeof settings.web3 === 'undefined') {
      throw new Error('web3 must be defined');
    }

    if (typeof settings.storageProvider === 'undefined') {
      // eslint-disable-next-line no-param-reassign
      settings.storageProvider = new IPFSProvider({
        host: 'ipfs-cluster.provenance.org',
        port: 443,
        protocol: 'https'
      });
    }

    this.web3 = settings.web3;
    this.contracts = new ContractsManager(
      settings.web3,
      settings.proofPointStorageAddress
    );
    this.storage = new Storage(settings.storageProvider);
    this.proofPoint = new ProofPointsController(this.contracts, this.storage);
  }

  async init() {
    [this.signingAccount] = (await this.web3.eth.getAccounts());
    await this.contracts.init();
  }
}

Provenance.Storage = Storage
Provenance.Web3 = Web3

module.exports = Provenance
