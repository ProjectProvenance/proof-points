import ProofPointRegistryAbiV1 from "../build/contracts/ProofPointRegistry_v2.json";
import ProofPointRegistryAbiV2 from "../build/contracts/ProofPointRegistry_v2.json";

const ProofPointRegistryAbi = [
  undefined,
  ProofPointRegistryAbiV1,
  ProofPointRegistryAbiV2,
];

import ProofPointRegistryStorage1Abi from "../build/contracts/ProofPointRegistryStorage1.json";

import { StorageProvider, IpfsStorageProvider } from "./storage";
import { Contract } from "web3-eth-contract";
import Web3 from "web3";

import canonicalizeJson = require("canonicalize");
import localISOdt = require("local-iso-dt");

const PROOF_POINT_REGISTRY_VERSION = 2;
const GAS_LIMIT = 1000000;

interface ProofPoint {
  "@context": Array<string>;
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
}

interface ProofPointIssueResult {
  proofPointId: string;
  transactionHash: string;
  proofPointObject: ProofPoint;
}

enum ProofPointStatus {
  /**
   * The Proof Point object is badly formed. The Proof Point is invalid.
   */
  BadlyFormed,
  /**
   * The validFrom date is in the future. The Proof Point is invalid.
   */
  Pending,
  /**
   * The validUntil date is in the past. The Proof Point is invalid.
   */
  Expired,
  /**
   * The proof.registryRoot field references a smart contract that is not a whitelisted Proof Point registry,
   * the validation provided is not trusted so the Proof Point is considered invalid.
   */
  NonTrustedRegistry,
  /**
   * The Proof Point registry smart contract does not contain this Proof Point issued by this issuer. Either
   * the issuer never issued the Proof Point or it was issued and later revoked by the issuer. The proof
   * point is invalid.
   */
  NotFound,
  /**
   * The issuer of the Proof Point could not be resolved to an Ethereum address
   */
  UnknownIssuer,
  /**
   * The Proof Point has passed all of the validation checks. If you trust the issuer you can trust the meaning
   * of the Proof Point.
   */
  Valid,
}

interface ProofPointValidateResult {
  isValid: boolean;
  statusCode: ProofPointStatus;
  statusMessage: string | null;
}

/**
 * Proof Point event type, the type of an {@link ProofPointEvent}.
 */
enum ProofPointEventType {
  Issued,
  Committed,
  Revoked,
}

/**
 * Proof Point event, describes a single event in the history of a Proof Point.
 */
interface ProofPointEvent {
  /**
   * The blockchain block number at which the event occurred.
   * */
  blockNumber: number;
  /**
   * The type of event e.g. Issued, Revoked etc.
   */
  type: ProofPointEventType;
  /**
   * The sender address that initiated the event.
   */
  issuer: string;
  /**
   * The ID of the Proof Point.
   */
  proofPointId: string;
  /**
   * The Ethereum transaction hash of the transaction that emitted this event
   */
  transactionHash: string;
}

const PROOF_TYPE =
  "https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1";
const web3 = new Web3();

interface HttpClient {
  fetch(url: string): Promise<string>;
}

class RealHttpClient {
  async fetch(url: string): Promise<string> {
    const response = await fetch(url);
    const body = await response.text();
    return body;
  }
}

class ProofPointRegistry {
  private _web3: Web3;
  private _address: string;
  private _registry: Contract;
  private _storage: StorageProvider;
  private _httpClient: HttpClient;

