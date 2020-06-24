import ProofPointRegistryAbi from '../build/contracts/ProofPointRegistry_v2.json';
import ProofPointRegistryStorage1Abi from '../build/contracts/ProofPointRegistryStorage1.json';

import { StorageProvider, IpfsStorageProvider } from './storage';
import { Contract } from 'web3-eth-contract';
import Web3 from 'web3';

import canonicalizeJson = require('canonicalize');
import localISOdt = require('local-iso-dt');

const PROOF_POINT_REGISTRY_VERSION = 2;
const GAS_LIMIT = 1000000;

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

enum ProofPointStatus {
    /**
     * The proof point object is badly formed. The proof point is invalid.
     */
    BadlyFormed,
    /**
     * The validFrom date is in the future. The proof point is invalid.
     */
    Pending,
    /**
     * The validUntil date is in the past. The proof point is invalid.
     */
    Expired,
    /**
     * The proof.registryRoot field references a smart contract that is not a whitelisted proof point registry, 
     * the validation provided is not trusted so the proof point is considered invalid.
     */
    NonTrustedRegistry,
    /**
     * The proof point registry smart contract does not contain this proof point issued by this issuer. Either
     * the issuer never issued the proof point or it was issued and later revoked by the issuer. The proof 
     * point is invalid.
     */
    NotFound,
    /**
     * The proof point has passed all of the validation checks. If you trust the issuer you can trust the meaning
     * of the proof point.
     */
    Valid
}

interface ProofPointValidateResult {
    isValid: boolean;
    statusCode: ProofPointStatus;
    statusMessage: string | null;
}

/**
 * Proof point event type, the type of an {@link ProofPointEvent}
 */
enum ProofPointEventType {
    Issued,
    Committed,
    Revoked
}

/**
 * Proof point event, describes a single event in the history of a proof point
 */
interface ProofPointEvent {
    /** 
     * The blockchain block number at which the event occurred 
     * */
    blockNumber: number;
    /**
     * The type of event e.g. Issued, Revoked etc.
     */
    type: ProofPointEventType;
    /**
     * The sender address that initiated the event
     */
    issuer: string;
    /**
     * The identifying hash of the proof point
     */
    proofPointHash: string;
}

const PROOF_TYPE = 'https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1';
const web3 = new Web3();

class ProofPointRegistry {
    private _web3: Web3;
    private _address: string;
    private _registry: Contract;
    private _storage: StorageProvider;

    /**
     * Creates an instance of proof point registry for interacting with a pre-existing deployment of the registry contracts.
     * @param address the Ethereum address of the deployed eternal storage contract
     * @param web3 a web instance to use for interacting with the Ethereum blockchain
     * @param storage a {@link StorageProvider} to use for storing/retrieving off-chain data or null to use the default implementation.
     */
    constructor(address: string, web3: Web3, storage: StorageProvider | null) {
        this._address = address;
        this._web3 = web3;
        this._storage = storage;

        if (storage === null || typeof storage === 'undefined') {
            // eslint-disable-next-line no-param-reassign
            this._storage = new IpfsStorageProvider({
                host: 'ipfs-cluster.provenance.org',
                port: 443,
                protocol: 'https'
            });
        }
    }

