const { expect } = require('chai');
const { Provenance } = require('../dist/src/index');
const FakeStorageProvider = require('./fixtures/FakeStorageProvider');

async function deployProofPointRegistry(web3, storageProvider, admin) {
  p = new Provenance({ web3: web3, storageProvider: storageProvider });
  await p.init();
  const eternalStorage = await p
    .contracts
    .ProofPointRegistryStorage1
    .deploy()
    .send({ from: admin, gas: 1000000 });

  const proofPointRegistry = await p
    .contracts
    .ProofPointRegistry
    .deploy({ arguments: [eternalStorage.options.address] })
    .send({ from: admin, gas: 1000000 });

  await eternalStorage
    .methods
    .setOwner(proofPointRegistry.options.address)
    .send({ from: admin, gas: 1000000 });

  return eternalStorage.options.address;
}

contract('ProofPoints', () => {
  let storageProvider;
  let p;
  let type;
  let content;
  let admin;

  beforeEach(async() => {
    storageProvider = new FakeStorageProvider();

    const accounts = await web3.eth.getAccounts();
    [admin] = accounts;

    const proofPointStorageAddress = await deployProofPointRegistry(web3, storageProvider, admin);

    p = new Provenance({
      web3: web3,
      storageProvider: storageProvider,
      proofPointStorageAddress: proofPointStorageAddress
    });
    await p.init();

    type = 'http://open.provenance.org/ontology/ptf/v1/TestProofPoint';
    content = {
      id: 'https://provenance.org/subject1',
      some: ['pp', 'data'],
      more: ['pp', 'data']
    };
  })

  it('should use provenance IPFS for storage if not specified', async() => {

    const accounts = await web3.eth.getAccounts();
    [admin] = accounts;

    const proofPointStorageAddress = await deployProofPointRegistry(web3, storageProvider, admin);

    p = new Provenance({
      web3: web3,
      // no storage provider specified
      proofPointStorageAddress: proofPointStorageAddress
    });
    await p.init();

    const results = await p.proofPoint.issue(type, admin, content);
    expect(results.proofPointHash).to.eq('QmZmQKduqFm5JvPp8wvQGDQXJBCm8YfpUqKyGVFaenJ7cR');
  });

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

  it('pp should be invalid if issued to a different registry', async() => {
    const results = await p.proofPoint.issue(
      type,
      admin,
      content
    );

    const proofPointStorageAddress2 = await deployProofPointRegistry(web3, storageProvider, admin);
    const p2 = new Provenance({
      web3: web3,
      storageProvider: storageProvider,
      proofPointStorageAddress: proofPointStorageAddress2
    });
    await p2.init();

    const isValidProofPoint = await p2.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.be.false;
  });
});
