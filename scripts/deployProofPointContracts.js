const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);
    
    console.log("Account balance:", (await deployer.getBalance()).toString());
    
    let addressKeys = {};
  
    const ProofPointRegStorage1 = await ethers.getContractFactory("ProofPointRegistryStorage1");
    const proof_point_reg_storage_1_contract = await ProofPointRegStorage1.deploy();
    addressKeys["Proof Point Registry Storage 1 Address"] = proof_point_reg_storage_1_contract.address;
  
    const ProofPointRegistryV1 = await ethers.getContractFactory("ProofPointRegistry");
    const proof_point_registry_v1_contract = await ProofPointRegistryV1.deploy(addressKeys["Proof Point Registry Storage 1 Address"]);
    addressKeys["Proof Point Registry V1 Address"] = proof_point_registry_v1_contract.address;

    const ProofPointRegistryV2 = await ethers.getContractFactory("ProofPointRegistry_v2");
    const proof_point_registry_v2_contract = await ProofPointRegistryV2.deploy(addressKeys["Proof Point Registry Storage 1 Address"]);
    addressKeys["Proof Point Registry V2 Address"] = proof_point_registry_v2_contract.address;

    console.log(addressKeys);
    fs.writeFile('contractConfig.json', JSON.stringify(addressKeys), 'utf8', () => {});
}

main()
.then(() => process.exit(0))
.catch((error) => {
    console.error(error);
    process.exit(1);
});
