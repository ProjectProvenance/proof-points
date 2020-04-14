const PROOF_TYPE = 'https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1';

const Web3 = require('web3');
JSON.canonicalize = require('canonicalize');
const { localISOdt } = require('local-iso-dt');
const didJWT = require('did-jwt');
const { HTTP } = require('http-call');
const Resolver = require('./VerySimpleEthrDidResolver');

class ProofPointsController {
  constructor(contracts, storage) {
    this.contracts = contracts;
    this.storage = storage;
    this.gasLimit = 200000;
    this.web3 = new Web3();
    this.fetchWellKnownDidResource = async function(domain) {
      const response = await HTTP.get(`https://${domain}/.well-known/did-configuration.json`);
      return JSON.parse(response.body);
    }
  }

  async issue(type,
    issuer,
    content,
    validFromDate = null,
    validUntilDate = null) {
    return this._issue(type,
      issuer,
      content,
      this.contracts.ProofPointRegistryInstance.methods.issue,
      validFromDate,
      validUntilDate);
  }

  async commit(type,
    issuer,
    content,
    validFromDate = null,
    validUntilDate = null) {
    return this._issue(type,
      issuer,
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
    const proofPointHashBytes = this.web3.utils.asciiToHex(proofPointHash);
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

    if (!this.isRegistryWhitelisted(proofPointObject)) {
      return false;
    }

    const proofPointRegistry = await this.getProofPointRegistry(proofPointObject);
    const proofPointHash = await this.storeObjectAndReturnKey(proofPointObject);
    const proofPointHashBytes = this.web3.utils.asciiToHex(proofPointHash);

    const issuerAddress = await this.issuerToEthereumAddress(proofPointObject.issuer);
    if (!issuerAddress) {
      return false;
    }

    return proofPointRegistry
      .methods
      .validate(issuerAddress, proofPointHashBytes)
      .call();
  }

  async _issue(type,
    issuerDomain,
    content,
    issueFunction,
    validFromDate = null,
    validUntilDate = null) {
    const proofPointObject = this.buildJson(
      type,
      issuerDomain,
      content,
      validFromDate,
      validUntilDate
    );

    const proofPointHash = await this.storeObjectAndReturnKey(proofPointObject);
    const proofPointHashBytes = this.web3.utils.asciiToHex(proofPointHash);

    const issuerAddress = await this.issuerToEthereumAddress(issuerDomain);
    if (!issuerAddress) {
      throw new Error('Unable to resolve issuer domain to ethereum address');
    }

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
    issuer,
    content,
    validFromDate = null,
    validUntilDate = null
  ) {
    const proofPoint = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://provenance.org/ontology/ptf/v2'
      ],
      type: ['VerifiableCredential', type],
      issuer: issuer,
      credentialSubject: content,
      proof: {
        type: PROOF_TYPE,
        registryRoot: this.contracts.proofPointStorageAddress,
        proofPurpose: 'assertionMethod',
        verificationMethod: issuer
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
    const proofPointStorage1 = await this
      .contracts
      .ProofPointRegistryStorage1
      .at(proofPointObject.proof.registryRoot);

    const proofPointRegistryAddress = await proofPointStorage1
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

  isRegistryWhitelisted(proofPointObject) {
    return proofPointObject.proof.registryRoot.toLowerCase()
      === this.contracts.proofPointStorageAddress.toLowerCase();
  }

  async issuerToEthereumAddress(issuer) {
    try {
      if (/^0x[a-fA-F0-9]{40}$/.test(issuer)) {
        return this.web3.utils.toChecksumAddress(issuer);
      }

      const didConfiguration = await this.fetchWellKnownDidResource(issuer);
      const jwt = didConfiguration.entries[0];
      const resolver = new Resolver();
      const verified = await didJWT.verifyJWT(jwt, {
        resolver: resolver
      });
      const verifiedDomain = verified.payload.vc.credentialSubject.domain;
      if (verifiedDomain !== issuer) {
        throw new Error(`Token is valid but links a different domain: ${verifiedDomain}, ${issuer}`);
      }
      const address = verified.signer.ethereumAddress;
      return this.web3.utils.toChecksumAddress(address);
    } catch (e) {
      return undefined
    }
  }
}

module.exports = ProofPointsController
