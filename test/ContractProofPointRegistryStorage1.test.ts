import { expect, use } from "chai";
import { Contract, utils } from "ethers";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import ProofPointRegistryStorage1 from "../build/ProofPointRegistryStorage1.json";

use(solidity);

describe("ProofPointRegistryStorage1", () => {
  const [admin, owner1, nonOwner] = new MockProvider().getWallets();

  const pp1 = utils.hexlify(utils.randomBytes(32));
  const pp2 = utils.hexlify(utils.randomBytes(32));
  let adminUser: Contract;
  let ownerUser: Contract;
  let nonOwnerUser: Contract;

  beforeEach(async () => {
    adminUser = await deployContract(admin, ProofPointRegistryStorage1);
    ownerUser = adminUser.connect(owner1);
    nonOwnerUser = adminUser.connect(nonOwner);
  });

  it("should let admin change admin", async () => {
    await adminUser.setAdmin(owner1.address);

    const newAdmin = await adminUser.getAdmin();

    expect(newAdmin).to.equal(owner1.address);
  });

  it("should not let non-admin change admin", async () => {
    try {
      await ownerUser.setAdmin(owner1.address);
    } catch (e) {
      return;
    }

    expect.fail();
  });

  it("should let admin change owner", async () => {
    await adminUser.setOwner(owner1.address);

    const newOwner = await adminUser.getOwner();

    expect(newOwner).to.equal(owner1.address);
  });

  it("should not let non-admin change owner", async () => {
    try {
      await ownerUser.setOwner(owner1.address);
    } catch (e) {
      return;
    }

    expect.fail();
  });

  it("should let owner write data", async () => {
    await adminUser.setOwner(owner1.address);
    await ownerUser.set(owner1.address, pp1, true);

    expect(await adminUser.get(owner1.address, pp1)).to.be.true;
  });

  it("should not let non-owner write data", async () => {
    await adminUser.setOwner(owner1.address);
    try {
      await nonOwnerUser.set(owner1.address, pp1, true);
    } catch (e) {
      expect(await adminUser.get(owner1.address, pp1)).to.be.false;
      return;
    }

    expect.fail();
  });

  it("should let non-owner read data", async () => {
    await adminUser.setOwner(owner1.address);
    await ownerUser.set(owner1.address, pp1, true);
    expect(await nonOwnerUser.get(owner1.address, pp1)).to.be.true;
  });

  it("default value is false", async () => {
    expect(await adminUser.get(owner1.address, pp1)).to.be.false;
  });

  it("pp can be made valid", async () => {
    await adminUser.setOwner(owner1.address);
    await ownerUser.set(owner1.address, pp1, true);

    expect(await adminUser.get(owner1.address, pp1)).to.be.true;
  });

  it("pp can be made invalid", async () => {
    await adminUser.setOwner(owner1.address);
    await ownerUser.set(owner1.address, pp1, true);
    await ownerUser.set(owner1.address, pp1, false);

    expect(await adminUser.get(owner1.address, pp1)).to.be.false;
  });

  it("only specified pp is affected", async () => {
    await adminUser.setOwner(owner1.address);
    await ownerUser.set(owner1.address, pp1, true);

    expect(await adminUser.get(owner1.address, pp2)).to.be.false;
  });

  it("can get admin", async () => {
    expect(await adminUser.getAdmin()).to.equal(admin.address);
  });

  it("can get owner", async () => {
    await adminUser.setOwner(owner1.address);
    expect(await adminUser.getOwner()).to.equal(owner1.address);
  });
});
