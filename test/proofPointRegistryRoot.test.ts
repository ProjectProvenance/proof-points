import { expect } from "chai";
import { ContractFactory } from "ethers";
import { MockProvider } from "ethereum-waffle";
import ProofPointRegistryStorage1Abi from "../build/ProofPointRegistryStorage1.json";
import ProofPointRegistryV1Abi from "../build/ProofPointRegistry.json";
import { Wallet } from "ethers";
import {
  EthereumAddress,
  ProofPointRegistryRoot,
  StorageProvider,
} from "../dist/src/index";
import FakeStorageProvider from "./fixtures/FakeStorageProvider";
import FakeHttpClient from "./fixtures/FakeHttpClient";

describe("ProofPointRegistryRoot", () => {
  let storageProvider: StorageProvider;
  let subject: ProofPointRegistryRoot;
  let type: string;
  let content: any;
  let provider: MockProvider;
  let admin: Wallet;
  let httpClient: FakeHttpClient;

  async function deployV1(): Promise<void> {
    // deploy eternal storage contract
    let factory = new ContractFactory(
      ProofPointRegistryStorage1Abi.abi,
      ProofPointRegistryStorage1Abi.bytecode,
      admin
    );
    const eternalStorage = await factory.deploy();

    // deploy logic contract pointing to eternal storage
    factory = new ContractFactory(
      ProofPointRegistryV1Abi.abi,
      ProofPointRegistryV1Abi.bytecode,
      admin
    );
    const logic = await factory.deploy(eternalStorage.address);

    // set logic contract as owner of eternal storage
    await eternalStorage.setOwner(logic.address);

    // construct and return a ProofPointRegistry object for the newly deployed setup
    subject = new ProofPointRegistryRoot(
      EthereumAddress.parse(eternalStorage.address),
      provider
    );
  }

  beforeEach(async () => {
    storageProvider = new FakeStorageProvider();
    httpClient = new FakeHttpClient({});

    provider = new MockProvider();
    admin = provider.getWallets()[0];

    subject = await ProofPointRegistryRoot.deploy(
      provider,
      EthereumAddress.parse(admin.address)
    );

    type = "http://open.provenance.org/ontology/ptf/v1/TestProofPoint";
    content = {
      id: "https://provenance.org/subject1",
      some: ["pp", "data"],
      more: ["pp", "data"],
    };
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
    await deployV1();

    let canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.true;

    await subject.upgrade();

    canUpgrade = await subject.canUpgrade();
    expect(canUpgrade).to.be.false;
  });

  it("history still available after upgrade", async () => {
    // deploy v1 registry
    await deployV1();

    const registry = await subject.getRegistry(storageProvider, httpClient);

    // create some history activity
    const { proofPointId } = await registry.issue(type, admin.address, content);
    await registry.revokeById(proofPointId);

    // upgrade the registry contract
    await subject.upgrade();

    const upgradedRegistry = await subject.getRegistry(
      storageProvider,
      httpClient
    );

    // get the history of the pp issued before the upgrade
    const history = await upgradedRegistry.getHistoryById(proofPointId);

    // events from before the upgrade should be present
    expect(history.length).to.eq(2);
  });
});