  /**
   * Creates an instance of Proof Point registry for interacting with a pre-existing deployment of the registry contracts.
   * @param address the Ethereum address of the deployed eternal storage contract.
   * @param web3 a web instance to use for interacting with the Ethereum blockchain.
   * @param storage a {@link StorageProvider} to use for storing/retrieving off-chain data or null to use the default implementation.
   * @param httpClient a {@link HttpClient} to use for fetching DID documents in order to support did:web issuers or null to use the default implementation.
   */
  constructor(
    address: string,
    web3: Web3,
    storage: StorageProvider | null = null,
    httpClient: HttpClient | null = null
  ) {
    this._address = address;
    this._web3 = web3;
    this._storage = storage;

    if (storage === null || typeof storage === "undefined") {
      // eslint-disable-next-line no-param-reassign
      this._storage = new IpfsStorageProvider({
        host: "ipfs-cluster.provenance.org",
        port: 443,
        protocol: "https",
      });
    }

    if (httpClient === null) {
      this._httpClient = new RealHttpClient();
    } else {
      this._httpClient = httpClient;
    }
  }

  /**
   * Deploys an instance of the Proof Point registry, including an eternal storage contract and a logic
   * contract.
   * @param fromAddress the Ethereum account to use for signing transactions. This will become the admin account that must be used for all future smart contract upgrades.
   * @param web3 a web3 instance to use for interacting with the Ethereum blockchain.
   * @param storage a {@link StorageProvider} to use for storing/retrieving off-chain data, or null to use the default provider.
   * @param httpClient a {@link HttpClient} to use for fetching DID documents in order to support did:web issuers or null to use the default implementation.
   * @returns a {@link ProofPointRegistry} for interacting with the newly deployed contracts.
   */
  static async deploy(
    fromAddress: string,
    web3: Web3,
    storage: StorageProvider | null = null,
    httpClient: HttpClient | null = null
  ): Promise<ProofPointRegistry> {
    // deploy eternal storage contract
    const eternalStorageContract = new web3.eth.Contract(
      ProofPointRegistryStorage1Abi.abi as any
    );
    const eternalStorage = await eternalStorageContract
      .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
      .send({ from: fromAddress, gas: GAS_LIMIT });

    // deploy logic contract pointing to eternal storage
    const logicContract = new web3.eth.Contract(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi as any
    );
    const logic = await logicContract
      .deploy({
        data: ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode,
        arguments: [eternalStorage.options.address],
      })
      .send({ from: fromAddress, gas: GAS_LIMIT });

    // set logic contract as owner of eternal storage
    await eternalStorage.methods
      .setOwner(logic.options.address)
      .send({ from: fromAddress, gas: GAS_LIMIT });

    // construct and return a ProofPointRegistry object for the newly deployed setup
    const registry = new ProofPointRegistry(
      eternalStorage.options.address,
      web3,
      storage,
      httpClient
    );
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
    const version = await this._getVersion();
    return version < PROOF_POINT_REGISTRY_VERSION;
  }

  /**
   * Upgrades Proof Point registry. Performs the upgrade procedure to deploy an instance of the latest
   * logic contract, then set that as the owner of the eternal storage contract. You must control the admin
   * account to do this. Throws if already at latest version. Use {@link canUpgrade} to determine whether
   * this method can be called.
   */
  async upgrade(): Promise<void> {
    if (!(await this.canUpgrade())) {
      throw new Error(
        "Cannot upgrade Proof Point registry: Already at or above current version."
      );
    }

    // get the admin account from which to perform the upgrade
    const eternalStorage = new this._web3.eth.Contract(
      ProofPointRegistryStorage1Abi.abi as any,
      this._address,
      { data: ProofPointRegistryStorage1Abi.bytecode }
    );
    const admin = await eternalStorage.methods.getAdmin().call();

    // deploy logic contract pointing to eternal storage
    const logicContract = new this._web3.eth.Contract(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi as any
    );
    const logic = await logicContract
      .deploy({
        data: ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode,
        arguments: [this._address],
      })
      .send({ from: admin, gas: GAS_LIMIT });

    // set logic contract as owner of eternal storage
    eternalStorage.methods
      .setOwner(logic.options.address)
      .send({ from: admin, gas: GAS_LIMIT });

    this._registry = logic;
  }

