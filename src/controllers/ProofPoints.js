const PROOF_TYPE = 'https://provenance.org/ontology/ptf/v2#ProvenanceProofType1';

const Web3 = require('web3');
JSON.canonicalize = require('canonicalize');
const { localISOdt } = require('local-iso-dt');

const web3 = new Web3();

class ProofPointsController {
  constructor(contracts, storage) {
    this.contracts = contracts
    this.storage = storage
    this.gasLimit = 200000
  }

  async issue(type,
    issuerAddress,
    content,
    validFromDate = null,
    validUntilDate = null) {
    return this._issue(type,
      issuerAddress,
      content,
      this.contracts.ProofPointRegistryInstance.methods.issue,
      validFromDate,
      validUntilDate);
  }

  async commit(type,
    issuerAddress,
    content,
    validFromDate = null,
    validUntilDate = null) {
    return this._issue(type,
      issuerAddress,
      content,
      this.contracts.ProofPointRegistryInstance.methods.commit,
      validFromDate,
      validUntilDate);
  }

  async revokeByHash(proofPointHash) {
    const storedData = await this.storage.get(proofPointHash);
    const proofPointObject = JSON.parse(storedData.data);
    return this.revoke(proofPointObject);
  }

  async revoke(proofPointObject) {
    if (proofPointObject.proof.type !== PROOF_TYPE) {
      throw new Error('Unsupported proof type');
    }

    const proofPointRegistry = await this.getProofPointRegistry(proofPointObject);
    const proofPointHash = await this.storeObjectAndReturnKey(proofPointObject);
    const proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);
    await proofPointRegistry
      .methods
      .revoke(proofPointHashBytes)
      .send({ from: proofPointObject.issuer, gas: this.gasLimit });
  }

  async validateByHash(proofPointHash) {
    const storedData = await this.storage.get(proofPointHash);
    const proofPointObject = JSON.parse(storedData.data);
    return this.validate(proofPointObject);
  }

  async validate(proofPointObject) {
    if (proofPointObject.proof.type !== PROOF_TYPE) {
      throw new Error('Unsupported proof type');
    }

    if (typeof proofPointObject.validFrom !== 'undefined') {
      const validFromDate = Date.parse(proofPointObject.validFrom);
      if (validFromDate > Date.now()) {
        return false;
      }
    }

    if (typeof proofPointObject.validUntil !== 'undefined') {
      const validUntilDate = Date.parse(proofPointObject.validUntil);
      if (validUntilDate < Date.now()) {
        return false;
      }
    }

    const proofPointRegistry = await this.getProofPointRegistry(proofPointObject);
    const proofPointHash = await this.storeObjectAndReturnKey(proofPointObject);
    const proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);

    return proofPointRegistry
      .methods
      .validate(proofPointObject.issuer, proofPointHashBytes)
      .call();
  }

  async _issue(type,
    issuerAddress,
    content,
    issueFunction,
    validFromDate = null,
    validUntilDate = null) {
    const proofPointObject = this.buildJson(
      type,
      issuerAddress,
      content,
      validFromDate,
      validUntilDate
    );

    const proofPointHash = await this.storeObjectAndReturnKey(proofPointObject);
    const proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);

    const transactionReceipt = await issueFunction(proofPointHashBytes)
      .send({ from: issuerAddress, gas: this.gasLimit });

    return {
      proofPointHash: proofPointHash,
      transactionHash: transactionReceipt.transactionHash,
      proofPointObject: proofPointObject
    };
  }

  buildJson(
    type,
    issuerAddress,
    content,
    validFromDate = null,
    validUntilDate = null
  ) {
    const issuerAddressChecksum = web3.utils.toChecksumAddress(issuerAddress);

    const proofPoint = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://provenance.org/ontology/ptf/v2'
      ],
      type: ['VerifiableCredential', type],
      issuer: issuerAddressChecksum,
      credentialSubject: content,
      proof: {
        type: PROOF_TYPE,
        registryRoot: this.contracts.proofPointStorageAddress,
        proofPurpose: 'assertionMethod',
        verificationMethod: issuerAddressChecksum
      }
    };

    if (validFromDate !== null) {
      proofPoint.validFrom = localISOdt(validFromDate)
    }

    if (validUntilDate !== null) {
      proofPoint.validUntil = localISOdt(validUntilDate);
    }

    return proofPoint;
  }

  async getProofPointRegistry(proofPointObject) {
    const proofPointStorageAddress = await this
      .contracts
      .ProofPointRegistryStorage1
      .at(proofPointObject.proof.registryRoot);

    const proofPointRegistryAddress = await proofPointStorageAddress
      .methods
      .getOwner()
      .call();

    const proofPointRegistry = await this
      .contracts
      .ProofPointRegistry
      .at(proofPointRegistryAddress);

    return proofPointRegistry;
  }

  static removeEmptyFields(obj) {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === 'object') ProofPointsController.removeEmptyFields(obj[key]);
      // eslint-disable-next-line no-param-reassign
      else if (obj[key] === undefined) delete obj[key];
    });
    return obj;
  }

  async storeObjectAndReturnKey(dataObject) {
    // TODO enforce SHA-256 hash alg
    // TODO add method to compute hash without storing

    // Necessary because JSON.canonicalize produces invalid JSON if there
    // are fields with value undefined
    const cleanedDataObject = ProofPointsController.removeEmptyFields(dataObject);

    const dataStr = JSON.canonicalize(cleanedDataObject);
    const storageResult = await this.storage.add(dataStr);
    return storageResult.digest;
  }
}

module.exports = ProofPointsController
