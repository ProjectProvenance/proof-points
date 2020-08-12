const ProofPointRegistryV2 = artifacts.require("ProofPointRegistry_v2");
const ProofPointRegistryStorage1 = artifacts.require(
  "ProofPointRegistryStorage1"
);

module.exports = async function (deployer) {
  await deployer.deploy(
    ProofPointRegistryV2,
    ProofPointRegistryStorage1.address
  );
  storageInstance = await ProofPointRegistryStorage1.deployed();
  await storageInstance.setOwner(ProofPointRegistryV2.address);
};
