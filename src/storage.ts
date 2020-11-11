import IPFS from "ipfs-mini";

interface StorageProviderAddResult {
  digest: string;
}

interface StorageProviderGetResult {
  data: string;
}

interface StorageProvider {
  add(msg: string): Promise<StorageProviderAddResult>;
  get(digest: string): Promise<StorageProviderGetResult>;
}

interface IpfsStorageProviderSettings {
  host: string;
  port: number;
  protocol?: string;
}

class IpfsStorageProvider {
  ipfs: any;

  constructor(settings: IpfsStorageProviderSettings) {
    this.ipfs = new IPFS(settings);
  }

  async add(msg: string): Promise<StorageProviderAddResult> {
    const result: string = await this.ipfs.add(Buffer.from(msg));
    return { digest: result };
  }

  async get(digest: string): Promise<StorageProviderGetResult> {
    const result = await this.ipfs.cat(digest);
    return { data: result };
  }
}

export { StorageProvider, IpfsStorageProvider, IpfsStorageProviderSettings };
