const { expect } = require("chai");
const {
  ProofPointRegistry,
  ProofPointStatus,
  ProofPointEventType,
} = require("../dist/src/index");
const FakeStorageProvider = require("./fixtures/FakeStorageProvider");
const FakeHttpClient = require("./fixtures/FakeHttpClient");

const ProofPointRegistryV1Abi = require("../build/contracts/ProofPointRegistry.json");
const ProofPointRegistryStorage1Abi = require("../build/contracts/ProofPointRegistryStorage1.json");

contract("ProofPoints", () => {
  let storageProvider;
  let subject;
  let type;
  let content;
  let admin;
  let httpClient;

  beforeEach(async () => {
    storageProvider = new FakeStorageProvider();

    const accounts = await web3.eth.getAccounts();
    [admin] = accounts;

    httpClient = new FakeHttpClient(
      "https://example.com/.well-known/did.json",
      `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin}"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`
    );

    subject = await ProofPointRegistry.deploy(
      admin,
      web3,
      storageProvider,
      httpClient
    );

    type = "http://open.provenance.org/ontology/ptf/v1/TestProofPoint";
    content = {
      id: "https://provenance.org/subject1",
      some: ["pp", "data"],
      more: ["pp", "data"],
    };
  });

  it("should use provenance IPFS for storage if not specified", async () => {
    const accounts = await web3.eth.getAccounts();
    [admin] = accounts;
    subject = new ProofPointRegistry(subject.getAddress(), web3, null);
    await subject.init();
    await subject.issue(type, admin, content);
    // no exception
  });

  it("should issue a valid pp", async () => {
    const results = await subject.issue(type, admin, content);
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("should commit a valid pp", async () => {
    const results = await subject.commit(type, admin, content);
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("should return tx hash and pp ID and a pp object", async () => {
    const results = await subject.issue(type, admin, content);
    expect(results.proofPointId).to.exist;
    expect(results.transactionHash).to.exist;
    expect(results.proofPointObject).to.exist;
  });

  it("should revoke a pp", async () => {
    const result = await subject.issue(type, admin, content);
    await subject.revoke(result.proofPointObject);
    const validity = await subject.validate(result.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it("should validate a valid pp by ID", async () => {
    const results = await subject.issue(type, admin, content);
    const validity = await subject.validateById(results.proofPointId);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("should revoke a valid pp by ID", async () => {
    const results = await subject.issue(type, admin, content);
    await subject.revokeById(results.proofPointId);
    const validity = await subject.validateById(results.proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it("should treat pp data canonically", async () => {
    const results = await subject.issue(type, admin, content);
    const equivalentProofPointObject = results.proofPointObject;
    equivalentProofPointObject.credentialSubject = {
      id: "https://provenance.org/subject1",
      more: ["pp", "data"],
      some: ["pp", "data"],
    };
    const validity = await subject.validate(equivalentProofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("pp should be invalid before issuanceDate", async () => {
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

  it("pp should be invalid after expirationDate", async () => {
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

  it("pp should be invalid if issued to a different registry", async () => {
    // issue a pp
    const results = await subject.issue(type, admin, content);

    // deploy a second registry and use an API that trusts only the new registry
    const altRegistry = await ProofPointRegistry.deploy(
      admin,
      web3,
      storageProvider
    );

    // use that API to validate the pp
    const validity = await altRegistry.validate(results.proofPointObject);

    // should be invalid, since it specifies a non trusted registry
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NonTrustedRegistry);
  });

  it("should return the correct Proof Point document when getById is called", async () => {
    const results = await subject.issue(type, admin, content);

    const fetched = await subject.getById(results.proofPointId);

    expect(JSON.stringify(fetched)).to.eq(
      JSON.stringify(results.proofPointObject)
    );
  });

  it("should return a list of all issued and committed Proof Points when getAll is called", async () => {
    // issue a pp
    const result1 = await subject.issue("type1", admin, content);
    // revoke it
    await subject.revoke(result1.proofPointObject);
    // commit another pp
    const result2 = await subject.commit("type2", admin, content);

    // get all pps ever published
    const list = await subject.getAll();

    // should include the issued and revoked one and the committed one
    expect(list.length).to.eq(2);
    expect(list[0]).to.eq(result1.proofPointId);
    expect(list[1]).to.eq(result2.proofPointId);
  });

  it("should return a list of all related events when getHistoryById is called", async () => {
    // issue a pp
    const result = await subject.issue(type, admin, content);
    // issue another one
    await subject.issue("type2", admin, content);
    // revoke the first one
    await subject.revoke(result.proofPointObject);
    // commit the first one
    await subject.commit(type, admin, content);

    // get history of first one
    const history = await subject.getHistoryById(result.proofPointId);

    // should be Issue, Revoke, Commit and not include the other pp
    expect(history.length).to.eq(3);
    expect(history[0].type).to.eq(ProofPointEventType.Issued);
    expect(history[0].issuer).to.eq(admin);
    expect(history[0].transactionHash).to.not.be.null;
    expect(history[1].type).to.eq(ProofPointEventType.Revoked);
    expect(history[1].issuer).to.eq(admin);
    expect(history[1].transactionHash).to.not.be.null;
    expect(history[2].type).to.eq(ProofPointEventType.Committed);
    expect(history[2].issuer).to.eq(admin);
    expect(history[2].transactionHash).to.not.be.null;
  });

  it("should not upgrade a latest version repo", async () => {
    const canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.false;
    try {
      await subject.upgrade();
    } catch (e) {
      expect(e.message).to.eq(
        "Cannot upgrade Proof Point registry: Already at or above current version."
      );
    }
  });

  it("upgrade happy path", async () => {
    // deploy v1 registry

    // deploy eternal storage contract
    const eternalStorageContract = new web3.eth.Contract(
      ProofPointRegistryStorage1Abi.abi
    );
    const eternalStorage = await eternalStorageContract
      .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
      .send({ from: admin, gas: 1000000 });

    // deploy logic contract pointing to eternal storage
    const logicContract = new web3.eth.Contract(ProofPointRegistryV1Abi.abi);
    const logic = await logicContract
      .deploy({
        data: ProofPointRegistryV1Abi.bytecode,
        arguments: [eternalStorage.options.address],
      })
      .send({ from: admin, gas: 1000000 });

    // set logic contract as owner of eternal storage
    await eternalStorage.methods
      .setOwner(logic.options.address)
      .send({ from: admin, gas: 1000000 });

    // construct and return a ProofPointRegistry object for the newly deployed setup
    subject = new ProofPointRegistry(
      eternalStorage.options.address,
      web3,
      storageProvider
    );
    await subject.init();

    let canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.true;

    await subject.upgrade();

    canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.false;
  });

  it("history still available after upgrade", async () => {
    // deploy v1 registry

    // deploy eternal storage contract
    const eternalStorageContract = new web3.eth.Contract(
      ProofPointRegistryStorage1Abi.abi
    );
    const eternalStorage = await eternalStorageContract
      .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
      .send({ from: admin, gas: 1000000 });

    // deploy logic contract pointing to eternal storage
    const logicContract = new web3.eth.Contract(ProofPointRegistryV1Abi.abi);
    const logic = await logicContract
      .deploy({
        data: ProofPointRegistryV1Abi.bytecode,
        arguments: [eternalStorage.options.address],
      })
      .send({ from: admin, gas: 1000000 });

    // set logic contract as owner of eternal storage
    await eternalStorage.methods
      .setOwner(logic.options.address)
      .send({ from: admin, gas: 1000000 });

    // construct and return a ProofPointRegistry object for the newly deployed setup
    subject = new ProofPointRegistry(
      eternalStorage.options.address,
      web3,
      storageProvider
    );
    await subject.init();

    // create some history activity
    const { proofPointId } = await subject.issue(type, admin, content);
    await subject.revokeById(proofPointId);

    // upgrade the registry contract
    await subject.upgrade();

    // get the history of the pp issued before the upgrade
    const history = await subject.getHistoryById(proofPointId);

    // events from before the upgrade should be present
    expect(history.length).to.eq(2);
  });

  it("did:web issuer happy path", async () => {
    const result = await subject.issue(type, "did:web:example.com", content);
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com");
    const { isValid } = await subject.validate(result.proofPointObject);
    expect(isValid).to.be.true;
  });

  it("did:web issuer wrong context", async () => {
    httpClient._body = `{
      "@context": "wrongContext",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin}"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`;

    try {
      await subject.issue(type, "did:web:example.com", content);
    } catch (_) {
      return;
    }

    expect(false);
  });

  it("did:web issuer wrong id", async () => {
    httpClient._body = `{
      "@context": "https://w3id.org/did/v1",
      "id": "wrongId",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin}"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`;

    try {
      await subject.issue(type, "did:web:example.com", content);
    } catch (_) {
      return;
    }

    expect(false);
  });

  it("did:web issuer wrong publicKey type", async () => {
    httpClient._body = `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "wrongType",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin}"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`;

    try {
      await subject.issue(type, "did:web:example.com", content);
    } catch (_) {
      return;
    }

    expect(false);
  });

  it("did:web issuer wrong publicKey owner", async () => {
    httpClient._body = `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "wrongOwner",
           "ethereumAddress": "${admin}"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`;

    try {
      await subject.issue(type, "did:web:example.com", content);
    } catch (_) {
      return;
    }

    expect(false);
  });

  it("did:web issuer wrong publicKey ethereumAddress", async () => {
    httpClient._body = `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "invalidAddress"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`;

    try {
      await subject.issue(type, "did:web:example.com", content);
    } catch (_) {
      return;
    }

    expect(false);
  });

  it("should handle did:web issuer on revoke", async () => {
    const result = await subject.issue(type, "did:web:example.com", content);
    await subject.revokeById(result.proofPointId);
    const { isValid } = await subject.validate(result.proofPointObject);
    expect(isValid).to.be.false;
  });

  it("should handle did:web issuer on validate", async () => {
    // issue a proof point from a web domain which maps to an ethereum address
    const { proofPointId } = await subject.issue(
      type,
      "did:web:example.com",
      content
    );

    // it should be valid
    let validity = await subject.validateById(proofPointId);
    expect(validity.isValid).to.be.true;

    // remap the web domain to a different ethereum address
    httpClient._body = `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "0x0000000000000000000000000000000000000000"
      }],
      "authentication": [{
           "type": "Secp256k1SignatureAuthentication2018",
           "publicKey": "did:web:example.com#owner"
      }]
    }`;

    // now the proof point should be invalid
    validity = await subject.validateById(proofPointId);
    expect(validity.isValid).to.be.false;
  });

  it("should handle did:web issuer when DID document is missing", async () => {
    // issue a proof point from a web domain which maps to an ethereum address
    const { proofPointId } = await subject.issue(
      type,
      "did:web:example.com",
      content
    );

    // it should be valid
    let validity = await subject.validateById(proofPointId);
    expect(validity.isValid).to.be.true;

    // remap the web domain to an invalid document
    httpClient._body = "";

    // now the proof point should be invalid
    validity = await subject.validateById(proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusMessage).to.eq(
      `The issuer 'did:web:example.com' could not be resolved to an Ethereum address.`
    );
  });

  it("getAll should not return duplicate values", async () => {
    // issue the same proof point multiple times
    await subject.issue(type, admin, content);
    await subject.issue(type, admin, content);

    const allIds = await subject.getAll();

    // The Proof Point Id should not be duplicated in getAll
    expect(allIds.length).to.eq(1);
  });
});
