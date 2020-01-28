const IPFS = require('ipfs-mini');

class IPFSProvider {
  constructor(options) {
    this.name = 'IPFSProvider';
    this.ipfs = new IPFS(options);
  }

  async add(msg) {
    const result = await this.ipfs.add(Buffer.from(msg));
    return ({ digest: result });
  }

  async get(digest) {
    const result = await this.ipfs.cat(digest);
    return ({ data: result });
  }
}

module.exports = IPFSProvider;
