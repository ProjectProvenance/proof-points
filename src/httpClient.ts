import fetch from "isomorphic-fetch";

interface HttpClient {
  fetch(url: string): Promise<string>;
}

class RealHttpClient {
  async fetch(url: string): Promise<string> {
    const response = await fetch(url);
    const body = await response.text();
    return body;
  }
}

class CachingHttpClient {
  private _cache: Map<string, string> = new Map();
  private _client: RealHttpClient; // = new RealHttpClient();

  constructor(client: HttpClient) {
    this._client = client;
  }

  async fetch(url: string): Promise<string> {
    if (this._cache.has(url)) {
      return this._cache.get(url);
    } else {
      const response = await this._client.fetch(url);
      this._cache.set(url, response);
      return response;
    }
  }
}

export { HttpClient, RealHttpClient, CachingHttpClient };
