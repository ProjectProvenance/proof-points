import { expect, use } from "chai";
import { Contract, utils } from "ethers";
import { deployContract, MockProvider, solidity } from "ethereum-waffle";
import ProofPointRegistryStorage1 from "../build/ProofPointRegistryStorage1.json";
import ProofPointRegistry from "../build/ProofPointRegistry.json";

use(solidity);

describe("ProofPointRegistry", () => {
  const [
    adminWallet,
    user1Wallet,
    user2Wallet,
  ] = new MockProvider().getWallets();

  const pp1 = utils.hexlify(utils.randomBytes(32));
  const pp2 = utils.hexlify(utils.randomBytes(32));

  let adminContract: Contract;
  let user1Contract: Contract;
  let user2Contract: Contract;

  beforeEach(async () => {
    const storage = await deployContract(
      adminWallet,
      ProofPointRegistryStorage1
    );
    adminContract = await deployContract(adminWallet, ProofPointRegistry, [
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
});