  /**
   * Initialises the Proof Point registry. Must be completed before the {@link ProofPointRegistry} can be used.
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
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi as any,
      logicAddress,
      { data: ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode }
    );
    this._registry = registry;
  }

  /**
   * Issue a new Proof Point
   * @param type A URI string identifying the type of Proof Point to issue. This may be one of the values defined in the Provenance ontology.
   * @param issuer A string identifying the Ethereum address from which to issue the Proof Point. This may be either an Ethereum address or a did:web URI. It must represent an account that you control and must be sufficiently funded to pay for the issuance transaction.
   * @param content A javascript object representing the type specific content of the payload. The shape of the data should conform to the specification of the @param type parameter.
   * @param [validFromDate] Optional date from which the issued Proof Point will be valid. If null then there is no earliest date at which the Proof Point is valid.
   * @param [validUntilDate] Optional date until which the issued Proof Point will be valid. If null then there is no latest date at which the Proof Point is valid.
   * @returns A ProofPointIssueResult describing the result of the action.
   */
  async issue(
    type: string,
    issuer: string,
    content: unknown,
    validFromDate: Date | null = null,
    validUntilDate: Date | null = null
  ): Promise<ProofPointIssueResult> {
    return this._issue(
      type,
      issuer,
      content,
      this._registry.methods.issue,
      validFromDate,
      validUntilDate
    );
  }

  /**
   * Commit a new Proof Point
   * @param type A URI string identifying the type of Proof Point to issue. This may be one of the values defined in the Provenance ontology.
   * @param issuer A string identifying the Ethereum address from which to commit the Proof Point. This may be either an Ethereum address or a did:web URI. It must represent an account that you control and must be sufficiently funded to pay for the issuance transaction.
   * @param content A javascript object representing the type specific content of the payload. The shape of the data should conform to the specification of the @param type parameter.
   * @param [validFromDate] Optional date from which the issued Proof Point will be valid. If null then there is no earliest date at which the Proof Point is valid.
   * @param [validUntilDate] Optional date until which the issued Proof Point will be valid. If null then there is no latest date at which the Proof Point is valid.
   * @returns A ProofPointIssueResult describing the result of the action.
   */
  async commit(
    type: string,
    issuerAddress: string,
    content: string,
    validFromDate: Date | null = null,
    validUntilDate: Date | null = null
  ): Promise<ProofPointIssueResult> {
    return this._issue(
      type,
      issuerAddress,
      content,
      this._registry.methods.commit,
      validFromDate,
      validUntilDate
    );
  }

  /**
   * Revoke a Proof Point identified by it's ID. You must control the account that originally issued the Proof Point. The account must be sufficiently funded to execute the revoke transaction.
   * @param proofPointId The ID of the Proof Point to revoke. This is the value returned in the @param proofPointId field of the {@link ProofPointIssueResult} when the Proof Point was issued.
   */
  async revokeById(proofPointId: string): Promise<void> {
    const storedData = await this._storage.get(proofPointId);
    const proofPointObject = JSON.parse(storedData.data);
    await this.revoke(proofPointObject);
  }

  /**
   * Revoke a Proof Point identified by its full data. You must control the account that originally issued the Proof Point. The account must be sufficiently funded to execute the revoke transaction.
   * @param proofPointObject The full Proof Point data as returned in the @param proofPointObject parameter of the {@link ProofPointIssueResult} when the Proof Point was issued.
   */
  async revoke(proofPointObject: ProofPoint): Promise<void> {
    if (proofPointObject.proof.type !== PROOF_TYPE) {
      throw new Error("Unsupported proof type");
    }

    if (!this.isSameRegistry(proofPointObject)) {
      throw new Error("Registry mismatch");
    }

    const issuerAddress = await this._resolveIssuerToEthereumAddress(
      proofPointObject.issuer
    );
    if (issuerAddress === null) {
      throw new Error(`Cannot resolve issuer: ${proofPointObject.issuer}`);
    }

    const { hash } = await this._canonicalizeAndStoreObject(proofPointObject);
    const proofPointIdBytes = web3.utils.asciiToHex(hash);
    await this._registry.methods
      .revoke(proofPointIdBytes)
      .send({ from: issuerAddress, gas: GAS_LIMIT });
  }

