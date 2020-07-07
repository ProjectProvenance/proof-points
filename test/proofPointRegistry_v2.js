const Web3 = require('web3');
const { assert } = require('chai');

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

  it('publishes issued Proof Point', async() => {
    const results = await subject.issue(pp1, { from: user1 });
    assert(results.logs[1].event === "Published");
    assert(results.logs[1].args._claim === pp1);
  });

  it('publishes committed Proof Point', async() => {
    const results = await subject.commit(pp1, { from: user1 });
    assert(results.logs[1].event === "Published");
    assert(results.logs[1].args._claim === pp1);
  });

  it('v2 is backwards compatible with v1', async() => {
    // deploy a v1 registry
    const ppsRegistry1 = artifacts.require('./ProofPointRegistry.sol');
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    const v1 = await ppsRegistry1.new(storage.address, { from: admin });
    await storage.setOwner(v1.address, { from: admin });

    // do some operations on the v1 registry
    await v1.issue(pp1, { from: user1 });
    await v1.revoke(pp1, { from: user1 });
    await v1.commit(pp1, { from: user1 });

    // use the v2 ABI to interact with the deployed v1 contract
    const v2 = await ppsRegistry2.at(v1.address);

    // It should be possible to recover data from past events
    const events = await v2.getPastEvents("AllEvents", {fromBlock: 0, toBlock: "latest"});
    const issueEvent = events[0];
    assert(issueEvent.event === "Issued");
    assert(issueEvent.returnValues._issuer === user1);
    assert(issueEvent.returnValues._claim === Web3.utils.keccak256(pp1));
    const revokeEvent = events[1];
    assert(revokeEvent.event === "Revoked");
    assert(revokeEvent.returnValues._issuer === user1);
    assert(revokeEvent.returnValues._claim === Web3.utils.keccak256(pp1));
    const commitEvent = events[2];
    assert(commitEvent.event === "Committed");
    assert(commitEvent.returnValues._issuer === user1);
    assert(commitEvent.returnValues._claim === Web3.utils.keccak256(pp1));

    // it should be possible to validate extant pps
    let isValid = await v2.validate(user1, pp1, { from: user1 });
    assert(isValid);

    // it should be possible to issue new pps
    let results = await v2.issue(pp2, { from: user1 });
    assert(results.logs[0].event === "Issued");
    assert(results.logs[0].args._issuer === user1);
    assert(results.logs[0].args._claim === Web3.utils.keccak256(pp2));
    isValid = await v2.validate(user1, pp2, { from: user1 });
    assert(isValid);

    // it should be possible to commit new pps
    results = await v2.commit(pp3, { from: user1 });
    assert(results.logs[0].event === "Committed");
    assert(results.logs[0].args._issuer === user1);
    assert(results.logs[0].args._claim === Web3.utils.keccak256(pp3));
    isValid = await v2.validate(user1, pp3, { from: user1 });
    assert(isValid);

    // it should be possible to revoke extant pps
    results = await v2.revoke(pp2, { from: user1 });
    assert(results.logs[0].event === "Revoked");
    assert(results.logs[0].args._issuer === user1);
    assert(results.logs[0].args._claim === Web3.utils.keccak256(pp2));
    isValid = await v2.validate(user1, pp2, { from: user1 });
    assert(!isValid);
  });

  it('v1 is forwards compatible with v2', async() => {
    // deploy a v2 registry
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    const v2 = await ppsRegistry2.new(storage.address, { from: admin });
    await storage.setOwner(v2.address, { from: admin });

    // do some operations on the registry
    await v2.issue(pp1, { from: user1 });
    await v2.revoke(pp1, { from: user1 });
    await v2.commit(pp1, { from: user1 });

    // use the v1 ABI to interact with the v2 registry
    const ppsRegistry1 = artifacts.require('./ProofPointRegistry.sol');
    const v1 = await ppsRegistry1.at(v2.address);

    // It should be possible to recover data from past events
    const events = await v1.getPastEvents("AllEvents", {fromBlock: 0, toBlock: "latest"});
    const issueEvent = events[0];
    assert(issueEvent.event === "Issued");
    assert(issueEvent.returnValues._issuer === user1);
    assert(issueEvent.returnValues._claim === Web3.utils.keccak256(pp1));
    const revokeEvent = events[1];
    assert(revokeEvent.event === "Revoked");
    assert(revokeEvent.returnValues._issuer === user1);
    assert(revokeEvent.returnValues._claim === Web3.utils.keccak256(pp1));
    const commitEvent = events[2];
    assert(commitEvent.event === "Committed");
    assert(commitEvent.returnValues._issuer === user1);
    assert(commitEvent.returnValues._claim === Web3.utils.keccak256(pp1));

    // it should be possible to validate extant pps
    let isValid = await v1.validate(user1, pp1, { from: user1 });
    assert(isValid);

    // it should be possible to issue new pps
    let results = await v1.issue(pp2, { from: user1 });
    assert(results.logs[0].event === "Issued");
    assert(results.logs[0].args._issuer === user1);
    assert(results.logs[0].args._claim === Web3.utils.keccak256(pp2));
    isValid = await v1.validate(user1, pp2, { from: user1 });
    assert(isValid);

    // it should be possible to commit new pps
    results = await v1.commit(pp3, { from: user1 });
    assert(results.logs[0].event === "Committed");
    assert(results.logs[0].args._issuer === user1);
    assert(results.logs[0].args._claim === Web3.utils.keccak256(pp3));
    isValid = await v1.validate(user1, pp3, { from: user1 });
    assert(isValid);

    // it should be possible to revoke extant pps
    results = await v1.revoke(pp2, { from: user1 });
    assert(results.logs[0].event === "Revoked");
    assert(results.logs[0].args._issuer === user1);
    assert(results.logs[0].args._claim === Web3.utils.keccak256(pp2));
    isValid = await v1.validate(user1, pp2, { from: user1 });
    assert(!isValid);
  });

  it('upgrade from v1 works', async() => {
    // deploy a v1 registry
    const ppsRegistry1 = artifacts.require('./ProofPointRegistry.sol');
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    const v1 = await ppsRegistry1.new(storage.address, { from: admin });
    await storage.setOwner(v1.address, { from: admin });

    // do an operation on the v1 registry
    await v1.issue(pp1, { from: user1 });

    // upgrade the registry to v2
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

  it('version', async() => {
    // Deploy a v1 registry
    const ppsRegistry1 = artifacts.require('./ProofPointRegistry.sol');
    const storage = await ppsRegistryEternalStorage1.new({ from: admin });
    const v1 = await ppsRegistry1.new(storage.address, { from: admin });
    await storage.setOwner(v1.address, { from: admin });

    // upgrade to v2 registry
    const v2 = await ppsRegistry2.new(storage.address, { from: admin });
    await storage.setOwner(v2.address, { from: admin });

    // getVersion() should return 2
    const version = await v2.getVersion();
    assert(version.toNumber() === 2);

    // getPrevious() should return address of v1 contract instance
    const previous = await v2.getPrevious();
    assert(previous === v1.address);
  });
});
