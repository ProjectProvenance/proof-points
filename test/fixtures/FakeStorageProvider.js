const md5 = require("blueimp-md5");

class FakeStorageProvider {
  constructor() {
    this.name = "FakeStorageProvider";
    this.store = {};
  }

  add(msg) {
    const digest = md5(msg);
    this.store[digest] = msg;
    return Promise.resolve({ digest });
  }

  get(digest) {
    return Promise.resolve({ data: this.store[digest] });
  }
}

module.exports = FakeStorageProvider;
