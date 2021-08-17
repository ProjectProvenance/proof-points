import { ProofPoint } from "./proofPoint";
import { ProofPointId, ProofPointIdType } from "./proofPointId";
import { StorageProvider } from "./storage";

/**
 * Proof point resolver
 * An object capable of resolving a @ProofPointId to a @ProofPoint
 */
export interface ProofPointResolver {
  /**
   * Resolve the given @PRoofPointId
   * @param id The ID of the proof point to resolve
   * @returns The @ProofPoint corresponding to the given ID.
   */
  resolve(id: ProofPointId): Promise<ProofPoint>;
}

/**
 * General proof point resolver
 * A @ProofPointResolver capable of handling all types of @ProofPointId
 */
export class GeneralProofPointResolver {
  private _ipfsResolver: IpfsProofPointResolver;

  public constructor(ipfs: StorageProvider) {
    this._ipfsResolver = new IpfsProofPointResolver(ipfs);
  }

  resolve(id: ProofPointId): Promise<ProofPoint> {
    switch (id.getType()) {
      case ProofPointIdType.Ipfs:
        return this._ipfsResolver.resolve(id);
      default:
        throw `Unexpected ID type: ${id.getType()}`;
    }
  }
}

/**
 * Ipfs proof point resolver
 * A @ProofPointResolver capable of handling @ProofPointId of type Ipfs
 */
class IpfsProofPointResolver {
  private _storage: StorageProvider;

  public constructor(storage: StorageProvider) {
    this._storage = storage;
  }

  public async resolve(id: ProofPointId): Promise<ProofPoint> {
    if (id.getType() !== ProofPointIdType.Ipfs) {
      throw `Unresolvable ID type: ${id.getType()}`;
    }

    const ipfsAddress = id.toString();
    const storedData = await this._storage.get(ipfsAddress);
    const proofPoint = JSON.parse(storedData.data);
    return proofPoint;
  }
}
