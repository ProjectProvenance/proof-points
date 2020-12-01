// import fetch from "node-fetch";
// import FormData from "form-data";

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
  settings: IpfsStorageProviderSettings;

  constructor(settings: IpfsStorageProviderSettings) {
    this.settings = settings;
  }

  async add(msg: string): Promise<StorageProviderAddResult> {
    const url = `${this.settings.protocol || "http"}://${this.settings.host}:${
      this.settings.port
    }/api/v0/add?pin=true&hash=sha2-256`;

    const formData = new FormData();
    formData.append("path", msg);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const x = await response.json();

    return { digest: x.Hash };
  }

  async get(digest: string): Promise<StorageProviderGetResult> {
    const url = `${this.settings.protocol || "http"}://${this.settings.host}:${
      this.settings.port
    }/api/v0/cat?arg=${digest}`;

    console.log(`fetch: ${url}`);

    const response = await fetch(url, { method: "POST" });

    const data = await response.text();

    return { data };
  }
}

export { StorageProvider, IpfsStorageProvider, IpfsStorageProviderSettings };