  /**
   * Validate a Proof Point identified by its ID. This does not involve a blockchain transaction.
   * @param proofPointId The ID of the Proof Point to revoke.
   * @returns true if the Proof Point passes all validation checks, otherwise false.
   */
  async validateById(proofPointId: string): Promise<ProofPointValidateResult> {
    const storedData = await this._storage.get(proofPointId);
    const proofPointObject = JSON.parse(storedData.data);
    return this.validate(proofPointObject);
  }

  /**
   * Validate a Proof Point identified by its full data. This does not involve a blockchain transaction.
   * @param proofPointObject The full Proof Point data as returned in the @param proofPointObject parameter of the {@link ProofPointIssueResult} when the Proof Point was issued.
   * @returns a {@link ProofPointValidateResult} representing the validity of the Proof Point.
   */
  async validate(
    proofPointObject: ProofPoint
  ): Promise<ProofPointValidateResult> {
    if (proofPointObject.proof.type !== PROOF_TYPE) {
      return {
        isValid: false,
        statusCode: ProofPointStatus.BadlyFormed,
        statusMessage: "The Proof Point uses an unsupported proof type.",
      };
    }

    if (typeof proofPointObject.validFrom !== "undefined") {
      const validFromDate = Date.parse(proofPointObject.validFrom);
      if (validFromDate > Date.now()) {
        return {
          isValid: false,
          statusCode: ProofPointStatus.Pending,
          statusMessage: "The Proof Point will become valid at a later date.",
        };
      }
    }

    if (typeof proofPointObject.validUntil !== "undefined") {
      const validUntilDate = Date.parse(proofPointObject.validUntil);
      if (validUntilDate < Date.now()) {
        return {
          isValid: false,
          statusCode: ProofPointStatus.Expired,
          statusMessage: "The valid-until date of the Proof Point has passed.",
        };
      }
    }

    if (!this.isSameRegistry(proofPointObject)) {
      return {
        isValid: false,
        statusCode: ProofPointStatus.NonTrustedRegistry,
        statusMessage:
          "The Proof Point is issued using a registry that is not trusted in this context.",
      };
    }

    const issuerAddress = await this._resolveIssuerToEthereumAddress(
      proofPointObject.issuer
    );

    if (issuerAddress === null) {
      return {
        isValid: false,
        statusCode: ProofPointStatus.UnknownIssuer,
        statusMessage: `The issuer '${proofPointObject.issuer}' could not be resolved to an Ethereum address.`,
      };
    }

    const { hash } = await this._canonicalizeAndStoreObject(proofPointObject);
    const proofPointIdBytes = web3.utils.asciiToHex(hash);

    const isValid = await this._registry.methods
      .validate(issuerAddress, proofPointIdBytes)
      .call();

    if (isValid) {
      return {
        isValid: true,
        statusCode: ProofPointStatus.Valid,
        statusMessage: null,
      };
    } else {
      return {
        isValid: false,
        statusCode: ProofPointStatus.NotFound,
        statusMessage: "The Proof Point has been revoked or was never issued.",
      };
    }
  }

  /**
   * Fetch the Proof Point document identified by its ID.
   * @param proofPointId The ID of the Proof Point document to fetch.
   */
  async getById(proofPointId: string): Promise<ProofPoint> {
    const storedData = await this._storage.get(proofPointId);
    const proofPointObject = JSON.parse(storedData.data);
    return proofPointObject;
  }

  /**
   * Get a list of the IDs of all Proof Points ever issued or committed
   * to this registry.
   */
  async getAll(): Promise<Array<string>> {
    const publishEvents = await this._registry.getPastEvents("Published", {
      fromBlock: 0,
      toBlock: "latest",
    });

    const nonUniqueIds = publishEvents.map((ev) =>
      Web3.utils.hexToAscii(ev.returnValues._claim)
    );
    const unqiueIds = nonUniqueIds.filter((v, i, a) => a.indexOf(v) === i);
    return unqiueIds;
  }

