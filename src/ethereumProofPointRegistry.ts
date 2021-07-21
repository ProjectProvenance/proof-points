import { Contract, ethers } from "ethers";
import { EthereumProofPointEvent, EthereumProofPointEventType } from ".";
import ProofPointRegistryAbiV1 from "../build/ProofPointRegistry_v2.json";
import ProofPointRegistryAbiV2 from "../build/ProofPointRegistry_v2.json";
import { EthereumAddress } from "./ethereumAddress";
import { EthereumTransactionHash } from "./ethereumTransactionHash";
import { ProofPoint } from "./proofPoint";
import { ProofPointId } from "./proofPointId";

export const ProofPointRegistryAbi = [
  undefined,
  ProofPointRegistryAbiV1,
  ProofPointRegistryAbiV2,
];
export const PROOF_POINT_REGISTRY_VERSION = 2;
export const ETHEREUM_PROOF_TYPE =
  "https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1";

// Javascript wrapper around the Proof Point Registry Ethereum contract.
export class EthereumProofPointRegistry {
  private _rootAddress: EthereumAddress;
  private _address: EthereumAddress;
  private _registry: ethers.Contract;
  private _provider: ethers.providers.JsonRpcProvider;

  /**
   * Creates an instance of Proof Point registry for interacting with a pre-existing deployment of the registry contracts.
   * @param rootAddress the Ethereum address of the deployed eternal storage contract.
   * @param address the Ethereum address of the current deployed logic contract.
   * @param provider an ethers.providers.JsonRpcProvider to use for interacting with the blockchain.
   */
  constructor(
    rootAddress: EthereumAddress,
    address: EthereumAddress,
    provider: ethers.providers.JsonRpcProvider
  ) {
    this._rootAddress = rootAddress;
    this._address = address;
    this._provider = provider;

    this._registry = new ethers.Contract(
      this._address.toString(),
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi,
      provider
    );
  }

  /**
   * Determines whether the given proof point can be authenticated using this registry.
   * @param proofPoint the proof point to check.
   * @returns true if the given proof point can be authenticated using this registry.
   */
  public isSameRegistry(proofPoint: ProofPoint): boolean {
    return (
      proofPoint.proof.registryRoot.toLowerCase() ===
      this._rootAddress.toString().toLowerCase()
    );
  }

  /**
   * Issues the given proof point in this registry from the given issuer. You must control the issuer account.
   * @param id the ID of the proof point to issue.
   * @param issuerAddress the account that is issuing the proof point.
   * @returns the Ethereum transaction hash of the issuing transaction.
   */
  public async issue(
    id: ProofPointId,
    issuerAddress: EthereumAddress
  ): Promise<EthereumTransactionHash> {
    return this._issue(id, issuerAddress, (c: ethers.Contract, d: any) =>
      c.issue(d)
    );
  }

  /**
   * Commits the given proof point in this registry from the given issuer. You must control the issuer account.
   * @param id the ID of the proof point to commit.
   * @param issuerAddress the account that is committing the proof point.
   * @returns the Ethereum transaction hash of the committing transaction.
   */
  public async commit(
    id: ProofPointId,
    issuerAddress: EthereumAddress
  ): Promise<EthereumTransactionHash> {
    return this._issue(id, issuerAddress, (c: ethers.Contract, d: any) =>
      c.commit(d)
    );
  }

  /**
   * Revokes the given proof point from this registry using the given issuer. You must control the issuer account.
   * The issuer must be the original issuer of the proof point.
   * @param id the ID of the proof point to revoke.
   * @param issuerAddress the account that is issuing the proof point.
   * @returns the Ethereum transaction hash of the revoking transaction.
   */
  public async revoke(
    id: ProofPointId,
    revokerAddress: EthereumAddress
  ): Promise<EthereumTransactionHash> {
    const proofPointIdBytes = this._proofPointIdToBytes(id);
    const signer = this._provider.getSigner(revokerAddress.toString());
    const registryWithSigner = this._registry.connect(signer);

    const transactionReceipt = await registryWithSigner.revoke(
      proofPointIdBytes
    );

    return EthereumTransactionHash.parse(transactionReceipt.hash);
  }

