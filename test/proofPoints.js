const { expect } = require('chai');
const { ProofPointRegistry, ProofPointStatus, ProofPointEventType } = require('../dist/src/index');
const FakeStorageProvider = require('./fixtures/FakeStorageProvider');
const ProofPointRegistryV1Abi = require('../build/contracts/ProofPointRegistry.json');
const ProofPointRegistryStorage1Abi = require('../build/contracts/ProofPointRegistryStorage1.json');

contract('ProofPoints', () => {
  let storageProvider;
  let subject;
  let type;
  let content;
  let admin;

  beforeEach(async() => {
    storageProvider = new FakeStorageProvider();

    const accounts = await web3.eth.getAccounts();
    [admin] = accounts;

    subject = await ProofPointRegistry.deploy(admin, web3, storageProvider);

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
    subject = new ProofPointRegistry(subject.getAddress(), web3, null);
    await subject.init();
    await subject.issue(type, admin, content);
    // no exception
  });

  it('should issue a valid pp', async() => {
    const results = await subject.issue(type, admin, content);
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('should commit a valid pp', async() => {
    const results = await subject.commit(type, admin, content);
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('should return tx hash and pp hash and a pp object', async() => {
    const results = await subject.issue(type, admin, content);
    expect(results.proofPointHash).to.exist;
    expect(results.transactionHash).to.exist;
    expect(results.proofPointObject).to.exist;
  });

  it('should revoke a pp', async() => {
    const result = await subject.issue(type, admin, content);
    await subject.revoke(result.proofPointObject);
    const validity = await subject.validate(result.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it('should validate a valid pp by hash', async() => {
    const results = await subject.issue(type, admin, content);
    const validity = await subject.validateByHash(results.proofPointHash);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('should revoke a valid pp by hash', async() => {
    const results = await subject.issue(type, admin, content);
    await subject.revokeByHash(results.proofPointHash);
    const validity = await subject.validateByHash(results.proofPointHash);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it('should treat pp data canonically', async() => {
    const results = await subject.issue(type, admin, content);
    const equivalentProofPointObject = results.proofPointObject;
    equivalentProofPointObject.credentialSubject = {
      id: 'https://provenance.org/subject1',
      more: ['pp', 'data'],
      some: ['pp', 'data']
    }
    const validity = await subject.validate(equivalentProofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it('pp should be invalid before issuanceDate', async() => {
    const results = await subject.issue(
      type,
      admin,
      content,
      Date.now() + 1000000
    );
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Pending);
  });

  it('pp should be invalid after expirationDate', async() => {
    const results = await subject.issue(
      type,
      admin,
      content,
      null,
      Date.now() - 1000000
    );
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Expired);
  });

  it('pp should be invalid if issued to a different registry', async() => {
    // issue a pp
    const results = await subject.issue(
      type,
      admin,
      content
    );

    // deploy a second registry and use an API that trusts only the new registry
    const altRegistry = await ProofPointRegistry.deploy(admin, web3, storageProvider);

    // use that API to validate the pp
    const validity = await altRegistry.validate(results.proofPointObject);

    // should be invalid, since it specifies a non trusted registry
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NonTrustedRegistry);
  });

  it('should return the correct Proof Point document when getByHash is called', async() => {
    const results = await subject.issue(
      type,
      admin,
      content
    );

    const fetched = await subject.getByHash(results.proofPointHash);

    expect(JSON.stringify(fetched)).to.eq(JSON.stringify(results.proofPointObject));
  });

  it('should return a list of all issued and committed Proof Points when getAll is called', async() => {
    // issue a pp
    const result1 = await subject.issue("type1", admin, content );
    // revoke it
    await subject.revoke(result1.proofPointObject);
    // commit another pp
    const result2 = await subject.commit("type2", admin, content );

    // get all pps ever published
    const list = await subject.getAll();

    // should include the issued and revoked one and the committed one
    expect(list.length).to.eq(2);
    expect(list[0]).to.eq(result1.proofPointHash);
    expect(list[1]).to.eq(result2.proofPointHash);
  });

  it('should return a list of all related events when getHistoryByHash is called', async() => {
    // issue a pp
    const result = await subject.issue(type, admin, content );
    // issue another one
    await subject.issue("type2", admin, content );
    // revoke the first one
    await subject.revoke(result.proofPointObject);
    // commit the first one
    await subject.commit(type, admin, content );

    // get history of first one
    const history = await subject.getHistoryByHash(result.proofPointHash);

    // should be Issue, Revoke, Commit and not include the other pp
    expect(history.length).to.eq(3);
    expect(history[0].type).to.eq(ProofPointEventType.Issued);
    expect(history[0].issuer).to.eq(admin);
    expect(history[1].type).to.eq(ProofPointEventType.Revoked);
    expect(history[1].issuer).to.eq(admin);
    expect(history[2].type).to.eq(ProofPointEventType.Committed);
    expect(history[2].issuer).to.eq(admin);
  });

  it('should not upgrade a latest version repo', async() => {
    const canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.false;
    try{
      await subject.upgrade()
    } catch(e){
      expect(e.message).to.eq("Cannot upgrade Proof Point registry: Already at or above current version.");
    }
  });

  it('upgrade happy path', async() => {
    // deploy v1 registry

    // deploy eternal storage contract
    const eternalStorageContract = new web3.eth.Contract(ProofPointRegistryStorage1Abi.abi);
    const eternalStorage = await eternalStorageContract
        .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
        .send({from: admin, gas: 1000000});

    // deploy logic contract pointing to eternal storage
    const logicContract = new web3.eth.Contract(ProofPointRegistryV1Abi.abi);
    const logic = await logicContract
        .deploy({ data: ProofPointRegistryV1Abi.bytecode, arguments: [eternalStorage.options.address] })
        .send({from: admin, gas: 1000000});

    // set logic contract as owner of eternal storage
    await eternalStorage
        .methods
        .setOwner(logic.options.address)
        .send({from: admin, gas: 1000000});

    // construct and return a ProofPointRegistry object for the newly deployed setup
    subject = new ProofPointRegistry(eternalStorage.options.address, web3, storageProvider);
    await subject.init();

    let canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.true;

    await subject.upgrade();

    canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.false;
  });
});
