import { ProofPointIssueResult } from "./proofPointIssueResult";
import { ethers } from "ethers";
import { EthereumAddress, ProofPointId } from "./proofPointEvent";
import { ProofPoint } from "./proofPoint";
import { IpfsStorageProvider, IpfsStorageProviderSettings, StorageProvider } from "./storage";
import canonicalizeJson from "canonicalize";
import localISOdt = require("local-iso-dt");
import { EthereumAddressResolver } from "./ethereumAddressResolver";
import {
  EthereumProofPointRegistry,
  ETHEREUM_PROOF_TYPE,
} from "./ethereumProofPointRegistry";
import { EthereumProofPointRegistryRoot } from "./ethereumProofPointRegistryRoot";
import { RealHttpClient } from "./httpClient";

export interface ProofPointIssuer {
  issue(
    type: string,
    issuer: string,
    content: unknown,
    validFromDate: Date | null,
    validUntilDate: Date | null,
    signer: ethers.Signer | null
  ): Promise<ProofPointIssueResult>;

  commit(
    type: string,
    issuerAddress: string,
    content: string,
    validFromDate: Date | null,
    validUntilDate: Date | null,
    signer: ethers.Signer | null
  ): Promise<ProofPointIssueResult>;

  revoke(
    proofPointId: ProofPointId,
    signer: ethers.Signer | null
  ): Promise<void>;
}

export class EthereumProofPointIssuer {
  private _rootAddress: EthereumAddress;
  private _registry: EthereumProofPointRegistry;
  private _storage: StorageProvider;
  private _ethereumAddressResolver: EthereumAddressResolver;

  /**
   * Creates an instance of Proof Point registry for interacting with a pre-existing deployment of the registry contracts.
   * @param rootAddress the Ethereum address of the deployed eternal storage contract.
   * @param storage a {@link StorageProvider} to use for storing/retrieving off-chain data or null to use the default implementation.
   */
  constructor(
    rootAddress: EthereumAddress,
    ethereumAddressResolver: EthereumAddressResolver,
    storage: StorageProvider,
    registry: EthereumProofPointRegistry
  ) {
    this._rootAddress = rootAddress;
    this._ethereumAddressResolver = ethereumAddressResolver;
    this._storage = storage;
    this._registry = registry;
  }

  public static async production(
    rootAddress: EthereumAddress,
    ipfsSettings: IpfsStorageProviderSettings,
    ethereumProvider: ethers.providers.JsonRpcProvider
  ): Promise<EthereumProofPointIssuer> {
    const registryRoot = new EthereumProofPointRegistryRoot(
      rootAddress,
      ethereumProvider
    );
    const registry = await registryRoot.getRegistry();
    const httpClient = new RealHttpClient();
    const ethereumAddressResolver = new EthereumAddressResolver(httpClient);
    const storageProvider = new IpfsStorageProvider(ipfsSettings);
    return new EthereumProofPointIssuer(
      rootAddress,
      ethereumAddressResolver,
      storageProvider,
      registry
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
      (
        c: EthereumProofPointRegistry,
        id: ProofPointId,
        issuer: EthereumAddress
      ) => c.issue(id, issuer),
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
    issuer: string,
    content: unknown,
    validFromDate: Date | null = null,
    validUntilDate: Date | null = null
  ): Promise<ProofPointIssueResult> {
    return this._issue(
      type,
      issuer,
      content,
      (
        c: EthereumProofPointRegistry,
        id: ProofPointId,
        issuer: EthereumAddress
      ) => c.commit(id, issuer),
      validFromDate,
      validUntilDate
    );
  }

  /**
   * Revoke a Proof Point identified by it's ID. You must control the account that originally issued the Proof Point. The account must be sufficiently funded to execute the revoke transaction.
   * @param proofPointId The ID of the Proof Point to revoke. This is the value returned in the @param proofPointId field of the {@link ProofPointIssueResult} when the Proof Point was issued.
   */
  async revoke(proofPointId: ProofPointId): Promise<void> {
    const storedData = await this._storage.get(proofPointId.toString());
    const proofPointObject = JSON.parse(storedData.data);

    if (proofPointObject.proof.type !== ETHEREUM_PROOF_TYPE) {
      throw new Error("Unsupported proof type");
    }

    if (!this._registry.isSameRegistry(proofPointObject)) {
      throw new Error("Registry mismatch");
    }

    const issuerAddress = await this._ethereumAddressResolver.resolve(
      proofPointObject.issuer
    );
    if (issuerAddress === null) {
      throw new Error(`Cannot resolve issuer: ${proofPointObject.issuer}`);
    }

    const { id } = await this._canonicalizeAndStoreObject(proofPointObject);
    await this._registry.revoke(id, issuerAddress);
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
        type: ETHEREUM_PROOF_TYPE,
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

  private async _issue(
    type: string,
    issuer: string,
    content: unknown,
    issueFunction: any,
    validFromDate: Date | null = null,
    validUntilDate: Date | null = null
  ): Promise<ProofPointIssueResult> {
    const issuerAddress = await this._ethereumAddressResolver.resolve(issuer);
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

    const transactionHash = await issueFunction(
      this._registry,
      id,
      issuerAddress
    );

    return {
      proofPointId: id,
      transactionHash,
      proofPointObject: canonicalisedObject,
    };
  }

  private async _canonicalizeAndStoreObject(
    dataObject: any
  ): Promise<{ id: ProofPointId; canonicalisedObject: any }> {
    // TODO add method to compute hash without storing

    // Necessary because JSON.canonicalize produces invalid JSON if there
    // are fields with value undefined
    const cleanedDataObject =
      EthereumProofPointIssuer.removeEmptyFields(dataObject);

    const dataStr = canonicalizeJson(cleanedDataObject);
    const storageResult = await this._storage.add(dataStr);

    return {
      id: ProofPointId.parse(storageResult.digest),
      canonicalisedObject: JSON.parse(dataStr),
    };
  }

  private static removeEmptyFields(obj: any): any {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === "object")
        EthereumProofPointIssuer.removeEmptyFields(obj[key]);
      // eslint-disable-next-line no-param-reassign
      else if (obj[key] === undefined) delete obj[key];
    });
    return obj;
  }
}
