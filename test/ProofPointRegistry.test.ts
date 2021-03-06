import { expect } from "chai";
import { Wallet } from "ethers";
import {
  ProofPointRegistryRoot,
  ProofPointStatus,
  ProofPointEventType,
  EthereumAddress,
  ProofPointRegistry,
  StorageProvider,
} from "../dist/src/index";
import FakeStorageProvider from "./fixtures/FakeStorageProvider";
import FakeHttpClient from "./fixtures/FakeHttpClient";
import { MockProvider } from "ethereum-waffle";

describe("ProofPointRegistry", () => {
  let storageProvider: StorageProvider;
  let subject: ProofPointRegistry;
  let type: string;
  let content: any;
  let provider: MockProvider;
  let admin: Wallet;
  let httpClient: FakeHttpClient;
  let rootAddress: EthereumAddress;

  beforeEach(async () => {
    storageProvider = new FakeStorageProvider();

    provider = new MockProvider();
    admin = provider.getWallets()[0];

    httpClient = new FakeHttpClient({
      "https://example.com/.well-known/did.json": `
      {
        "@context": "https://w3id.org/did/v1",
        "id": "did:web:example.com",
        "publicKey": [{
            "id": "did:web:example.com#owner",
            "type": "Secp256k1VerificationKey2018",
            "owner": "did:web:example.com",
            "ethereumAddress": "${admin.address}"
        }],
        "authentication": [{
            "type": "Secp256k1SignatureAuthentication2018",
            "publicKey": "did:web:example.com#owner"
        }]
      }`,
      "https://example.com/subpath/did.json": `
      {
        "@context": "https://w3id.org/did/v1",
        "id": "did:web:example.com:subpath",
        "publicKey": [{
            "id": "did:web:example.com:subpath#owner",
            "type": "Secp256k1VerificationKey2018",
            "owner": "did:web:example.com:subpath",
            "ethereumAddress": "${admin.address}"
        }],
        "authentication": [{
            "type": "Secp256k1SignatureAuthentication2018",
            "publicKey": "did:web:example.com:subpath#owner"
        }]
      }`,
      "https://example.com:1234/.well-known/did.json": `
      {
        "@context": "https://w3id.org/did/v1",
        "id": "did:web:example.com%3A1234",
        "publicKey": [{
            "id": "did:web:example.com%3A1234#owner",
            "type": "Secp256k1VerificationKey2018",
            "owner": "did:web:example.com%3A1234",
            "ethereumAddress": "${admin.address}"
        }],
        "authentication": [{
            "type": "Secp256k1SignatureAuthentication2018",
            "publicKey": "did:web:example.com%3A1234#owner"
        }]
      }`,
      "https://example.com:1234/subpath/did.json": `
      {
        "@context": "https://w3id.org/did/v1",
        "id": "did:web:example.com%3A1234:subpath",
        "publicKey": [{
            "id": "did:web:example.com%3A1234:subpath#owner",
            "type": "Secp256k1VerificationKey2018",
            "owner": "did:web:example.com%3A1234:subpath",
            "ethereumAddress": "${admin.address}"
        }],
        "authentication": [{
            "type": "Secp256k1SignatureAuthentication2018",
            "publicKey": "did:web:example.com%3A1234:subpath#owner"
        }]
      }`,
    });

    const registryRoot = await ProofPointRegistryRoot.deploy(
      provider,
      EthereumAddress.parse(admin.address)
    );
    rootAddress = registryRoot.getAddress();
    subject = await registryRoot.getRegistry(storageProvider, httpClient);

    type = "http://open.provenance.org/ontology/ptf/v1/TestProofPoint";
    content = {
      id: "https://provenance.org/subject1",
      some: ["pp", "data"],
      more: ["pp", "data"],
    };
  });

  // Currently skipped because it depends on an external IPFS server and requires
  // the browser based 'fetch' utility
  it.skip("should use provenance IPFS for storage if not specified", async () => {
    const registryRoot = await ProofPointRegistryRoot.deploy(
      provider,
      EthereumAddress.parse(admin.address)
    );
    subject = await registryRoot.getRegistry(null, httpClient);
    await subject.issue(type, admin.address, content);
    // no exception
  });

  it("should issue a valid pp", async () => {
    const results = await subject.issue(type, admin.address, content);
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("should correctly set registryRoot of issued proof point", async () => {
    const results = await subject.issue(type, admin.address, content);
    expect(results.proofPointObject.proof.registryRoot).to.eq(
      rootAddress.toString()
    );
  });

  it("should commit a valid pp", async () => {
    const results = await subject.commit(type, admin.address, content);
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("should return tx hash and pp ID and a pp object", async () => {
    const results = await subject.issue(type, admin.address, content);
    expect(results.proofPointId).to.exist;
    expect(results.transactionHash).to.exist;
    expect(results.proofPointObject).to.exist;
  });

  it("should revoke a pp", async () => {
    const result = await subject.issue(type, admin.address, content);
    await subject.revoke(result.proofPointObject);
    const validity = await subject.validate(result.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it("should validate a valid pp by ID", async () => {
    const results = await subject.issue(type, admin.address, content);
    const validity = await subject.validateById(results.proofPointId);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("should revoke a valid pp by ID", async () => {
    const results = await subject.issue(type, admin.address, content);
    await subject.revokeById(results.proofPointId);
    const validity = await subject.validateById(results.proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it("should treat pp data canonically", async () => {
    const results = await subject.issue(type, admin.address, content);
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
      admin.address,
      content,
      new Date(Date.now() + 1000000)
    );
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Pending);
  });

  it("pp should be invalid after expirationDate", async () => {
    const results = await subject.issue(
      type,
      admin.address,
      content,
      null,
      new Date(Date.now() - 1000000)
    );
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Expired);
  });

  it("pp should be invalid if issued to a different registry", async () => {
    // issue a pp
    const results = await subject.issue(type, admin.address, content);

    // deploy a second registry and use an API that trusts only the new registry
    const altRegistryRoot = await ProofPointRegistryRoot.deploy(
      provider,
      EthereumAddress.parse(admin.address)
    );
    const altRegistry = await altRegistryRoot.getRegistry(
      storageProvider,
      httpClient
    );

    // use that API to validate the pp
    const validity = await altRegistry.validate(results.proofPointObject);

    // should be invalid, since it specifies a non trusted registry
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NonTrustedRegistry);
  });

  it("should return the correct Proof Point document when getById is called", async () => {
    const results = await subject.issue(type, admin.address, content);

    const fetched = await subject.getById(results.proofPointId);

    expect(JSON.stringify(fetched)).to.eq(
      JSON.stringify(results.proofPointObject)
    );
  });

  it("should return a list of all issued and committed Proof Points when getAll is called", async () => {
    // issue a pp
    const result1 = await subject.issue("type1", admin.address, content);
    // revoke it
    await subject.revoke(result1.proofPointObject);
    // commit another pp
    const result2 = await subject.commit("type2", admin.address, content);

    // get all pps ever published
    const list = await subject.getAll();

    // should include the issued and revoked one and the committed one
    expect(list.length).to.eq(2);
    expect(list[0].toString()).to.equal(result1.proofPointId.toString());
    expect(list[1].toString()).to.equal(result2.proofPointId.toString());
  });

  it("should return a list of all related events when getHistoryById is called", async () => {
    // issue a pp
    const result = await subject.issue(type, admin.address, content);
    // issue another one
    await subject.issue("type2", admin.address, content);
    // revoke the first one
    await subject.revoke(result.proofPointObject);
    // commit the first one
    await subject.commit(type, admin.address, content);

    // get history of first one
    const history = await subject.getHistoryById(result.proofPointId);

    // should be Issue, Revoke, Commit and not include the other pp
    expect(history.length).to.eq(3);
    expect(history[0].type).to.eq(ProofPointEventType.Issued);
    expect(history[0].issuer.toString()).to.eq(admin.address);
    expect(history[0].transactionHash).to.not.be.null;
    expect(history[1].type).to.eq(ProofPointEventType.Revoked);
    expect(history[1].issuer.toString()).to.eq(admin.address);
    expect(history[1].transactionHash).to.not.be.null;
    expect(history[2].type).to.eq(ProofPointEventType.Committed);
    expect(history[2].issuer.toString()).to.eq(admin.address);
    expect(history[2].transactionHash).to.not.be.null;
  });

  it("did:web issuer happy path", async () => {
    const result = await subject.issue(type, "did:web:example.com", content);
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com");
    const { isValid } = await subject.validate(result.proofPointObject);
    expect(isValid).to.be.true;
  });

  it("did:web issuer subpath", async () => {
    const result = await subject.issue(
      type,
      "did:web:example.com:subpath",
      content
    );
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com:subpath");
    const { isValid } = await subject.validate(result.proofPointObject);
    expect(isValid).to.be.true;
  });

  it("did:web issuer port", async () => {
    const result = await subject.issue(
      type,
      "did:web:example.com%3A1234",
      content
    );
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com%3A1234");
    const { isValid } = await subject.validate(result.proofPointObject);
    expect(isValid).to.be.true;
  });

  it("did:web issuer port and subpath", async () => {
    const result = await subject.issue(
      type,
      "did:web:example.com%3A1234:subpath",
      content
    );
    expect(result.proofPointObject.issuer).to.eq(
      "did:web:example.com%3A1234:subpath"
    );
    const { isValid } = await subject.validate(result.proofPointObject);
    expect(isValid).to.be.true;
  });

  it("did:web issuer wrong context", async () => {
    httpClient._responses["https://example.com/.well-known/did.json"] = `{
      "@context": "wrongContext",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin.address}"
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
    httpClient._responses["https://example.com/.well-known/did.json"] = `{
      "@context": "https://w3id.org/did/v1",
      "id": "wrongId",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin.address}"
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
    httpClient._responses["https://example.com/.well-known/did.json"] = `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "wrongType",
           "owner": "did:web:example.com",
           "ethereumAddress": "${admin.address}"
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
    httpClient._responses["https://example.com/.well-known/did.json"] = `{
      "@context": "https://w3id.org/did/v1",
      "id": "did:web:example.com",
      "publicKey": [{
           "id": "did:web:example.com#owner",
           "type": "Secp256k1VerificationKey2018",
           "owner": "wrongOwner",
           "ethereumAddress": "${admin.address}"
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
    httpClient._responses["https://example.com/.well-known/did.json"] = `{
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
    httpClient._responses["https://example.com/.well-known/did.json"] = `{
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
    httpClient._responses["https://example.com/.well-known/did.json"] = "";

    // now the proof point should be invalid
    validity = await subject.validateById(proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusMessage).to.eq(
      `The issuer 'did:web:example.com' could not be resolved to an Ethereum address.`
    );
  });

  it("getAll should not return duplicate values", async () => {
    // issue the same proof point multiple times
    await subject.issue(type, admin.address, content);
    await subject.issue(type, admin.address, content);

    const allIds = await subject.getAll();

    // The Proof Point Id should not be duplicated in getAll
    expect(allIds.length).to.eq(1);
  });

  it("Should be able to issue with a provided signer", async () => {
    const signer = provider.getWallets()[1];
    const results = await subject.issue(
      type,
      await signer.getAddress(),
      content,
      null,
      null,
      signer
    );

    expect(results.proofPointObject.issuer).to.eq(await signer.getAddress());
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("Should be able to commit with a provided signer", async () => {
    const signer = provider.getWallets()[1];
    const results = await subject.commit(
      type,
      await signer.getAddress(),
      content,
      null,
      null,
      signer
    );

    expect(results.proofPointObject.issuer).to.eq(await signer.getAddress());
    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("Should be able to revoke with a provided signer", async () => {
    const signer = provider.getWallets()[1];
    const results = await subject.issue(
      type,
      await signer.getAddress(),
      content
    );

    await subject.revoke(results.proofPointObject, signer);

    const validity = await subject.validate(results.proofPointObject);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });
});