    /**
     * Deploys an instance of the proof point registry, including an eternal storage contract and a logic
     * contract.
     * @param fromAddress the Ethereum account to use for signing transactions. This will become the admin account that must be used for all future smart contract upgrades.
     * @param web3 a web3 instance to use for interacting with the Ethereum blockchain.
     * @param storage a {@link StorageProvider} to use for storing/retrieving off-chain data, or null to use the default provider.
     * @returns a {@link ProofPointRegistry} for interacting with the newly deployed contracts. 
     */
    static async deploy(
        fromAddress: string,
        web3: Web3, 
        storage: StorageProvider | null
    ): Promise<ProofPointRegistry>{
        // deploy eternal storage contract
        const eternalStorageContract = new web3.eth.Contract(ProofPointRegistryStorage1Abi.abi as any);
        const eternalStorage = await eternalStorageContract
            .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
            .send({from: fromAddress, gas: GAS_LIMIT});

        // deploy logic contract pointing to eternal storage
        const logicContract = new web3.eth.Contract(ProofPointRegistryAbi.abi as any);
        const logic = await logicContract
            .deploy({ data: ProofPointRegistryAbi.bytecode, arguments: [eternalStorage.options.address] })
            .send({from: fromAddress, gas: GAS_LIMIT});

        // set logic contract as owner of eternal storage
        await eternalStorage
            .methods
            .setOwner(logic.options.address)
            .send({from: fromAddress, gas: GAS_LIMIT});

        // construct and return a ProofPointRegistry object for the newly deployed setup
        const registry = new ProofPointRegistry(eternalStorage.options.address, web3, storage);
        await registry.init();

        return registry;
    }

    /**
     * Gets the address of the registry root - which is the address of the eternal storage contract
     * @returns address of registry root.
     */
    getAddress(): string {
        return this._address;
    }

    /**
     * Determines whether the deployed logic contract is the latest known version. If not then the 
     * {@link upgrade} method can be called to deploy the latest logic contract and update the plumbing
     * so that the latest version will be used for future interactions.
     * @returns true if the {@link upgrade} method can be called to upgrade the logic contract. 
     */
    async canUpgrade(): Promise<boolean> {
        try {
            const version = await this._registry.methods.getVersion().call();
            return version < PROOF_POINT_REGISTRY_VERSION;
        } catch(e) {
            // version 1 does not have the getVersion method.
            return true;
        }
    }

    /**
     * Upgrades proof point registry. Performs the upgrade procedure to deploy an instance of the latest
     * logic contract, then set that as the owner of the eternal storage contract. You must control the admin
     * account to do this. Throws if already at latest version. Use {@link canUpgrade} to determine whether 
     * this method can be called.
     */
    async upgrade(): Promise<void> {
        if (!(await this.canUpgrade())) {
            throw new Error("Cannot upgrade proof point registry: Already at or above current version.");
        }

        // get the admin account from which to perform the upgrade
        const eternalStorage = new this._web3.eth.Contract(
            ProofPointRegistryStorage1Abi.abi as any,
            this._address,
            { data: ProofPointRegistryStorage1Abi.bytecode }
        );
        const admin = await eternalStorage.methods.getAdmin().call();

        // deploy logic contract pointing to eternal storage
        const logicContract = new this._web3.eth.Contract(ProofPointRegistryAbi.abi as any);
        const logic = await logicContract
            .deploy({ data: ProofPointRegistryAbi.bytecode, arguments: [this._address] })
            .send({from: admin, gas: GAS_LIMIT});

        // set logic contract as owner of eternal storage
        eternalStorage
            .methods
            .setOwner(logic.options.address)
            .send({from: admin, gas: GAS_LIMIT});

        this._registry = logic;
    }

