/* eslint-disable class-methods-use-this, no-unused-vars  */
class FakeBrokenStorageProvider {
  constructor() {
    this.name = "FakeBrokenStorageProvider";
  }

  add() {
    return Promise.reject(new Error("storage is down"));
  }

  get() {
    return Promise.reject(new Error("storage is down"));
  }
}

module.exports = FakeBrokenStorageProvider;
/* eslint-enable */
