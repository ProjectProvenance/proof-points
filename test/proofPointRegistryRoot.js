// const { expect } = require("chai");
// const { ProofPointRegistryRoot } = require("../dist/src/index");
// const FakeStorageProvider = require("./fixtures/FakeStorageProvider");

// const ProofPointRegistryV1Abi = require("../build/contracts/ProofPointRegistry.json");
// const ProofPointRegistryStorage1Abi = require("../build/contracts/ProofPointRegistryStorage1.json");
// const FakeHttpClient = require("./fixtures/FakeHttpClient");

// contract("ProofPointRegistryRoot", () => {
//   let storageProvider;
//   let subject;
//   let type;
//   let content;
//   let admin;
//   let httpClient;

//   beforeEach(async () => {
//     storageProvider = new FakeStorageProvider();
//     httpClient = new FakeHttpClient({});

//     const accounts = await web3.eth.getAccounts();
//     [admin] = accounts;

//     subject = await ProofPointRegistryRoot.deploy(admin, web3);

//     type = "http://open.provenance.org/ontology/ptf/v1/TestProofPoint";
//     content = {
//       id: "https://provenance.org/subject1",
//       some: ["pp", "data"],
//       more: ["pp", "data"],
//     };
//   });

//   it("should not upgrade a latest version repo", async () => {
//     const canUpgrade = await subject.canUpgrade();
//     expect(canUpgrade).to.be.false;
//     try {
//       await subject.upgrade();
//     } catch (e) {
//       expect(e.message).to.eq(
//         "Cannot upgrade Proof Point registry: Already at or above current version."
//       );
//     }
//   });

//   it("upgrade happy path", async () => {
//     // deploy v1 registry

//     // deploy eternal storage contract
//     const eternalStorageContract = new web3.eth.Contract(
//       ProofPointRegistryStorage1Abi.abi
//     );
//     const eternalStorage = await eternalStorageContract
//       .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
//       .send({ from: admin, gas: 1000000 });

//     // deploy logic contract pointing to eternal storage
//     const logicContract = new web3.eth.Contract(ProofPointRegistryV1Abi.abi);
//     const logic = await logicContract
//       .deploy({
//         data: ProofPointRegistryV1Abi.bytecode,
//         arguments: [eternalStorage.options.address],
//       })
//       .send({ from: admin, gas: 1000000 });

//     // set logic contract as owner of eternal storage
//     await eternalStorage.methods
//       .setOwner(logic.options.address)
//       .send({ from: admin, gas: 1000000 });

//     // construct and return a ProofPointRegistry object for the newly deployed setup
//     subject = new ProofPointRegistryRoot(eternalStorage.options.address, web3);

//     let canUpgrade = await subject.canUpgrade();
//     expect(canUpgrade).to.be.true;

//     await subject.upgrade();

//     canUpgrade = await subject.canUpgrade();
//     expect(canUpgrade).to.be.false;
//   });

//   it("history still available after upgrade", async () => {
//     // deploy v1 registry

//     // deploy eternal storage contract
//     const eternalStorageContract = new web3.eth.Contract(
//       ProofPointRegistryStorage1Abi.abi
//     );
//     const eternalStorage = await eternalStorageContract
//       .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
//       .send({ from: admin, gas: 1000000 });

//     // deploy logic contract pointing to eternal storage
//     const logicContract = new web3.eth.Contract(ProofPointRegistryV1Abi.abi);
//     const logic = await logicContract
//       .deploy({
//         data: ProofPointRegistryV1Abi.bytecode,
//         arguments: [eternalStorage.options.address],
//       })
//       .send({ from: admin, gas: 1000000 });

//     // set logic contract as owner of eternal storage
//     await eternalStorage.methods
//       .setOwner(logic.options.address)
//       .send({ from: admin, gas: 1000000 });

//     // construct and return a ProofPointRegistry object for the newly deployed setup
//     subject = new ProofPointRegistryRoot(eternalStorage.options.address, web3);

//     const registry = await subject.getRegistry(storageProvider, httpClient);

//     // create some history activity
//     const { proofPointId } = await registry.issue(type, admin, content);
//     await registry.revokeById(proofPointId);

//     // upgrade the registry contract
//     await subject.upgrade();

//     const upgradedRegistry = await subject.getRegistry(
//       storageProvider,
//       httpClient
//     );

//     // get the history of the pp issued before the upgrade
//     const history = await upgradedRegistry.getHistoryById(proofPointId);

//     // events from before the upgrade should be present
//     expect(history.length).to.eq(2);
//   });
// });