    /**
     * Initialises the proof point registry. Must be completed before the {@link ProofPointRegistry} can be used.
     */
    async init(): Promise<void> {
        // Use the storage contract to locate the logic contract
        const eternalStorage = new this._web3.eth.Contract(
            ProofPointRegistryStorage1Abi.abi as any,
            this._address,
            { data: ProofPointRegistryStorage1Abi.bytecode }
        );
        const logicAddress = await eternalStorage.methods.getOwner().call();

        // Prepare and store proxy object for the logic contract
        const registry = new this._web3.eth.Contract(
            ProofPointRegistryAbi.abi as any,
            logicAddress,
            { data: ProofPointRegistryAbi.bytecode }
        );
        this._registry = registry;
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
            this._registry.methods.issue,
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
            this._registry.methods.commit,
            validFromDate,
            validUntilDate
        );
    }

    /**
     * Revoke a proof point identified by its hash ID. You must control the account that originally issued the proof point. The account must be sufficiently funded to execute the revoke transaction.
     * @param proofPointHash The hash identifier of the proof point to revoke. This is the value returned in the @param proofPointHash field of the {@link ProofPointIssueResult} when the proof point was issued.
     */
    async revokeByHash(proofPointHash: string): Promise<void> {
        const storedData = await this._storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        await this.revoke(proofPointObject);
    }

    /**
     * Revoke a proof point identified by its full data. You must control the account that originally issued the proof point. The account must be sufficiently funded to execute the revoke transaction.
     * @param proofPointObject The full proof point data as returned in the @param proofPointObject parameter of the {@link ProofPointIssueResult} when the proof point was issued.
     */
    async revoke(proofPointObject: ProofPoint): Promise<void> {
        if (proofPointObject.proof.type !== PROOF_TYPE) {
            throw new Error('Unsupported proof type');
        }

        if (!this.isSameRegistry(proofPointObject)) {
            throw new Error("Registry mismatch");
        }

        const { hash } = await this.canonicalizeAndStoreObject(proofPointObject);
        const proofPointHashBytes = web3.utils.asciiToHex(hash);
        await this
            ._registry
            .methods
            .revoke(proofPointHashBytes)
            .send({ from: proofPointObject.issuer, gas: GAS_LIMIT });
    }

    /**
     * Validate a proof point identified by its hash ID. This does not involve a blockchain transaction.
     * @param proofPointHash The hash identifier of the proof point to revoke. This is the value returned in the @param proofPointHash field of the {@link ProofPointIssueResult} when the proof point was issued.
     * @returns true if the proof point passes all validation checks, otherwise false.
     */
    async validateByHash(proofPointHash: string): Promise<ProofPointValidateResult> {
        const storedData = await this._storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        return this.validate(proofPointObject);
    }

    /**
     * Validate a proof point identified by its full data. This does not involve a blockchain transaction.
     * @param proofPointObject The full proof point data as returned in the @param proofPointObject parameter of the {@link ProofPointIssueResult} when the proof point was issued.
     * @returns a {@link ProofPointValidateResult} representing the validity of the proof point.
     */
    async validate(proofPointObject: ProofPoint): Promise<ProofPointValidateResult> {

        if (proofPointObject.proof.type !== PROOF_TYPE) {
            return {
                isValid: false,
                statusCode: ProofPointStatus.BadlyFormed,
                statusMessage: "The proof point uses an unsupported proof type."
            };
        }

        if (typeof proofPointObject.validFrom !== 'undefined') {
            const validFromDate = Date.parse(proofPointObject.validFrom);
            if (validFromDate > Date.now()) {
                return {
                    isValid: false,
                    statusCode: ProofPointStatus.Pending,
                    statusMessage: "The proof point will become valid at a later date."
                };
            }
        }

        if (typeof proofPointObject.validUntil !== 'undefined') {
            const validUntilDate = Date.parse(proofPointObject.validUntil);
            if (validUntilDate < Date.now()) {
                return {
                    isValid: false,
                    statusCode: ProofPointStatus.Expired,
                    statusMessage: "The valid-until date of the proof point has passed."
                };
            }
        }

        if (!this.isSameRegistry(proofPointObject)) {
            return {
                isValid: false,
                statusCode: ProofPointStatus.NonTrustedRegistry,
                statusMessage: "The proof point is issued using a registry that is not trusted in this context."
            };
        }

        // const proofPointRegistry = await this.getProofPointRegistry(proofPointObject);
        const { hash } = await this.canonicalizeAndStoreObject(proofPointObject);
        const proofPointHashBytes = web3.utils.asciiToHex(hash);

        const isValid = await this
            ._registry
            .methods
            .validate(proofPointObject.issuer, proofPointHashBytes)
            .call();

        if (isValid) {
            return {
                isValid: true,
                statusCode: ProofPointStatus.Valid,
                statusMessage: null
            };
        } else {
            return {
                isValid: false,
                statusCode: ProofPointStatus.NotFound,
                statusMessage: "The proof point has been revoked or was never issued."
            };
        }
    }

    /**
     * Fetch the proof point document identified by its hash ID.
     * @param proofPointHash The hash identifier of the proof point document to fetch.
     */
    async getByHash(proofPointHash: string): Promise<ProofPoint> {
        const storedData = await this._storage.get(proofPointHash);
        const proofPointObject = JSON.parse(storedData.data);
        return proofPointObject;
    }

    /**
     * Get a list of the hashes of all proof points ever issued or committed
     * to this registry
     */
    async getAll(): Promise<Array<string>> {
        const publishEvents = await this
            ._registry
            .getPastEvents(
                "Published", 
                { 
                    fromBlock: 0, 
                    toBlock: "latest"
                }
            );

        return publishEvents.map(ev => Web3.utils.hexToAscii(ev.returnValues._claim));
    }

    /**
     * Gets a list of all events related to the given proof point, identified by its hash.
     * @param proofPointHash the identifying hash of the proof point
     * @returns a list of {@link ProofPointEvent} describing the history of the proof point
     */
    async getHistoryByHash(proofPointHash: string): Promise<Array<ProofPointEvent>> {
        const events = await this
            ._registry
            .getPastEvents(
                "allEvents", 
                { 
                    // TODO filter doesn't work for some reason
                    // filter: {_claim: Web3.utils.keccak256(proofPointHash) },
                    fromBlock: 0, 
                    toBlock: "latest"
                }
            );

        return events
            // TODO remove this client side filter once filter bug is fixed
            .filter(ev => ev.returnValues._claim === Web3.utils.keccak256(proofPointHash))
            .filter(ev => ev.event !== "Published")
            .map(ev => {
                return {
                    blockNumber: ev.blockNumber,
                    type: this._eventNameToEventType(ev.event),
                    issuer: ev.returnValues._issuer,
                    proofPointHash: proofPointHash
                }
            });
    }

    private _eventNameToEventType(eventName: string): ProofPointEventType {
        if(eventName === "Issued") return ProofPointEventType.Issued;
        if(eventName === "Committed") return ProofPointEventType.Committed;
        if(eventName === "Revoked") return ProofPointEventType.Revoked;
        throw new Error(`Invalid proof point event name: ${eventName}`);
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

        const { hash, canonicalisedObject } = await this.canonicalizeAndStoreObject(proofPointObject);
        const proofPointHashBytes = web3.utils.asciiToHex(hash);

        const transactionReceipt = await issueFunction(proofPointHashBytes)
            .send({ from: issuerAddress, gas: GAS_LIMIT });

        return {
            proofPointHash: hash,
            transactionHash: transactionReceipt.transactionHash,
            proofPointObject: canonicalisedObject
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
                registryRoot: this._address,
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

    private isSameRegistry(proofPoint: ProofPoint): boolean {
        return proofPoint.proof.registryRoot.toLowerCase() === this._address.toLowerCase();
    }

    private static removeEmptyFields(obj: any): any {
        Object.keys(obj).forEach((key) => {
        if (obj[key] && typeof obj[key] === 'object') ProofPointRegistry.removeEmptyFields(obj[key]);
        // eslint-disable-next-line no-param-reassign
        else if (obj[key] === undefined) delete obj[key];
        });
        return obj;
    }

    private async canonicalizeAndStoreObject(dataObject: any): Promise<{hash: string; canonicalisedObject: any}> {
        // TODO enforce SHA-256 hash alg
        // TODO add method to compute hash without storing

        // Necessary because JSON.canonicalize produces invalid JSON if there
        // are fields with value undefined
        const cleanedDataObject = ProofPointRegistry.removeEmptyFields(dataObject);

        const dataStr = canonicalizeJson(cleanedDataObject);
        const storageResult = await this._storage.add(dataStr);

        return {
            hash: storageResult.digest,
            canonicalisedObject: JSON.parse(dataStr)
        }
    }
}

export { 
    ProofPoint, 
    ProofPointIssueResult, 
    ProofPointRegistry, 
    ProofPointValidateResult, 
    ProofPointStatus,
    ProofPointEventType,
    ProofPointEvent 
};