  /**
   * Determines whether the identified proof point is authentic, meaning is has been
   * issued and not revoked by the given issuer, or has been committed by the given issuer.
   * @param id The ID of proof point to check.
   * @param issuerAddress The address of the expected issuer.
   * @returns true if the proof point is issued and not revoked, or committed by the given issuer.
   */
  public async isAuthentic(
    id: ProofPointId,
    issuerAddress: EthereumAddress
  ): Promise<boolean> {
    const proofPointIdBytes = this._proofPointIdToBytes(id);
    return await this._registry.validate(
      issuerAddress.toString(),
      proofPointIdBytes
    );
  }

  /**
   * Gets a list of all events related to the given Proof Point, identified by its ID.
   * @param proofPointId the ID of the Proof Point.
   * @returns a list of {@link EthereumProofPointEvent} describing the history of the Proof Point.
   */
  public async getHistory(
    proofPointId: ProofPointId
  ): Promise<Array<EthereumProofPointEvent>> {
    const version = await this._getVersion();
    const history = await this._getHistory(
      version,
      this._registry.address,
      proofPointId
    );
    return history.sort((a, b) => a.blockNumber - b.blockNumber);
  }

  /**
   * Get a list of the IDs of all Proof Points ever issued or committed
   * to this registry.
   */
  public async getAll(): Promise<Array<ProofPointId>> {
    const filter = {
      address: this._registry.address,
      topics: [ethers.utils.id("Published(bytes)")],
      fromBlock: 0,
      toBlock: "latest",
    };
    const publishEvents = await this._provider.getLogs(filter);

    const nonUniqueIds = publishEvents.map((ev) => {
      return this._logDataToProofPointId(ev.data);
    });
    const uniqueIds = nonUniqueIds.filter(
      (val, idx, arr) =>
        arr.findIndex((id) => id.toString() === val.toString()) === idx
    );
    return uniqueIds;
  }

  private _logDataToProofPointId(data: string): ProofPointId {
    // For some reason there are 64 bytes before the actual log data, plus the 0x
    // and the log data is zero right-padded to a multiple of 32 bytes
    const idStrHex = data.substr(130, 92);
    const idStr = ethers.utils.toUtf8String("0x" + idStrHex);
    return ProofPointId.parse(idStr);
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

  private _topicToEventType(topic: string): EthereumProofPointEventType {
    if (topic === ethers.utils.id("Issued(address,bytes)"))
      return EthereumProofPointEventType.Issued;
    if (topic === ethers.utils.id("Committed(address,bytes)"))
      return EthereumProofPointEventType.Committed;
    if (topic === ethers.utils.id("Revoked(address,bytes)"))
      return EthereumProofPointEventType.Revoked;
    throw new Error(`Invalid Proof Point event type topic: ${topic}`);
  }

  private async _getHistory(
    version: number,
    logicContractAddress: string,
    proofPointId: ProofPointId
  ): Promise<EthereumProofPointEvent[]> {
    // Prepare and store proxy object for the logic contract
    const registry = new ethers.Contract(
      logicContractAddress,
      ProofPointRegistryAbi[version].abi,
      this._provider
    );

    const allEvents: EthereumProofPointEvent[] = [];

    allEvents.push(
      ...(await this._getEventsByFilter(
        registry,
        registry.filters.Issued.bind(registry.filters),
        proofPointId
      ))
    );
    allEvents.push(
      ...(await this._getEventsByFilter(
        registry,
        registry.filters.Committed.bind(registry.filters),
        proofPointId
      ))
    );
    allEvents.push(
      ...(await this._getEventsByFilter(
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

  private async _getEventsByFilter(
    registry: Contract,
    filterFactory: any,
    proofPointId: ProofPointId
  ): Promise<EthereumProofPointEvent[]> {
    const issuerFilter: any = null;

    const filter = filterFactory(
      issuerFilter,
      this._proofPointIdToBytes(proofPointId)
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

  private _proofPointIdToBytes(id: ProofPointId): string {
    const idBytes = ethers.utils.toUtf8Bytes(id.toString());
    const idBytesHex = ethers.utils.hexlify(idBytes);
    return idBytesHex;
  }

  private async _issue(
    id: ProofPointId,
    issuerAddress: EthereumAddress,
    issueFunction: any
  ): Promise<EthereumTransactionHash> {
    const proofPointIdBytes = this._proofPointIdToBytes(id);
    const signer = this._provider.getSigner(issuerAddress.toString());
    const registryWithSigner = this._registry.connect(signer);

    const transactionReceipt = await issueFunction(
      registryWithSigner,
      proofPointIdBytes
    );

    return EthereumTransactionHash.parse(transactionReceipt.hash);
  }
}
