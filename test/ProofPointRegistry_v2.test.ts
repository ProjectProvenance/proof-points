import { expect, use } from "chai";
import { Contract, utils, Wallet } from "ethers";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import ProofPointRegistryStorage1 from "../build/ProofPointRegistryStorage1.json";
import ProofPointRegistry2 from "../build/ProofPointRegistry_v2.json";
import ProofPointRegistry1 from "../build/ProofPointRegistry.json";

use(solidity);

describe("ProofPointRegistry_v2", () => {
  let provider: MockProvider;
  let adminWallet, user1Wallet, user2Wallet: Wallet; // = provider.getWallets();

  const pp1 = utils.hexlify(utils.randomBytes(32));
  const pp2 = utils.hexlify(utils.randomBytes(32));
  const pp3 = utils.hexlify(utils.randomBytes(32));
  const pp4 = utils.hexlify(utils.randomBytes(32));

  let adminContract: Contract;
  let user1Contract: Contract;
  let user2Contract: Contract;

  beforeEach(async () => {
    provider = new MockProvider();
    [adminWallet, user1Wallet, user2Wallet] = provider.getWallets();

    const storage = await deployContract(
      adminWallet,
      ProofPointRegistryStorage1
    );
    adminContract = await deployContract(adminWallet, ProofPointRegistry2, [
      storage.address,
    ]);
    user1Contract = adminContract.connect(user1Wallet);
    user2Contract = adminContract.connect(user2Wallet);
    await storage.setOwner(adminContract.address);
  });

  it("user can issue pp in own name", async () => {
    await user1Contract.issue(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp1)).to.be.true;
  });

  it("user cannot issue pp in other name", async () => {
    await user1Contract.issue(pp1);
    expect(await adminContract.validate(user2Wallet.address, pp1)).to.be.false;
  });

  it("only specified pp is issued", async () => {
    await user1Contract.issue(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp2)).to.be.false;
  });

  it("issuer can revoke pp", async () => {
    await user1Contract.issue(pp1);
    await user1Contract.revoke(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp1)).to.be.false;
  });

  it("non-issuer cannot revoke pp", async () => {
    await user1Contract.issue(pp1);
    await user2Contract.revoke(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp1)).to.be.true;
  });

  it("user can commit pp in own name", async () => {
    await user1Contract.commit(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp1)).to.be.true;
  });

  it("user cannot commit pp in other name", async () => {
    await user1Contract.commit(pp1);
    expect(await adminContract.validate(user2Wallet.address, pp1)).to.be.false;
  });

  it("only specified pp is committed", async () => {
    await user1Contract.commit(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp2));
  });

  it("committer cannot revoke pp", async () => {
    await user1Contract.commit(pp1);
    await user1Contract.revoke(pp1);
    expect(await adminContract.validate(user1Wallet.address, pp1)).to.be.true;
  });

  it("publishes issued Proof Point", async () => {
    const tx = await user1Contract.issue(pp1);
    const { events } = await tx.wait();
    expect(events[1].event).to.eq("Published");
    expect(events[1].args[0]).to.eq(pp1);
  });

  it("publishes committed Proof Point", async () => {
    const tx = await user1Contract.commit(pp1);
    const { events } = await tx.wait();
    expect(events[1].event).to.eq("Published");
    expect(events[1].args[0]).to.eq(pp1);
  });

  it("v2 is backwards compatible with v1", async () => {
    // deploy a v1 registry
    const storage = await deployContract(
      adminWallet,
      ProofPointRegistryStorage1
    );
    const v1Admin = await deployContract(adminWallet, ProofPointRegistry1, [
      storage.address,
    ]);
    await storage.setOwner(v1Admin.address);
    const v1User1 = v1Admin.connect(user1Wallet);

    // do some operations on the v1 registry
    await (await v1User1.issue(pp1)).wait();
    await (await v1User1.revoke(pp1)).wait();
    await (await v1User1.commit(pp1)).wait();

    // use the v2 ABI to interact with the deployed v1 contract
    const v2Admin = new Contract(v1Admin.address, ProofPointRegistry2.abi);
    const v2User1 = v2Admin.connect(user1Wallet);

    // It should be possible to recover data from past events
    const filter = {
      address: v1User1.address,
      fromBlock: 0,
      toBlock: "latest",
    };
    const events = await provider.getLogs(filter);

    const issueEvent = events[0];
    expect(issueEvent.topics[0]).to.equal(utils.id("Issued(address,bytes)"));
    expect(issueEvent.topics[1]).to.equal(
      utils.hexZeroPad(user1Wallet.address, 32).toLowerCase()
    );
    expect(issueEvent.topics[2]).to.equal(utils.keccak256(pp1));

    const revokeEvent = events[1];
    expect(revokeEvent.topics[0]).to.equal(utils.id("Revoked(address,bytes)"));
    expect(revokeEvent.topics[1]).to.equal(
      utils.hexZeroPad(user1Wallet.address, 32).toLowerCase()
    );
    expect(revokeEvent.topics[2]).to.equal(utils.keccak256(pp1));

    const commitEvent = events[2];
    expect(commitEvent.topics[0]).to.equal(
      utils.id("Committed(address,bytes)")
    );
    expect(commitEvent.topics[1]).to.equal(
      utils.hexZeroPad(user1Wallet.address, 32).toLowerCase()
    );
    expect(commitEvent.topics[2]).to.equal(utils.keccak256(pp1));

    // it should be possible to validate extant pps
    let isValid = await v2User1.validate(user1Wallet.address, pp1);
    expect(isValid).to.be.true;

    // it should be possible to issue new pps
    let result = await (await v2User1.issue(pp2)).wait();
    expect(result.events[0].event).to.equal("Issued");
    expect(result.events[0].args[0]).to.equal(user1Wallet.address);
    expect(result.events[0].args[1].hash).to.equal(utils.keccak256(pp2));
    isValid = await v2User1.validate(user1Wallet.address, pp2);
    expect(isValid).to.be.true;

    // it should be possible to commit new pps
    result = await (await v2User1.commit(pp3)).wait();
    expect(result.events[0].event).to.equal("Committed");
    expect(result.events[0].args[0]).to.equal(user1Wallet.address);
    expect(result.events[0].args[1].hash).to.equal(utils.keccak256(pp3));
    isValid = await v2User1.validate(user1Wallet.address, pp3);
    expect(isValid).to.be.true;

    // it should be possible to revoke extant pps
    result = await (await v2User1.revoke(pp2)).wait();
    expect(result.events[0].event === "Revoked");
    expect(result.events[0].args[0]).to.equal(user1Wallet.address);
    expect(result.events[0].args[1].hash).to.equal(utils.keccak256(pp2));
    isValid = await v2User1.validate(user1Wallet.address, pp2);
    expect(isValid).to.be.false;
  });

  it("v1 is forwards compatible with v2", async () => {
    // deploy a v2 registry
    const storage = await deployContract(
      adminWallet,
      ProofPointRegistryStorage1
    );
    const v2Admin = await deployContract(adminWallet, ProofPointRegistry2, [
      storage.address,
    ]);
    await storage.setOwner(v2Admin.address);
    const v2User1 = v2Admin.connect(user1Wallet);

    // do some operations on the registry
    await v2User1.issue(pp1);
    await v2User1.revoke(pp1);
    await v2User1.commit(pp1);

    // use the v1 ABI to interact with the v2 registry
    const v1Admin = new Contract(v2Admin.address, ProofPointRegistry1.abi);
    const v1User1 = v1Admin.connect(user1Wallet);

    // It should be possible to recover data from past events
    const filter = {
      address: v1User1.address,
      fromBlock: 0,
      toBlock: "latest",
    };
    const events = await provider.getLogs(filter);

    const issueEvent = events[0];
    expect(issueEvent.topics[0]).to.equal(utils.id("Issued(address,bytes)"));
    expect(issueEvent.topics[1]).to.equal(
      utils.hexZeroPad(user1Wallet.address, 32).toLowerCase()
    );
    expect(issueEvent.topics[2]).to.equal(utils.keccak256(pp1));

    // events[1] is the Published event

    const revokeEvent = events[2];

    expect(revokeEvent.topics[0]).to.equal(utils.id("Revoked(address,bytes)"));
    expect(revokeEvent.topics[1]).to.equal(
      utils.hexZeroPad(user1Wallet.address, 32).toLowerCase()
    );
    expect(revokeEvent.topics[2]).to.equal(utils.keccak256(pp1));

    const commitEvent = events[3];
    expect(commitEvent.topics[0]).to.equal(
      utils.id("Committed(address,bytes)")
    );
    expect(commitEvent.topics[1]).to.equal(
      utils.hexZeroPad(user1Wallet.address, 32).toLowerCase()
    );
    expect(commitEvent.topics[2]).to.equal(utils.keccak256(pp1));

    // it should be possible to validate extant pps
    let isValid = await v1User1.validate(user1Wallet.address, pp1);
    expect(isValid).to.be.true;

    // it should be possible to issue new pps
    let result = await (await v1User1.issue(pp2)).wait();
    expect(result.events[0].event).to.equal("Issued");
    expect(result.events[0].args[0]).to.equal(user1Wallet.address);
    expect(result.events[0].args[1].hash).to.equal(utils.keccak256(pp2));
    isValid = await v1User1.validate(user1Wallet.address, pp2);
    expect(isValid).to.be.true;

    // it should be possible to commit new pps
    result = await (await v1User1.commit(pp3)).wait();
    expect(result.events[0].event).to.equal("Committed");
    expect(result.events[0].args[0]).to.equal(user1Wallet.address);
    expect(result.events[0].args[1].hash).to.equal(utils.keccak256(pp3));
    isValid = await v1User1.validate(user1Wallet.address, pp3);
    expect(isValid).to.be.true;

    // it should be possible to revoke extant pps
    result = await (await v1User1.revoke(pp2)).wait();
    expect(result.events[0].event === "Revoked");
    expect(result.events[0].args[0]).to.equal(user1Wallet.address);
    expect(result.events[0].args[1].hash).to.equal(utils.keccak256(pp2));
    isValid = await v1User1.validate(user1Wallet.address, pp2);
    expect(isValid).to.be.false;
  });

  it("upgrade from v1 works", async () => {
    // deploy a v1 registry
    const storage = await deployContract(
      adminWallet,
      ProofPointRegistryStorage1
    );
    const v1Admin = await deployContract(adminWallet, ProofPointRegistry1, [
      storage.address,
    ]);
    await storage.setOwner(v1Admin.address);
    const v1User1 = v1Admin.connect(user1Wallet);

    // do an operation on the v1 registry
    await v1User1.issue(pp1);

    // upgrade the registry to v2
    const v2Admin = await deployContract(adminWallet, ProofPointRegistry2, [
      storage.address,
    ]);
    await storage.setOwner(v2Admin.address);
    const v2User1 = v2Admin.connect(user1Wallet);

    // extant pps are still valid
    let isValid = await v2User1.validate(user1Wallet.address, pp1);
    expect(isValid).to.be.true;

    // extant pps can be revoked
    await v2User1.revoke(pp1);
    isValid = await v2User1.validate(user1Wallet.address, pp1);
    expect(isValid).to.be.false;

    // new pps can be issued
    await v2User1.issue(pp2);
    isValid = await v2User1.validate(user1Wallet.address, pp2);
    expect(isValid).to.be.true;

    // old registry cannot be used to issue
    try {
      await v1User1.issue(pp3);
      expect.fail();
    } catch (e) {}

    // old registry cannot be used to commit
    try {
      await v1User1.commit(pp4);
      expect.fail();
    } catch (e) {}
  });

  it("version", async () => {
    // deploy a v1 registry
    const storage = await deployContract(
      adminWallet,
      ProofPointRegistryStorage1
    );
    const v1Admin = await deployContract(adminWallet, ProofPointRegistry1, [
      storage.address,
    ]);
    await storage.setOwner(v1Admin.address);
    const v1User1 = v1Admin.connect(user1Wallet);

    // upgrade the registry to v2
    const v2Admin = await deployContract(adminWallet, ProofPointRegistry2, [
      storage.address,
    ]);
    await storage.setOwner(v2Admin.address);
    const v2User1 = v2Admin.connect(user1Wallet);

    // getVersion() should return 2
    const version = await v2User1.getVersion();
    expect(version.toNumber() === 2);

    // getPrevious() should return address of v1 contract instance
    const previous = await v2User1.getPrevious();
    expect(previous === v1User1.address);
  });
});