  /**
   * Gets a list of all events related to the given Proof Point, identified by its ID.
   * @param proofPointId the ID of the Proof Point.
   * @returns a list of {@link ProofPointEvent} describing the history of the Proof Point.
   */
  async getHistoryById(proofPointId: string): Promise<Array<ProofPointEvent>> {
    const version = await this._getVersion();
    const history = await this._getHistory(
      version,
      this._registry.options.address,
      proofPointId
    );
    return history.sort((a, b) => a.blockNumber - b.blockNumber);
  }

  private _eventNameToEventType(eventName: string): ProofPointEventType {
    if (eventName === "Issued") return ProofPointEventType.Issued;
    if (eventName === "Committed") return ProofPointEventType.Committed;
    if (eventName === "Revoked") return ProofPointEventType.Revoked;
    throw new Error(`Invalid Proof Point event name: ${eventName}`);
  }

  private async _getVersion(): Promise<number> {
    try {
      const version = await this._registry.methods.getVersion().call();
      return version;
    } catch (e) {
      // version 1 does not have the getVersion method.
      return 1;
    }
  }

  private async _getHistory(
    version: number,
    logicContractAddress: string,
    proofPointId: string
  ): Promise<ProofPointEvent[]> {
    // Prepare and store proxy object for the logic contract
    const registry = new this._web3.eth.Contract(
      ProofPointRegistryAbi[version].abi as any,
      logicContractAddress,
      { data: ProofPointRegistryAbi[version].bytecode }
    );

    const eventsRaw = await registry.getPastEvents("allEvents", {
      // TODO filter doesn't work for some reason
      // filter: {_claim: Web3.utils.keccak256(proofPointId) },
      fromBlock: 0,
      toBlock: "latest",
    });

    const events = eventsRaw
      // TODO remove this client side filter once filter bug is fixed
      .filter(
        (ev) => ev.returnValues._claim === Web3.utils.keccak256(proofPointId)
      )
      .filter((ev) => ev.event !== "Published")
      .map((ev) => {
        return {
          blockNumber: ev.blockNumber,
          type: this._eventNameToEventType(ev.event),
          issuer: ev.returnValues._issuer,
          proofPointId: proofPointId,
          transactionHash: ev.transactionHash,
        };
      });

    if (version === 1) {
      return events;
    }

    const priorAddress = await registry.methods.getPrevious().call();

    const priorEvents = await this._getHistory(
      version - 1,
      priorAddress,
      proofPointId
    );

    events.push(...priorEvents);

    return events;
  }

  private async _issue(
    type: string,
    issuer: string,
    content: unknown,
    issueFunction: any,
    validFromDate: Date | null = null,
    validUntilDate: Date | null = null
  ): Promise<ProofPointIssueResult> {
    const issuerAddress = await this._resolveIssuerToEthereumAddress(issuer);
    if (issuerAddress === null) {
      throw new Error(`Cannot resolve issuer: ${issuer}`);
    }

    const proofPointObject = this.buildJson(
      type,
      issuer,
      content,
      validFromDate,
      validUntilDate
    );

    const {
      hash,
      canonicalisedObject,
    } = await this._canonicalizeAndStoreObject(proofPointObject);
    const proofPointIdBytes = web3.utils.asciiToHex(hash);

    const transactionReceipt = await issueFunction(proofPointIdBytes).send({
      from: issuerAddress,
      gas: GAS_LIMIT,
    });

    return {
      proofPointId: hash,
      transactionHash: transactionReceipt.transactionHash,
      proofPointObject: canonicalisedObject,
    };
  }

