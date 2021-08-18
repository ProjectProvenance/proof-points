import { expect } from "chai";
import { Wallet } from "ethers";
import {
  EthereumProofPointRegistryRoot,
  EthereumProofPointEventType,
  EthereumAddress,
  EthereumProofPointRegistry,
  StorageProvider,
  EthereumProofPointIssuer,
  EthereumAddressResolver,
} from "../src/index";
import FakeStorageProvider from "./fixtures/FakeStorageProvider";
import FakeHttpClient from "./fixtures/FakeHttpClient";
import { MockProvider } from "ethereum-waffle";

describe("EthereumProofPointRegistry", () => {
  let storageProvider: StorageProvider;
  let subject: EthereumProofPointRegistry;
  let type: string;
  let content: any;
  let provider: MockProvider;
  let admin: Wallet;
  let httpClient: FakeHttpClient;
  let rootAddress: EthereumAddress;
  let issuer: EthereumProofPointIssuer;
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
    subject = await registryRoot.getRegistry();
    ethereumAddressResolver = new EthereumAddressResolver(httpClient);

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
      subject
    );
  });

  it("should return a list of all issued and committed Proof Points when getAll is called", async () => {
    // issue a pp
    const result1 = await issuer.issue("type1", admin.address, content);
    // revoke it
    await issuer.revoke(result1.proofPointId);
    // commit another pp
    const result2 = await issuer.commit("type2", admin.address, content);

    // get all pps ever published
    const list = await subject.getAll();

    // should include the issued and revoked one and the committed one
    expect(list.length).to.eq(2);
    expect(list[0].toString()).to.equal(result1.proofPointId.toString());
    expect(list[1].toString()).to.equal(result2.proofPointId.toString());
  });

  it("should return a list of all related events when getHistoryById is called", async () => {
    // issue a pp
    const result = await issuer.issue(type, admin.address, content);
    // issue another one
    await issuer.issue("type2", admin.address, content);
    // revoke the first one
    await issuer.revoke(result.proofPointId);
    // commit the first one
    await issuer.commit(type, admin.address, content);

    // get history of first one
    const history = await subject.getHistory(result.proofPointId);

    // should be Issue, Revoke, Commit and not include the other pp
    expect(history.length).to.eq(3);
    expect(history[0].type).to.eq(EthereumProofPointEventType.Issued);
    expect(history[0].issuer.toString()).to.eq(admin.address);
    expect(history[0].transactionHash).to.not.be.null;
    expect(history[1].type).to.eq(EthereumProofPointEventType.Revoked);
    expect(history[1].issuer.toString()).to.eq(admin.address);
    expect(history[1].transactionHash).to.not.be.null;
    expect(history[2].type).to.eq(EthereumProofPointEventType.Committed);
    expect(history[2].issuer.toString()).to.eq(admin.address);
    expect(history[2].transactionHash).to.not.be.null;
  });

  it("getAll should not return duplicate values", async () => {
    // issue the same proof point multiple times
    await issuer.issue(type, admin.address, content);
    await issuer.issue(type, admin.address, content);

    const allIds = await subject.getAll();

    // The Proof Point Id should not be duplicated in getAll
    expect(allIds.length).to.eq(1);
  });
});
