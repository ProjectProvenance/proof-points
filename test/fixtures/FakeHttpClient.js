class FakeHttpClient {
  constructor(responses) {
    this._responses = responses;
    this._requests = {};
  }

  async fetch(url) {
    if (!url in this._responses) {
      throw new Error("unexpected URL fetched");
    }
    if (!this._requests[url]) {
      this._requests[url] = 0;
    }
    this._requests[url] += 1;
    return Promise.resolve(this._responses[url]);
  }

  requestCount(url) {
    if (!this._requests[url]) {
      return 0;
    }
    return this._requests[url];
  }
}

module.exports = FakeHttpClient;