  private buildJson(
    type: string,
    issuer: string,
    content: unknown,
    validFromDate: Date | null = null,
    validUntilDate: Date | null = null
  ): ProofPoint {
    const proofPoint: ProofPoint = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://provenance.org/ontology/ptf/v2",
      ],
      type: ["VerifiableCredential", type],
      issuer: issuer,
      credentialSubject: content,
      proof: {
        type: PROOF_TYPE,
        registryRoot: this._address,
        proofPurpose: "assertionMethod",
        verificationMethod: issuer,
      },
      validFrom: undefined,
      validUntil: undefined,
    };

    if (validFromDate !== null) {
      proofPoint.validFrom = localISOdt.localISOdt(validFromDate);
    }

    if (validUntilDate !== null) {
      proofPoint.validUntil = localISOdt.localISOdt(validUntilDate);
    }

    return proofPoint;
  }

  private isSameRegistry(proofPoint: ProofPoint): boolean {
    return (
      proofPoint.proof.registryRoot.toLowerCase() ===
      this._address.toLowerCase()
    );
  }

  /**
   * Did to url. Translate a did:web identifier to the URL at which the corresponding DID document can be found
   * according to spec at https://w3c-ccg.github.io/did-method-web/#crud-operation-definitions
   * @param did a valid did:web ID string
   * @returns an https URL string representing the location of the corresponding DID document
   */
  private didToUrl(did: string): string {
    const parts = did.split(":");
    if (parts.length === 3) {
      // did:web:<x>
      const hostname = decodeURIComponent(parts[2]);
      return `https://${hostname}/.well-known/did.json`;
    } else {
      // did:web:<a>:<b>:...:<z>
      const hostname = decodeURIComponent(parts[2]);
      const path = parts.slice(3).join("/");
      return `https://${hostname}/${path}/did.json`;
    }
  }

  private async _resolveIssuerToEthereumAddress(
    issuer: string
  ): Promise<string> {
    if (/^0x[a-fA-F0-9]{40}$/.test(issuer)) {
      return web3.utils.toChecksumAddress(issuer);
    }

    if (/^did\:web\:.+$/.test(issuer)) {
      const didDocumentUri = this.didToUrl(issuer);
      try {
        const body = await this._httpClient.fetch(didDocumentUri);
        const didDocument = JSON.parse(body);
        if (
          didDocument["@context"] !== "https://w3id.org/did/v1" ||
          didDocument.id !== issuer ||
          typeof didDocument.publicKey === "undefined" ||
          didDocument.publicKey[0].type !== "Secp256k1VerificationKey2018" ||
          didDocument.publicKey[0].owner !== issuer ||
          !/^0x[a-fA-F0-9]{40}$/.test(didDocument.publicKey[0].ethereumAddress)
        ) {
          // DID document is invalid or unsupported
          return null;
        }

        return web3.utils.toChecksumAddress(
          didDocument.publicKey[0].ethereumAddress
        );
      } catch (e) {
        // DID document could not be fetched
        return null;
      }
    }

    // Unsupported issuer format
    return null;
  }

  private static removeEmptyFields(obj: any): any {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === "object")
        ProofPointRegistry.removeEmptyFields(obj[key]);
      // eslint-disable-next-line no-param-reassign
      else if (obj[key] === undefined) delete obj[key];
    });
    return obj;
  }

  private async _canonicalizeAndStoreObject(
    dataObject: any
  ): Promise<{ hash: string; canonicalisedObject: any }> {
    // TODO enforce SHA-256 hash alg
    // TODO add method to compute hash without storing

    // Necessary because JSON.canonicalize produces invalid JSON if there
    // are fields with value undefined
    const cleanedDataObject = ProofPointRegistry.removeEmptyFields(dataObject);

    const dataStr = canonicalizeJson(cleanedDataObject);
    const storageResult = await this._storage.add(dataStr);

    return {
      hash: storageResult.digest,
      canonicalisedObject: JSON.parse(dataStr),
    };
  }
}

export {
  Web3,
  HttpClient,
  ProofPoint,
  ProofPointIssueResult,
  ProofPointRegistry,
  ProofPointValidateResult,
  ProofPointStatus,
  ProofPointEventType,
  ProofPointEvent,
};
