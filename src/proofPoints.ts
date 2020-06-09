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
    credentialSubject: unknown;
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

enum ProofPointValidity {
    /**
     * The proof point object is badly formed. The proof point is invalid.
     */
    InvalidBadlyFormed,
    /**
     * The validFrom date is in the future. The proof point is invalid.
     */
    InvalidPending,
    /**
     * The validUntil date is in the past. The proof point is invalid.
     */
    InvalidExpired,
    /**
     * The proof.registryRoot field references a smart contract that is not a whitelisted proof point registry, 
     * the validation provided is not trusted so the proof point is considered invalid.
     */
    InvalidNonTrustedRegistry,
    /**
     * The proof point registry smart contract does not contain this proof point issued by this issuer. Either
     * the issuer never issued the proof point or it was issued and later revoked by the issuer. The proof 
     * point is invalid.
     */
    InvalidRevokedOrNeverIssued,
    /**
     * The proof point has passed all of the validation checks. If you trust the issuer you can trust the meaning
     * of the proof point.
     */
    Valid
}

interface ProofPointValidateResult {
    validity: ProofPointValidity;
    message: string | null;
}

const PROOF_TYPE = 'https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1';
const web3 = new Web3();

class ProofPointsRepo {
    private _contracts: ContractsManager;
    private _storage: StorageProvider;
    private _gasLimit = 200000;

    constructor(contracts: ContractsManager, storage: StorageProvider) {
        this._contracts = contracts;
        this._storage = storage;
    }

    /**
     * Issue a new proof point
     * @param type A URI string identifying the type of proof point to issue. This may be one of the values defined in the Provenance ontology.
     * @param issuerAddress The Ethereum address from which to issue the proof point. This must be an account that you control and must be sufficiently funded to pay for the issuance transaction.
     * @param content A javascript object representing the type specific content of the payload. The shape of the data should conform to the specification of the @param type parameter
     * @param [validFromDate] Optional date from which the issued proof point will be valid. If null then there is no earliest date at which the proof point is valid.
     * @param [validUntilDate] Optional date until which the issued proof point will be valid. If null then there is no latest date at which the proof point is valid.
     * @returns A ProofPointIssueResult describing the result of the action.
     */
    async issue(type: string,
        issuerAddress: string,
        content: unknown,
        validFromDate: Date | null = null,
        validUntilDate: Date | null = null
    ): Promise<ProofPointIssueResult> {
        return this._issue(type,
            issuerAddress,
            content,
            this._contracts.ProofPointRegistryInstance.methods.issue,
            validFromDate,
            validUntilDate
        );
    }

    /**
     * Commit a new proof point
     * @param type A URI string identifying the type of proof point to issue. This may be one of the values defined in the Provenance ontology.
     * @param issuerAddress The Ethereum address from which to issue the proof point. This must be an account that you control and must be sufficiently funded to pay for the issuance transaction.
     * @param content A javascript object representing the type specific content of the payload. The shape of the data should conform to the specification of the @param type parameter
     * @param [validFromDate] Optional date from which the issued proof point will be valid. If null then there is no earliest date at which the proof point is valid.
     * @param [validUntilDate] Optional date until which the issued proof point will be valid. If null then there is no latest date at which the proof point is valid.
     * @returns A ProofPointIssueResult describing the result of the action.
     */
    async commit(type: string,
        issuerAddress: string,
        content: string,
        validFromDate: Date | null = null,
        validUntilDate: Date | null = null
    ): Promise<ProofPointIssueResult> {
        return this._issue(type,
            issuerAddress,
            content,
            this._contracts.ProofPointRegistryInstance.methods.commit,
            validFromDate,
            validUntilDate
        );
    }

    /**
     * Revoke a proof point identified by its hash ID. You must control the account that originally issued the proof point. The account must be sufficiently funded to execute the revoke transaction.
     * @param proofPointHash The hash identifier of the proof point to revoke. This is the value returned in the @param proofPointHash field of the @type ProofPointIssueResult when the proof point was issued.
     */
    async revokeByHash(proofPointHash: string): Promise<void> {
        const storedData = await this._storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        await this.revoke(proofPointObject);
    }

