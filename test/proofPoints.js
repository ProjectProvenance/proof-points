const { expect } = require('chai');
const { Provenance, ProofPointStatus } = require('../dist/src/index');
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

    await p.proofPoint.issue(type, admin, content);
    // no exception
  });

  it('should issue a valid pp', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    const validity = await p.proofPoint.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('should commit a valid pp', async() => {
    const results = await p.proofPoint.commit(type, admin, content);
    const validity = await p.proofPoint.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
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
    const validity = await p.proofPoint.validate(result.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it('should validate a valid pp by hash', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    const validity = await p.proofPoint.validateByHash(results.proofPointHash);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('should revoke a valid pp by hash', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    await p.proofPoint.revokeByHash(results.proofPointHash);
    const validity = await p.proofPoint.validateByHash(results.proofPointHash);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it('should treat pp data canonically', async() => {
    const results = await p.proofPoint.issue(type, admin, content);
    const equivalentProofPointObject = results.proofPointObject;
    equivalentProofPointObject.credentialSubject = {
      id: 'https://provenance.org/subject1',
      more: ['pp', 'data'],
      some: ['pp', 'data']
    }
    const validity = await p.proofPoint.validate(equivalentProofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('pp should be invalid before issuanceDate', async() => {
    const results = await p.proofPoint.issue(
      type,
      admin,
      content,
      Date.now() + 1000000
    );
    const validity = await p.proofPoint.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Pending);
  });

  it('pp should be invalid after expirationDate', async() => {
    const results = await p.proofPoint.issue(
      type,
      admin,
      content,
      null,
      Date.now() - 1000000
    );
    const validity = await p.proofPoint.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Expired);
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

    const validity = await p2.proofPoint.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NonTrustedRegistry);
  });

  it('should return the correct proof point document when getByHash is called', async() => {
    const results = await p.proofPoint.issue(
      type,
      admin,
      content
    );

    const fetched = await p.proofPoint.getByHash(results.proofPointHash);

    expect(JSON.stringify(fetched)).to.eq(JSON.stringify(results.proofPointObject));
  });
});
