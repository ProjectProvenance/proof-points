class FakeHttpClient {
  constructor(responses) {
    this._responses = responses;
  }

  async fetch(url) {
    if (!url in this._responses) {
      throw new Error("unexpected URL fetched");
    }
    return Promise.resolve(this._responses[url]);
  }
}

module.exports = FakeHttpClient;
