import { StorageProvider } from "../storage";
import { ProofPointId, ProofPointIdType } from "../proofPointId";
import { ProofPoint } from "../proofPoint";

/**
 * Ipfs proof point resolver
 * A @ProofPointResolver capable of handling @ProofPointId of type Ipfs
 */
export class IpfsProofPointResolver {
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