    /**
     * Revoke a proof point identified by its full data. You must control the account that originally issued the proof point. The account must be sufficiently funded to execute the revoke transaction.
     * @param proofPointObject The full proof point data as returned in the @param proofPointObject parameter of the @type ProofPointIssueResult when the proof point was issued.
     */
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
            .send({ from: proofPointObject.issuer, gas: this._gasLimit });
    }

    /**
     * Validate a proof point identified by its hash ID. This does not involve a blockchain transaction.
     * @param proofPointHash The hash identifier of the proof point to revoke. This is the value returned in the @param proofPointHash field of the @type ProofPointIssueResult when the proof point was issued.
     * @returns true if the proof point passes all validation checks, otherwise false.
     */
    async validateByHash(proofPointHash: string): Promise<ProofPointValidateResult> {
        const storedData = await this._storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        return this.validate(proofPointObject);
    }

    /**
     * Validate a proof point identified by its full data. This does not involve a blockchain transaction.
     * @param proofPointObject The full proof point data as returned in the @param proofPointObject parameter of the @type ProofPointIssueResult when the proof point was issued.
     * @returns a @type ProofPointValidateResult representing the validity of the proof point.
     */
    async validate(proofPointObject: ProofPoint): Promise<ProofPointValidateResult> {

        if (proofPointObject.proof.type !== PROOF_TYPE) {
            return {
                validity: ProofPointValidity.InvalidBadlyFormed,
                message: "The proof point uses an unsupported proof type."
            };
        }

        if (typeof proofPointObject.validFrom !== 'undefined') {
            const validFromDate = Date.parse(proofPointObject.validFrom);
            if (validFromDate > Date.now()) {
                return {
                    validity: ProofPointValidity.InvalidPending,
                    message: "The proof point will become valid at a later date."
                };
            }
        }

        if (typeof proofPointObject.validUntil !== 'undefined') {
            const validUntilDate = Date.parse(proofPointObject.validUntil);
            if (validUntilDate < Date.now()) {
                return {
                    validity: ProofPointValidity.InvalidExpired,
                    message: "The valid-until date of the proof point has passed."
                };
            }
        }

        if (!this.isRegistryWhitelisted(proofPointObject)) {
            return {
                validity: ProofPointValidity.InvalidNonTrustedRegistry,
                message: "The proof point is issued using a registry that is not trusted in this context."
            };
        }

        const proofPointRegistry = await this.getProofPointRegistry(proofPointObject);
        const proofPointHash = await this.storeObjectAndReturnKey(proofPointObject);
        const proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);

        const isValid = await proofPointRegistry
            .methods
            .validate(proofPointObject.issuer, proofPointHashBytes)
            .call();

        if (isValid) {
            return {
                validity: ProofPointValidity.Valid,
                message: null
            };
        } else {
            return {
                validity: ProofPointValidity.InvalidRevokedOrNeverIssued,
                message: "The proof point has been revoked by the issuer or was never issued."
            };
        }
    }

    private async _issue(type: string,
        issuerAddress: string,
        content: unknown,
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
            .send({ from: issuerAddress, gas: this._gasLimit });

        return {
            proofPointHash: proofPointHash,
            transactionHash: transactionReceipt.transactionHash,
            proofPointObject: proofPointObject
        };
    }

    private buildJson(
        type: string,
        issuerAddress: string,
        content: unknown,
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
                registryRoot: this._contracts.proofPointStorageAddress,
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

  private async getProofPointRegistry(proofPoint: ProofPoint): Promise<Contract> {
      return this._contracts.getProofPointRegistry(proofPoint.proof.registryRoot);
  }

  private static removeEmptyFields(obj: any): any {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === 'object') ProofPointsRepo.removeEmptyFields(obj[key]);
      // eslint-disable-next-line no-param-reassign
      else if (obj[key] === undefined) delete obj[key];
    });
    return obj;
  }

  private async storeObjectAndReturnKey(dataObject: any): Promise<string> {
    // TODO enforce SHA-256 hash alg
    // TODO add method to compute hash without storing

    // Necessary because JSON.canonicalize produces invalid JSON if there
    // are fields with value undefined
    const cleanedDataObject = ProofPointsRepo.removeEmptyFields(dataObject);

    const dataStr = canonicalizeJson(cleanedDataObject);
    const storageResult = await this._storage.add(dataStr);
    return storageResult.digest;
  }

  isRegistryWhitelisted(proofPointObject: ProofPoint): boolean {
    return proofPointObject.proof.registryRoot.toLowerCase()
      === this._contracts.proofPointStorageAddress.toLowerCase();
  }
}

export { ProofPoint, ProofPointIssueResult, ProofPointsRepo, ProofPointValidateResult, ProofPointValidity };
