import { expect } from "chai";
import { Wallet } from "ethers";
import {
  EthereumProofPointRegistryRoot,
  EthereumAddress,
  StorageProvider,
  GeneralProofPointResolver,
  EthereumProofPointIssuer,
} from "../dist/src/index";
import FakeStorageProvider from "./fixtures/FakeStorageProvider";
import FakeHttpClient from "./fixtures/FakeHttpClient";
import { MockProvider } from "ethereum-waffle";
import { EthereumAddressResolver } from "../dist/src/ethereumAddressResolver";

describe("ProofPointResolver", () => {
  let storageProvider: StorageProvider;
  let subject: GeneralProofPointResolver;
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
    const registry = await registryRoot.getRegistry();
    subject = new GeneralProofPointResolver(storageProvider);
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
      registry
    );
  });

  it("can resolve IPFS", async () => {
    const results = await issuer.issue(type, admin.address, content);
    const fetched = await subject.resolve(results.proofPointId);

    expect(JSON.stringify(fetched)).to.eq(
      JSON.stringify(results.proofPointObject)
    );
  });
});
