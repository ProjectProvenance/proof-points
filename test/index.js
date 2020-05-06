const { expect } = require('chai');
const { Provenance } = require('../dist/index');

contract('Index', () => {
  contract('Setup storage', () => {
    it('default storage provider', async() => {
      const p = new Provenance({ web3: web3 });
      await p.init();
      expect(p.storage.provider).to.not.be.null;
    });

    it('should have get and add methods on storage', async() => {
      const p = new Provenance({ web3: web3 });
      await p.init();
      expect(typeof p.storage.add).to.equal('function');
      expect(typeof p.storage.get).to.equal('function');
    });
  });
});
