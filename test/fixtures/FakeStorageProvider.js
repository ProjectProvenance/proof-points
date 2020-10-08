const multihashing = require("multihashing");
const multibase = require("multibase");
const multihashes = require("multihashes");

class FakeStorageProvider {
  constructor() {
    this.name = "FakeStorageProvider";
    this.store = {};
  }

  add(msg) {
    const buf = Buffer.from(msg);
    const hashBytes = multihashing(buf, "sha2-256");
    const hash = multihashes.toB58String(hashBytes);
    this.store[hash] = msg;
    return Promise.resolve({ digest: hash });
  }

  get(id) {
    return Promise.resolve({ data: this.store[id] });
  }
}

module.exports = FakeStorageProvider;
