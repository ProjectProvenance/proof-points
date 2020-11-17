import { Contract, ethers } from "ethers";
import canonicalizeJson = require("canonicalize");
import localISOdt = require("local-iso-dt");

import ProofPointRegistryAbiV1 from "../build/ProofPointRegistry_v2.json";
import ProofPointRegistryAbiV2 from "../build/ProofPointRegistry_v2.json";
import { StorageProvider, IpfsStorageProvider } from "./storage";
import { ProofPointStatus } from "./proofPointStatus";
import { ProofPointIssueResult } from "./proofPointIssueResult";
import { ProofPoint } from "./proofPoint";
import { ProofPointEventType } from "./proofPointEventType";
import {
  ProofPointEvent,
  ProofPointId,
  EthereumAddress,
  EthereumTransactionHash,
} from "./proofPointEvent";
import { HttpClient, RealHttpClient } from "./httpClient";
import { ProofPointValidateResult } from "./proofPointValidateResult";

const ProofPointRegistryAbi = [
  undefined,
  ProofPointRegistryAbiV1,
  ProofPointRegistryAbiV2,
];
const PROOF_POINT_REGISTRY_VERSION = 2;
const PROOF_TYPE =
  "https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1";

class ProofPointRegistry {
  private _rootAddress: EthereumAddress;
  private _address: EthereumAddress;
  private _registry: ethers.Contract;
  private _storage: StorageProvider;
  private _httpClient: HttpClient;
  private _provider: ethers.providers.JsonRpcProvider;

