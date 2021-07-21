import { expect } from "chai";
import { Wallet } from "ethers";
import {
  EthereumProofPointRegistryRoot,
  ProofPointValidator,
  ProofPointStatus,
  EthereumAddress,
  StorageProvider,
  GeneralProofPointResolver,
  GeneralProofPointAuthenticator,
  EthereumProofPointIssuer,
  ProofPointResolver,
} from "../dist/src/index";
import FakeStorageProvider from "./fixtures/FakeStorageProvider";
import FakeHttpClient from "./fixtures/FakeHttpClient";
import { MockProvider } from "ethereum-waffle";
import { EthereumAddressResolver } from "../dist/src/ethereumAddressResolver";

describe("EthereumProofPointIssuer", () => {
  let storageProvider: StorageProvider;
  let type: string;
  let content: any;
  let provider: MockProvider;
  let admin: Wallet;
  let httpClient: FakeHttpClient;
  let rootAddress: EthereumAddress;
  let subject: EthereumProofPointIssuer;
  let resolver: ProofPointResolver;
  let ethereumAddressResolver: EthereumAddressResolver;
  let validator: ProofPointValidator;

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

    const registryRoot = await EthereumProofPointRegistryRoot.deploy(
      provider,
      EthereumAddress.parse(admin.address)
    );
    rootAddress = registryRoot.getAddress();
    const registry = await registryRoot.getRegistry();
    resolver = new GeneralProofPointResolver(httpClient, storageProvider);
    ethereumAddressResolver = new EthereumAddressResolver(httpClient);
    const authenticator = new GeneralProofPointAuthenticator(
      registry,
      ethereumAddressResolver
    );
    validator = new ProofPointValidator(resolver, authenticator);

    type = "http://open.provenance.org/ontology/ptf/v1/TestProofPoint";
    content = {
      id: "https://provenance.org/subject1",
      some: ["pp", "data"],
      more: ["pp", "data"],
    };

    subject = new EthereumProofPointIssuer(
      rootAddress,
      ethereumAddressResolver,
      storageProvider,
      registry
    );
  });

  it("happy path", async () => {
    const results = await subject.issue(type, admin.address, content);
    const validity = await validator.validate(results.proofPointId);
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
    const validity = await validator.validate(results.proofPointId);
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
    await subject.revoke(result.proofPointId);
    const validity = await validator.validate(result.proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it("did:web issuer happy path", async () => {
    const result = await subject.issue(type, "did:web:example.com", content);
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com");
    const { isValid } = await validator.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with subpath succeeds", async () => {
    const result = await subject.issue(
      type,
      "did:web:example.com:subpath",
      content
    );
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com:subpath");
    const { isValid } = await validator.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with port succeeds", async () => {
    const result = await subject.issue(
      type,
      "did:web:example.com%3A1234",
      content
    );
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com%3A1234");
    const { isValid } = await validator.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with port and subpath succeeds", async () => {
    const result = await subject.issue(
      type,
      "did:web:example.com%3A1234:subpath",
      content
    );
    expect(result.proofPointObject.issuer).to.eq(
      "did:web:example.com%3A1234:subpath"
    );
    const { isValid } = await validator.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with wrong context fails", async () => {
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

  it("did:web issuer with wrong id fails", async () => {
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

  it("did:web issuer with wrong publicKey type fails", async () => {
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

  it("did:web issuer with wrong publicKey owner fails", async () => {
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

  it("did:web issuer with wrong publicKey ethereumAddress fails", async () => {
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

  it("revoke with did:web issuer succeeds", async () => {
    const result = await subject.issue(type, "did:web:example.com", content);
    await subject.revoke(result.proofPointId);
    const { isValid } = await validator.validate(result.proofPointId);
    expect(isValid).to.be.false;
  });
});
