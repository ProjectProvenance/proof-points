import { expect } from "chai";
import { Wallet } from "ethers";
import {
  EthereumProofPointRegistryRoot,
  ProofPointValidator,
  ProofPointStatus,
  EthereumAddress,
  StorageProvider,
  IpfsProofPointResolver,
  EthereumProofPointAuthenticator,
  EthereumProofPointIssuer,
  ProofPointResolver,
  EthereumAddressResolver,
} from "../src/index";
import FakeStorageProvider from "./fixtures/FakeStorageProvider";
import FakeHttpClient from "./fixtures/FakeHttpClient";
import { MockProvider } from "ethereum-waffle";

describe("ProofPointValidator", () => {
  let storageProvider: StorageProvider;
  let subject: ProofPointValidator;
  let type: string;
  let content: any;
  let provider: MockProvider;
  let admin: Wallet;
  let httpClient: FakeHttpClient;
  let rootAddress: EthereumAddress;
  let issuer: EthereumProofPointIssuer;
  let resolver: ProofPointResolver;
  let ethereumAddressResolver: EthereumAddressResolver;

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
    resolver = new IpfsProofPointResolver(storageProvider);
    ethereumAddressResolver = new EthereumAddressResolver(httpClient);
    const authenticator = new EthereumProofPointAuthenticator(
      registry,
      ethereumAddressResolver
    );
    subject = new ProofPointValidator(resolver, authenticator);

    type = "http://open.provenance.org/ontology/ptf/v1/TestProofPoint";
    content = {
      id: "https://provenance.org/subject1",
      some: ["pp", "data"],
      more: ["pp", "data"],
    };

    issuer = new EthereumProofPointIssuer(
      rootAddress,
      ethereumAddressResolver,
      storageProvider,
      registry
    );
  });

  it("valid PP is valid", async () => {
    const results = await issuer.issue(type, admin.address, content);
    const validity = await subject.validate(results.proofPointId);
    expect(validity.isValid).to.be.true;
    expect(validity.statusCode).to.eq(ProofPointStatus.Valid);
  });

  it("revoked pp is invalid", async () => {
    const result = await issuer.issue(type, admin.address, content);
    await issuer.revoke(result.proofPointId);
    const validity = await subject.validate(result.proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NotFound);
  });

  it("pending pp is invalid", async () => {
    const results = await issuer.issue(
      type,
      admin.address,
      content,
      new Date(Date.now() + 1000000)
    );
    const validity = await subject.validate(results.proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Pending);
  });

  it("expired pp is invalid", async () => {
    const results = await issuer.issue(
      type,
      admin.address,
      content,
      null,
      new Date(Date.now() - 1000000)
    );
    const validity = await subject.validate(results.proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.Expired);
  });

  it("untrusted registry is invalid", async () => {
    // issue a pp
    const results = await issuer.issue(type, admin.address, content);

    // deploy a second registry and use an API that trusts only the new registry
    const altRegistryRoot = await EthereumProofPointRegistryRoot.deploy(
      provider,
      EthereumAddress.parse(admin.address)
    );
    const altRegistry = await altRegistryRoot.getRegistry();
    const altAuthenticator = new EthereumProofPointAuthenticator(
      altRegistry,
      ethereumAddressResolver
    );
    const altValidator = new ProofPointValidator(resolver, altAuthenticator);

    // use that API to validate the pp
    const validity = await altValidator.validate(results.proofPointId);

    // should be invalid, since it specifies a non trusted registry
    expect(validity.isValid).to.be.false;
    expect(validity.statusCode).to.eq(ProofPointStatus.NonTrustedRegistry);
  });

  it("did:web issuer is valid", async () => {
    const result = await issuer.issue(type, "did:web:example.com", content);
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com");
    const { isValid } = await subject.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with subpath is valid", async () => {
    const result = await issuer.issue(
      type,
      "did:web:example.com:subpath",
      content
    );
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com:subpath");
    const { isValid } = await subject.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with port is valid", async () => {
    const result = await issuer.issue(
      type,
      "did:web:example.com%3A1234",
      content
    );
    expect(result.proofPointObject.issuer).to.eq("did:web:example.com%3A1234");
    const { isValid } = await subject.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with port and subpath is valid", async () => {
    const result = await issuer.issue(
      type,
      "did:web:example.com%3A1234:subpath",
      content
    );
    expect(result.proofPointObject.issuer).to.eq(
      "did:web:example.com%3A1234:subpath"
    );
    const { isValid } = await subject.validate(result.proofPointId);
    expect(isValid).to.be.true;
  });

  it("did:web issuer with wrong Ethereum address is invalid", async () => {
    // issue a proof point from a web domain which maps to an ethereum address
    const { proofPointId } = await issuer.issue(
      type,
      "did:web:example.com",
      content
    );

    // it should be valid
    let validity = await subject.validate(proofPointId);
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
    validity = await subject.validate(proofPointId);
    expect(validity.isValid).to.be.false;
  });

  it("did:web issuer with missing did:web document is invalid", async () => {
    // issue a proof point from a web domain which maps to an ethereum address
    const { proofPointId } = await issuer.issue(
      type,
      "did:web:example.com",
      content
    );

    // it should be valid
    let validity = await subject.validate(proofPointId);
    expect(validity.isValid).to.be.true;

    // remap the web domain to an invalid document
    httpClient._responses["https://example.com/.well-known/did.json"] = "";

    // now the proof point should be invalid
    validity = await subject.validate(proofPointId);
    expect(validity.isValid).to.be.false;
    expect(validity.statusMessage).to.eq(
      `The issuer 'did:web:example.com' could not be resolved to an Ethereum address.`
    );
  });
});
