const Web3 = require('web3');

const ppsRegistryEternalStorage1 = artifacts.require('./ProofPointRegistryStorage1.sol');
const ppsRegistry2 = artifacts.require('./ProofPointRegistry_v2.sol');

contract('ProofPointRegistry_v2', (accounts) => {
  const admin = accounts[0];
  const user1 = accounts[1];
  const user2 = accounts[2];
  const pp1 = Web3.utils.randomHex(32);
  const pp2 = Web3.utils.randomHex(32);
  const pp3 = Web3.utils.randomHex(32);
  const pp4 = Web3.utils.randomHex(32);
  let subject;

  beforeEach(async() => {
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    subject = await ppsRegistry2.new(storage.address, { from: admin });
    await storage.setOwner(subject.address, { from: admin });
  })

  it('user can issue pp in own name', async() => {
    await subject.issue(pp1, { from: user1 });
    assert(await subject.validate(user1, pp1));
  });

  it('user cannot issue pp in other name', async() => {
    await subject.issue(pp1, { from: user1 });
    assert(!await subject.validate(user2, pp1));
  });

  it('only specified pp is issued', async() => {
    await subject.issue(pp1, { from: user1 });
    assert(!await subject.validate(user1, pp2));
  });

  it('issuer can revoke pp', async() => {
    await subject.issue(pp1, { from: user1 });
    await subject.revoke(pp1, { from: user1 });
    assert(!await subject.validate(user1, pp1));
  });

  it('non-issuer cannot revoke pp', async() => {
    await subject.issue(pp1, { from: user1 });
    await subject.revoke(pp1, { from: user2 });
    assert(await subject.validate(user1, pp1));
  });

  it('user can commit pp in own name', async() => {
    await subject.commit(pp1, { from: user1 });
    assert(await subject.validate(user1, pp1));
  });

  it('user cannot commit pp in other name', async() => {
    await subject.commit(pp1, { from: user1 });
    assert(!await subject.validate(user2, pp1));
  });

  it('only specified pp is committed', async() => {
    await subject.commit(pp1, { from: user1 });
    assert(!await subject.validate(user1, pp2));
  });

  it('committer cannot revoke pp', async() => {
    await subject.commit(pp1, { from: user1 });
    await subject.revoke(pp1, { from: user1 });
    assert(await subject.validate(user1, pp1));
  });

  it('publishes issued proof point', async() => {
    const results = await subject.issue(pp1, { from: user1 });
    assert(results.logs[0].args._claimFull === pp1);
  });

  it('publishes committed proof point', async() => {
    const results = await subject.commit(pp1, { from: user1 });
    assert(results.logs[0].args._claimFull === pp1);
  });

  it('upgrade from v1 works', async() => {
    const ppsRegistry1 = artifacts.require('./ProofPointRegistry_v2.sol');
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    const v1 = await ppsRegistry1.new(storage.address, { from: admin });
    await storage.setOwner(v1.address, { from: admin });

    await v1.issue(pp1, { from: user1 });

    // upgrade
    const v2 = await ppsRegistry2.new(storage.address, { from: admin });
    await storage.setOwner(v2.address, { from: admin });

    // extant pps are still valid
    let isValid = await v2.validate(user1, pp1, { from: user1 });
    assert(isValid);

    // extant pps can be revoked
    await v2.revoke(pp1, { from: user1 });
    isValid = await v2.validate(user1, pp1, { from: user1 });
    assert(!isValid);

    // new pps can be issued
    await v2.issue(pp2, { from: user1 });
    isValid = await v2.validate(user1, pp2, { from: user1 });
    assert(isValid);

    // old registry cannot be used to issue
    try{
      await v1.issue(pp3, { from: user1 });
      assert(false);
    } catch(e){
    }

    // old registry cannot be used to commit
    try{
      await v1.commit(pp4, { from: user1 });
      assert(false);
    } catch(e){
    }
  });
});
