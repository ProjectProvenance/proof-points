class FakeHttpClient {
  constructor(url, body) {
    this._url = url;
    this._body = body;
  }

  async fetch(url) {
    if (url != this._url) {
      throw new Error("unexpected URL fetched");
    }
    return Promise.resolve(this._body);
  }
}

module.exports = FakeHttpClient;
