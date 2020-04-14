const { expect } = require('chai');
const didJWT = require('did-jwt');
const Provenance = require('../src');
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

async function buildWellKnownDidResource(acc, domain) {
  const payload = {
    sub: 'did:ethr:' + acc.address,
    iss: 'did:ethr:' + acc.address,
    vc: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://identity.foundation/.well-known/contexts/did-configuration-v0.0.jsonld'
      ],
      issuer: 'did:ethr:' + acc.address,
      type: [
        'VerifiableCredential',
        'DomainLinkageCredential'
      ],
      credentialSubject: {
        id: 'did:ethr:' + acc.address,
        domain: domain
      }
    }
  }

  const signer = didJWT.SimpleSigner(acc.privateKey.substr(2));

  const jwt = await didJWT.createJWT(
    payload,
    {
      alg: 'ES256K-R',
      issuer: 'did:ethr:' + acc.address,
      signer
    }
  );

  const resource = {
    '@context': 'https://identity.foundation/.well-known/contexts/did-configuration-v0.0.jsonld',
    entries: [jwt]
  }

  return resource
}

async function createAndFundAccount() {
  const acc = await web3.eth.accounts.create();
  web3.eth.accounts.wallet.add(acc);
  await web3.eth.sendTransaction(
    { from: (await web3.eth.getAccounts())[0], to: acc.address, value: 400000000000000 }
  );
  return acc;
}

contract('ProofPoints', () => {
  var storageProvider;
  var p;
  var type;
  var content;
  var admin;

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

  it('non domain issuer is treated as ethereum address', async() => {
    p.proofPoint.fetchWellKnownDidResource = function() {
      throw new Error('well known resource should not be fetched for ethereum address issuer');
    }

    const results = await p.proofPoint.issue(
      type,
      admin,
      content
    );

    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.eq(true);
  });

  it('domain issuer happy path', async() => {
    // the resource at the well know path for the given domain is a valid DID config linking to acc
    const acc = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function(domain) {
      return buildWellKnownDidResource(acc, domain);
    }

    const results = await p.proofPoint.issue(
      type,
      'example.com',
      content
    );

    expect(results.proofPointObject.issuer).to.eq('example.com');
    expect(results.proofPointObject.proof.verificationMethod).to.eq('example.com');

    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.eq(true);
  });

  it('if issuer is domain and well known resource is not valid DID configuration then issue fails', async() => {
    p.proofPoint.fetchWellKnownDidResource = function() {
      return '{}';
    }

    try {
      await p.proofPoint.issue(
        type,
        'example.com',
        content
      );
    } catch (e) {
      // OK
      return;
    }

    throw new Error('issue should have failed');
  });

  it('if issuer is domain and well known resource cannot be fetched then issue fails', async() => {
    p.proofPoint.fetchWellKnownDidResource = function() {
      throw new Error('bang!')
    }

    try {
      await p.proofPoint.issue(
        type,
        'example.com',
        content
      );
    } catch (e) {
      // OK
      return;
    }

    throw new Error('issue should have failed');
  });

  it('if issuer is domain and well known resource is not valid DID configuration then validate fails', async() => {
    const acc = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function(domain) {
      return buildWellKnownDidResource(acc, domain);
    }

    const results = await p.proofPoint.issue(
      type,
      'example.com',
      content
    );

    p.proofPoint.fetchWellKnownDidResource = function() {
      return '{}'
    }

    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.eq(false);
  });

  it('if issuer is domain and well known resource cannot be fetched then validate fails', async() => {
    const acc = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function(domain) {
      return buildWellKnownDidResource(acc, domain);
    }

    const results = await p.proofPoint.issue(
      type,
      'example.com',
      content
    );

    p.proofPoint.fetchWellKnownDidResource = function() {
      throw new Error('bang!')
    }

    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.eq(false);
  });

  it('if issuer is domain and well known resource is valid but points to a different account then validate fails', async() => {
    const acc1 = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function(domain) {
      return buildWellKnownDidResource(acc1, domain);
    }

    const results = await p.proofPoint.issue(
      type,
      'example.com',
      content
    );

    const acc2 = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function(domain) {
      return buildWellKnownDidResource(acc2, domain);
    }

    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.eq(false);
  });

  it('if issuer is domain and well known resource is otherwise valid but names a different domain then issue fails', async() => {
    const acc = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function() {
      return buildWellKnownDidResource(acc, 'another-domain.com');
    }

    try {
      await p.proofPoint.issue(
        type,
        'example.com',
        content
      );
    } catch (e) {
      return;
    }

    throw new Error('issue should have failed');
  });

  it('if issuer is domain and well known resource is otherwise valid but names a different domain then validate fails', async() => {
    const acc = await createAndFundAccount();
    p.proofPoint.fetchWellKnownDidResource = function(domain) {
      return buildWellKnownDidResource(acc, domain);
    }

    const results = await p.proofPoint.issue(
      type,
      'example.com',
      content
    );

    p.proofPoint.fetchWellKnownDidResource = function() {
      return buildWellKnownDidResource(acc, 'another-domain.com');
    }

    const isValidProofPoint = await p.proofPoint.validate(results.proofPointObject);
    expect(isValidProofPoint).to.eq(false);
  });
});
