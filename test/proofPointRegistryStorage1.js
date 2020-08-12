const Web3 = require("web3");

const ProofPointRegistryStorage1 = artifacts.require(
  "./ProofPointRegistryStorage1.sol"
);

contract("ProofPointRegistryStorage1", (accounts) => {
  const admin = accounts[0];
  const owner1 = accounts[1];
  const nonOwner = accounts[2];
  const pp1 = Web3.utils.randomHex(32);
  const pp2 = Web3.utils.randomHex(32);
  let subject;

  beforeEach(async () => {
    subject = await ProofPointRegistryStorage1.new({ from: admin });
  });

  it("should let admin change admin", async () => {
    await subject.setAdmin(owner1, { from: admin });

    const newAdmin = await subject.getAdmin();
    assert(newAdmin === owner1);
  });

  it("should not let non-admin change admin", async () => {
    try {
      await subject.setAdmin(owner1, { from: owner1 });
    } catch (e) {
      return;
    }

    assert(false);
  });

  it("should let admin change owner", async () => {
    await subject.setOwner(owner1, { from: admin });

    const newOwner = await subject.getOwner();
    assert(newOwner === owner1);
  });

  it("should not let non-admin change owner", async () => {
    try {
      await subject.setOwner(owner1, { from: owner1 });
    } catch (e) {
      return;
    }

    assert(false);
  });

  it("should let owner write data", async () => {
    await subject.setOwner(owner1, { from: admin });
    await subject.set(owner1, pp1, true, { from: owner1 });

    assert(await subject.get(owner1, pp1));
  });

  it("should not let non-owner write data", async () => {
    await subject.setOwner(owner1, { from: admin });
    try {
      await subject.set(owner1, pp1, true, { from: nonOwner });
    } catch (e) {
      assert(!(await subject.get(owner1, pp1)));
      return;
    }

    assert(false);
  });

  it("should let non-owner read data", async () => {
    await subject.setOwner(owner1, { from: admin });
    await subject.set(owner1, pp1, true, { from: owner1 });
    assert(await subject.get(owner1, pp1, { from: nonOwner }));
  });

  it("default value is false", async () => {
    assert(!(await subject.get(owner1, pp1)));
  });

  it("pp can be made valid", async () => {
    await subject.setOwner(owner1, { from: admin });
    await subject.set(owner1, pp1, true, { from: owner1 });

    assert(await subject.get(owner1, pp1));
  });

  it("pp can be made invalid", async () => {
    await subject.setOwner(owner1, { from: admin });
    await subject.set(owner1, pp1, true, { from: owner1 });
    await subject.set(owner1, pp1, false, { from: owner1 });

    assert(!(await subject.get(owner1, pp1)));
  });

  it("only specified pp is affected", async () => {
    await subject.setOwner(owner1, { from: admin });
    await subject.set(owner1, pp1, true, { from: owner1 });

    assert(!(await subject.get(owner1, pp2)));
  });

  it("can get admin", async () => {
    assert((await subject.getAdmin()) === admin);
  });

  it("can get owner", async () => {
    await subject.setOwner(owner1, { from: admin });
    assert((await subject.getOwner()) === owner1);
  });
});
