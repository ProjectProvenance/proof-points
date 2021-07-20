import fetch from "isomorphic-fetch";

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
    // Note: we enforce SHA-256 hash algorithm which is part of the Proof Point specification
    const url = `${this.settings.protocol || "http"}://${this.settings.host}:${
      this.settings.port
    }/api/v0/add?pin=true&hash=sha2-256`;

    const formDataBoundary = "2758264728364323843263";
    const response = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${formDataBoundary}`,
      },
      body: `--${formDataBoundary}\nContent-Disposition: form-data; name="path"\n\n${msg}\n--${formDataBoundary}--`,
    });

    const data = await response.json();

    return { digest: data.Hash };
  }

  async get(digest: string): Promise<StorageProviderGetResult> {
    const url = `${this.settings.protocol || "http"}://${this.settings.host}:${
      this.settings.port
    }/api/v0/cat?arg=${digest}`;

    const response = await fetch(url, { method: "POST" });

    const data = await response.text();

    return { data };
  }
}

export { StorageProvider, IpfsStorageProvider, IpfsStorageProviderSettings };
