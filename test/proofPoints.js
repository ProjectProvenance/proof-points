const { expect } = require('chai');
const { Provenance, ProofPointStatus, ProofPointEventType } = require('../dist/src/index');
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
    // issue a pp
    const results = await p.proofPoint.issue(
      type,
      admin,
      content
    );

    // deploy a second registry
    const proofPointStorageAddress2 = await deployProofPointRegistry(web3, storageProvider, admin);

    // set up an Provenance API that trusts only the second registry
    const p2 = new Provenance({
      web3: web3,
      storageProvider: storageProvider,
      proofPointStorageAddress: proofPointStorageAddress2
    });
    await p2.init();

    // use that API to validate the pp
    const validity = await p2.proofPoint.validate(results.proofPointObject);

    // should be invalid, since it specifies a non trusted registry
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

  it('should return a list of all issued and committed proof points when getAll is called', async() => {
    // issue a pp
    const result1 = await p.proofPoint.issue("type1", admin, content );
    // revoke it
    await p.proofPoint.revoke(result1.proofPointObject);
    // commit another pp
    const result2 = await p.proofPoint.commit("type2", admin, content );

    // get all pps ever published
    const list = await p.proofPoint.getAll();

    // should include the issued and revoked one and the committed one
    expect(list.length).to.eq(2);
    expect(list[0]).to.eq(result1.proofPointHash);
    expect(list[1]).to.eq(result2.proofPointHash);
  });

  it('should return a list of all related events when getHistoryByHash is called', async() => {
    // issue a pp
    const result = await p.proofPoint.issue(type, admin, content );
    // issue another one
    await p.proofPoint.issue("type2", admin, content );
    // revoke the first one
    await p.proofPoint.revoke(result.proofPointObject);
    // commit the first one
    await p.proofPoint.commit(type, admin, content );

    // get history of first one
    const history = await p.proofPoint.getHistoryByHash(result.proofPointHash);

    // should be Issue, Revoke, Commit and not include the other pp
    expect(history.length).to.eq(3);
    expect(history[0].type).to.eq(ProofPointEventType.Issued);
    expect(history[0].issuer).to.eq(admin);
    expect(history[1].type).to.eq(ProofPointEventType.Revoked);
    expect(history[1].issuer).to.eq(admin);
    expect(history[2].type).to.eq(ProofPointEventType.Committed);
    expect(history[2].issuer).to.eq(admin);
  });
});
