import ContractsManager from './contracts';
import { StorageProvider } from './storage';
import { Contract } from 'web3-eth-contract';
import Web3 from 'web3';

import canonicalizeJson = require('canonicalize');
import localISOdt = require('local-iso-dt');

interface ProofPoint {
    '@context': Array<string>;
    type: Array<string>;
    issuer: string;
    credentialSubject: any;
    proof: {
        type: string;
        registryRoot: string;
        proofPurpose: string;
        verificationMethod: string;
    };
    validFrom: string;
    validUntil: string;
};

interface ProofPointIssueResult {
    proofPointHash: string;
    transactionHash: string;
    proofPointObject: ProofPoint;
};

const PROOF_TYPE = 'https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1';
const web3 = new Web3();

class ProofPointsRepo {
    contracts: ContractsManager;
    storage: StorageProvider;
    gasLimit = 200000;

    constructor(contracts: ContractsManager, storage: StorageProvider) {
        this.contracts = contracts;
        this.storage = storage;
    }

    async issue(type: string,
        issuerAddress: string,
        content: string,
        validFromDate: Date | null = null,
        validUntilDate: Date | null = null
    ): Promise<ProofPointIssueResult> {
        return this._issue(type,
            issuerAddress,
            content,
            this.contracts.ProofPointRegistryInstance.methods.issue,
            validFromDate,
            validUntilDate);
    }

    async commit(type: string,
        issuerAddress: string,
        content: string,
        validFromDate: Date | null = null,
        validUntilDate: Date | null = null
    ): Promise<ProofPointIssueResult> {
        return this._issue(type,
            issuerAddress,
            content,
            this.contracts.ProofPointRegistryInstance.methods.commit,
            validFromDate,
            validUntilDate);
    }

    async revokeByHash(proofPointHash: string): Promise<void> {
        const storedData = await this.storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        this.revoke(proofPointObject);
    }

    async revoke(proofPointObject: ProofPoint): Promise<void> {
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

    async validateByHash(proofPointHash: string): Promise<boolean> {
        const storedData = await this.storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        return this.validate(proofPointObject);
    }

    async validate(proofPointObject: ProofPoint): Promise<boolean> {
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
        const proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);

        return proofPointRegistry
            .methods
            .validate(proofPointObject.issuer, proofPointHashBytes)
            .call();
    }

    async _issue(type: string,
        issuerAddress: string,
        content: string,
        issueFunction: any,
        validFromDate: Date | null = null,
        validUntilDate: Date | null = null
    ): Promise<ProofPointIssueResult> {
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
        type: string,
        issuerAddress: string,
        content: any,
        validFromDate: Date | null = null,
        validUntilDate: Date | null = null
    ): ProofPoint {
        const issuerAddressChecksum = web3.utils.toChecksumAddress(issuerAddress);

        const proofPoint: ProofPoint = {
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
            },
            validFrom: undefined,
            validUntil: undefined
        };

        if (validFromDate !== null) {
            proofPoint.validFrom = localISOdt.localISOdt(validFromDate)
        }

        if (validUntilDate !== null) {
            proofPoint.validUntil = localISOdt.localISOdt(validUntilDate);
        }

        return proofPoint;
    }

  async getProofPointRegistry(proofPoint: ProofPoint): Promise<Contract> {
      return this.contracts.getProofPointRegistry(proofPoint.proof.registryRoot);
  }

  static removeEmptyFields(obj: any): any {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === 'object') ProofPointsRepo.removeEmptyFields(obj[key]);
      // eslint-disable-next-line no-param-reassign
      else if (obj[key] === undefined) delete obj[key];
    });
    return obj;
  }

  async storeObjectAndReturnKey(dataObject: any): Promise<string> {
    // TODO enforce SHA-256 hash alg
    // TODO add method to compute hash without storing

    // Necessary because JSON.canonicalize produces invalid JSON if there
    // are fields with value undefined
    const cleanedDataObject = ProofPointsRepo.removeEmptyFields(dataObject);

    const dataStr = canonicalizeJson(cleanedDataObject);
    const storageResult = await this.storage.add(dataStr);
    return storageResult.digest;
  }

  isRegistryWhitelisted(proofPointObject: ProofPoint): boolean {
    return proofPointObject.proof.registryRoot.toLowerCase()
      === this.contracts.proofPointStorageAddress.toLowerCase();
  }
}

export { ProofPoint, ProofPointIssueResult, ProofPointsRepo };
