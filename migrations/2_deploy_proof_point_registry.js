const ProofPointRegistry = artifacts.require("ProofPointRegistry");
const ProofPointRegistryStorage1 = artifacts.require("ProofPointRegistryStorage1");

module.exports = async function(deployer) {
  await deployer.deploy(ProofPointRegistryStorage1);
  await deployer.deploy(ProofPointRegistry, ProofPointRegistryStorage1.address);
  storageInstance = await ProofPointRegistryStorage1.deployed();
  await storageInstance.setOwner(ProofPointRegistry.address);
};
