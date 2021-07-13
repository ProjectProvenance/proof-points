import { HttpClient } from "./httpClient";
import { ProofPoint } from "./proofPoint";
import { ProofPointId, ProofPointIdType } from "./proofPointId";
import { StorageProvider } from "./storage";

export interface ProofPointResolver {
  resolve(id: ProofPointId): Promise<ProofPoint>;
}

export class GeneralProofPointResolver {
  private _ipfsResolver: IpfsProofPointResolver;
  private _webResolver: WebProofPointResolver;

  public constructor(httpClient: HttpClient, ipfs: StorageProvider) {
    this._ipfsResolver = new IpfsProofPointResolver(ipfs);
    this._webResolver = new WebProofPointResolver(httpClient);
  }

  resolve(id: ProofPointId): Promise<ProofPoint> {
    switch (id.getType()) {
      case ProofPointIdType.Ipfs:
        return this._ipfsResolver.resolve(id);
      case ProofPointIdType.Web:
        return this._webResolver.resolve(id);
      default:
        throw `Unexpected ID type: ${id.getType()}`;
    }
  }
}

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

class WebProofPointResolver {
  private _httpClient: HttpClient;

  public constructor(httpClient: HttpClient) {
    this._httpClient = httpClient;
  }

  public async resolve(id: ProofPointId): Promise<ProofPoint> {
    if (id.getType() !== ProofPointIdType.Web) {
      throw `Unresolvable ID type: ${id.getType()}`;
    }

    const url = id.toString();
    const storedData = await this._httpClient.fetch(url);
    const proofPoint = JSON.parse(storedData);
    return proofPoint;
  }
}
