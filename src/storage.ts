export interface StorageProviderAddResult {
  digest: string;
}

export interface StorageProviderGetResult {
  data: string;
}

export interface StorageProvider {
  add(msg: string): Promise<StorageProviderAddResult>;
  get(digest: string): Promise<StorageProviderGetResult>;
}
