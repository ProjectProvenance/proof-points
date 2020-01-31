const { expect } = require('chai');
const P = require('../src');
const FakeStorageProvider = require('./fixtures/FakeStorageProvider')

contract('ProofPoints', () => {
  var storageProvider;
  var p;
  var type;
  var content;
  var admin;

  beforeEach(async() => {
    storageProvider = new FakeStorageProvider();
    p = new P({ web3: web3, storageProvider: storageProvider });
    await p.init();
    const accounts = await web3.eth.getAccounts();
    [admin] = accounts;
    const eternalStorage = await p
      .contracts
      .ProofPointRegistryStorage1
      .deploy()
      .send({ from: admin, gas: 1000000 });
    p.contracts.proofPointStorageAddress = eternalStorage.options.address;

    p.contracts.ProofPointRegistryInstance = await p
      .contracts
      .ProofPointRegistry
      .deploy({ arguments: [p.contracts.proofPointStorageAddress] })
      .send({ from: admin, gas: 1000000 });

    await eternalStorage
      .methods
      .setOwner(p.contracts.ProofPointRegistryInstance.options.address)
      .send({ from: admin, gas: 1000000 });

    type = 'http://open.provenance.org/ontology/ptf/v1/TestProofPoint';
    content = {
      id: 'https://provenance.org/subject1',
      some: ['pp', 'data'],
      more: ['pp', 'data']
    };
  })

  it('should issue a valid pp', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.be.true;
  });

  it('should commit a valid pp', async() => {
    const results = await p.proofPoint.commit(type, admin, content);
    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.be.true;
  });

  it('should return tx hash and pp hash and a pp object', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    expect(results.proofPointHash).to.exist;
    expect(results.transactionHash).to.exist;
    expect(results.proofPointObject).to.exist;
  });

  it('should revoke a pp', async() => {
    const result = await p.proofPoint.issue(type, admin, content);
    await p.proofPoint.revoke(result.proofPointObject);
    const isValidProofPoint = await p.proofPoint.validate(result.proofPointObject);
    expect(isValidProofPoint).to.be.false;
  });

  it('should validate a valid pp by hash', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    const isValidProofPoint = await p.proofPoint.validateByHash(results.proofPointHash);
    expect(isValidProofPoint).to.be.true;
  });

  it('should revoke a valid pp by hash', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    await p.proofPoint.revokeByHash(results.proofPointHash);
    const isValidProofPoint = await p.proofPoint.validateByHash(results.proofPointHash);
    expect(isValidProofPoint).to.be.false;
  });

  it('should treat pp data canonically', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    const equivalentProofPointObject = results.proofPointObject;
    equivalentProofPointObject.credentialSubject = {
      id: 'https://provenance.org/subject1',
      more: ['pp', 'data'],
      some: ['pp', 'data']
    }
    const isValidProofPoint = await p.proofPoint.validate(equivalentProofPointObject);
    expect(isValidProofPoint).to.be.true;
  });

  it('pp should be invalid before issuanceDate', async() => {
    const results = await p.proofPoint.issue(
      type,
      admin,
      content,
      Date.now() + 1000000
    );
    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.be.false;
  });

  it('pp should be invalid after expirationDate', async() => {
    const results = await p.proofPoint.issue(
      type,
      admin,
      content,
      null,
      Date.now() - 1000000
    );
    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.be.false;
  });
});
