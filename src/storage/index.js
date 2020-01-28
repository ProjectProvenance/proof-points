const providers = require('./providers');

class Storage {
  constructor(provider) {
    this.provider = provider;
  }

  add(msg) {
    return this.provider.add(msg);
  }

  get(digest) {
    return this.provider.get(digest);
  }

  addObject(object) {
    return this.add(JSON.stringify(object));
  }
}

Storage.providers = providers;

module.exports = Storage;