  /**
   * Creates an instance of Proof Point registry for interacting with a pre-existing deployment of the registry contracts.
   * @param rootAddress the Ethereum address of the deployed eternal storage contract.
   * @param address the Ethereum address of the current deployed logic contract.
   * @param provider an ethers.providers.JsonRpcProvider to use for interacting with the blockchain.
   * @param storage a {@link StorageProvider} to use for storing/retrieving off-chain data or null to use the default implementation.
   * @param httpClient a {@link HttpClient} to use for fetching DID documents in order to support did:web issuers or null to use the default implementation.
   */
  constructor(
    rootAddress: EthereumAddress,
    address: EthereumAddress,
    provider: ethers.providers.JsonRpcProvider,
    storage: StorageProvider | null = null,
    httpClient: HttpClient | null = null
  ) {
    this._rootAddress = rootAddress;
    this._address = address;
    this._provider = provider;
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

    this._registry = new ethers.Contract(
      this._address.toString(),
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi,
      provider
    );
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
      (c: ethers.Contract, d: any) => c.issue(d),
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
      (c: ethers.Contract, d: any) => c.commit(d),
      validFromDate,
      validUntilDate
    );
  }

  /**
   * Revoke a Proof Point identified by it's ID. You must control the account that originally issued the Proof Point. The account must be sufficiently funded to execute the revoke transaction.
   * @param proofPointId The ID of the Proof Point to revoke. This is the value returned in the @param proofPointId field of the {@link ProofPointIssueResult} when the Proof Point was issued.
   */
  async revokeById(proofPointId: ProofPointId): Promise<void> {
    const storedData = await this._storage.get(proofPointId.toString());
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

    const { id } = await this._canonicalizeAndStoreObject(proofPointObject);
    const proofPointIdBytes = this.proofPointIdToBytes(id);
    const signer = this._provider.getSigner(issuerAddress.toString());
    const registryWithSigner = this._registry.connect(signer);
    await registryWithSigner.revoke(proofPointIdBytes);
  }

  /**
   * Validate a Proof Point identified by its ID. This does not involve a blockchain transaction.
   * @param proofPointId The ID of the Proof Point to revoke.
   * @returns true if the Proof Point passes all validation checks, otherwise false.
   */
  async validateById(
    proofPointId: ProofPointId
  ): Promise<ProofPointValidateResult> {
    const storedData = await this._storage.get(proofPointId.toString());
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

    const { id } = await this._canonicalizeAndStoreObject(proofPointObject);
    const proofPointIdBytes = this.proofPointIdToBytes(id);

    const isValid = await this._registry.validate(
      issuerAddress.toString(),
      proofPointIdBytes
    );

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
  async getById(proofPointId: ProofPointId): Promise<ProofPoint> {
    const storedData = await this._storage.get(proofPointId.toString());
    const proofPointObject = JSON.parse(storedData.data);
    return proofPointObject;
  }

  /**
   * Get a list of the IDs of all Proof Points ever issued or committed
   * to this registry.
   */
  async getAll(): Promise<Array<ProofPointId>> {
    const filter = {
      address: this._registry.address,
      topics: [ethers.utils.id("Published(bytes)")],
      fromBlock: 0,
      toBlock: "latest",
    };
    const publishEvents = await this._provider.getLogs(filter);

    const nonUniqueIds = publishEvents.map((ev) => {
      return this.logDataToProofPointId(ev.data);
    });
    const uniqueIds = nonUniqueIds.filter(
      (val, idx, arr) =>
        arr.findIndex((id) => id.toString() === val.toString()) === idx
    );
    return uniqueIds;
  }

  /**
   * Gets a list of all events related to the given Proof Point, identified by its ID.
   * @param proofPointId the ID of the Proof Point.
   * @returns a list of {@link ProofPointEvent} describing the history of the Proof Point.
   */
  async getHistoryById(
    proofPointId: ProofPointId
  ): Promise<Array<ProofPointEvent>> {
    const version = await this._getVersion();
    const history = await this._getHistory(
      version,
      this._registry.address,
      proofPointId
    );
    return history.sort((a, b) => a.blockNumber - b.blockNumber);
  }

  private proofPointIdToBytes(id: ProofPointId): string {
    const idBytes = ethers.utils.toUtf8Bytes(id.toString());
    const idBytesHex = ethers.utils.hexlify(idBytes);
    return idBytesHex;
  }

  private logDataToProofPointId(data: string): ProofPointId {
    // For some reason there are 64 bytes before the actual log data, plus the 0x
    // and the log data is zero right-padded to a multiple of 32 bytes
    const idStrHex = data.substr(130, 92);
    const idStr = ethers.utils.toUtf8String("0x" + idStrHex);
    return ProofPointId.parse(idStr);
  }

  private _topicToEventType(topic: string): ProofPointEventType {
    if (topic === ethers.utils.id("Issued(address,bytes)"))
      return ProofPointEventType.Issued;
    if (topic === ethers.utils.id("Committed(address,bytes)"))
      return ProofPointEventType.Committed;
    if (topic === ethers.utils.id("Revoked(address,bytes)"))
      return ProofPointEventType.Revoked;
    throw new Error(`Invalid Proof Point event type topic: ${topic}`);
  }

  private async _getHistory(
    version: number,
    logicContractAddress: string,
    proofPointId: ProofPointId
  ): Promise<ProofPointEvent[]> {
    // Prepare and store proxy object for the logic contract
    const registry = new ethers.Contract(
      logicContractAddress,
      ProofPointRegistryAbi[version].abi,
      this._provider
    );

    const allEvents: ProofPointEvent[] = [];

    allEvents.push(
      ...(await this.getEventsByFilter(
        registry,
        registry.filters.Issued.bind(registry.filters),
        proofPointId
      ))
    );
    allEvents.push(
      ...(await this.getEventsByFilter(
        registry,
        registry.filters.Committed.bind(registry.filters),
        proofPointId
      ))
    );
    allEvents.push(
      ...(await this.getEventsByFilter(
        registry,
        registry.filters.Revoked.bind(registry.filters),
        proofPointId
      ))
    );

    if (version === 1) {
      return allEvents;
    }

    const priorAddress = await registry.getPrevious();

    const priorEvents = await this._getHistory(
      version - 1,
      priorAddress,
      proofPointId
    );

    allEvents.push(...priorEvents);

    return allEvents;
  }

  private async getEventsByFilter(
    registry: Contract,
    filterFactory: any,
    proofPointId: ProofPointId
  ): Promise<ProofPointEvent[]> {
    const issuerFilter: any = null;

    const filter = filterFactory(
      issuerFilter,
      this.proofPointIdToBytes(proofPointId)
    );

    const eventsRaw = await registry.queryFilter(filter);
    return eventsRaw.map((ev) => {
      return {
        blockNumber: ev.blockNumber,
        type: this._topicToEventType(ev.topics[0]),
        issuer: EthereumAddress.parse(ethers.utils.hexStripZeros(ev.topics[1])),
        proofPointId: proofPointId,
        transactionHash: EthereumTransactionHash.parse(ev.transactionHash),
      };
    });
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

    const { id, canonicalisedObject } = await this._canonicalizeAndStoreObject(
      proofPointObject
    );

    const proofPointIdBytes = this.proofPointIdToBytes(id);
    const signer = this._provider.getSigner(issuerAddress.toString());
    const connectedContract = this._registry.connect(signer);

    const transactionReceipt = await issueFunction(
      connectedContract,
      proofPointIdBytes
    );

    return {
      proofPointId: id,
      transactionHash: EthereumTransactionHash.parse(transactionReceipt.hash),
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
        registryRoot: this._rootAddress.toString(),
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
      this._rootAddress.toString().toLowerCase()
    );
  }

  /**
   * Did to url. Translate a did:web identifier to the URL at which the corresponding DID document can be found
   * according to spec at https://w3c-ccg.github.io/did-method-web/#crud-operation-definitions.
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
  ): Promise<EthereumAddress> {
    if (/^0x[a-fA-F0-9]{40}$/.test(issuer)) {
      return EthereumAddress.parse(issuer);
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

        return EthereumAddress.parse(didDocument.publicKey[0].ethereumAddress);
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
  ): Promise<{ id: ProofPointId; canonicalisedObject: any }> {
    // TODO enforce SHA-256 hash alg
    // TODO add method to compute hash without storing

    // Necessary because JSON.canonicalize produces invalid JSON if there
    // are fields with value undefined
    const cleanedDataObject = ProofPointRegistry.removeEmptyFields(dataObject);

    const dataStr = canonicalizeJson(cleanedDataObject);
    const storageResult = await this._storage.add(dataStr);

    return {
      id: ProofPointId.parse(storageResult.digest),
      canonicalisedObject: JSON.parse(dataStr),
    };
  }

  private async _getVersion(): Promise<number> {
    try {
      const version = await this._registry.getVersion();
      return version;
    } catch (e) {
      // version 1 does not have the getVersion method.
      return 1;
    }
  }
}

export {
  ProofPointRegistry,
  PROOF_POINT_REGISTRY_VERSION,
  ProofPointRegistryAbi,
};
