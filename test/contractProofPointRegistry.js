const Web3 = require("web3");

const ppsRegistryEternalStorage1 = artifacts.require(
  "./ProofPointRegistryStorage1.sol"
);
const ppsRegistry2 = artifacts.require("./ProofPointRegistry.sol");

contract("ProofPointRegistry", (accounts) => {
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const pp1 = Web3.utils.randomHex(32);
  const pp2 = Web3.utils.randomHex(32);
  let subject;

  beforeEach(async () => {
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    subject = await ppsRegistry2.new(storage.address, { from: admin });
    await storage.setOwner(subject.address, { from: admin });
  });

  it("user can issue pp in own name", async () => {
    await subject.issue(pp1, { from: user1 });
    assert(await subject.validate(user1, pp1));
  });

  it("user cannot issue pp in other name", async () => {
    await subject.issue(pp1, { from: user1 });
    assert(!(await subject.validate(user2, pp1)));
  });

  it("only specified pp is issued", async () => {
    await subject.issue(pp1, { from: user1 });
    assert(!(await subject.validate(user1, pp2)));
  });

  it("issuer can revoke pp", async () => {
    await subject.issue(pp1, { from: user1 });
    await subject.revoke(pp1, { from: user1 });
    assert(!(await subject.validate(user1, pp1)));
  });

  it("non-issuer cannot revoke pp", async () => {
    await subject.issue(pp1, { from: user1 });
    await subject.revoke(pp1, { from: user2 });
    assert(await subject.validate(user1, pp1));
  });

  it("user can commit pp in own name", async () => {
    await subject.commit(pp1, { from: user1 });
    assert(await subject.validate(user1, pp1));
  });

  it("user cannot commit pp in other name", async () => {
    await subject.commit(pp1, { from: user1 });
    assert(!(await subject.validate(user2, pp1)));
  });

  it("only specified pp is committed", async () => {
    await subject.commit(pp1, { from: user1 });
    assert(!(await subject.validate(user1, pp2)));
  });

  it("committer cannot revoke pp", async () => {
    await subject.commit(pp1, { from: user1 });
    await subject.revoke(pp1, { from: user1 });
    assert(await subject.validate(user1, pp1));
  });
});