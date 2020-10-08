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

export { HttpClient, RealHttpClient };
