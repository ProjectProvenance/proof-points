const chai = require("chai");
const expectToBeAPromise = require("expect-to-be-a-promise");
const { IpfsStorageProvider } = require("../dist/src/storage");

const { expect } = chai;

chai.use(expectToBeAPromise);

const IPFS_OPTIONS = {
  host: "localhost",
  port: "5001",
};

const digest = "QmemSCLVMGoqsC21mgJJh2FJAzvv5aRTeVnBXXnnKmQuXd";
const docInBytes = '{"quantity":42,"name":"British Gladioli","unit":""}';

describe("IPFSProvider", () => {
  let storageProvider;
  beforeEach(() => {
    storageProvider = new IpfsStorageProvider(IPFS_OPTIONS);
  });
  it("should have get and add methods", () => {
    expect(typeof storageProvider.get).to.equal("function");
    expect(typeof storageProvider.add).to.equal("function");
  });

  it("should return promises when doing calls", () => {
    expect(storageProvider.add(docInBytes)).to.be.a.promise;
    expect(storageProvider.get(digest)).to.be.a.promise;
  });
  it("should return the digest when adding the doc", () =>
    storageProvider.add(docInBytes).then((res) => {
      expect(res.digest).to.equal(digest);
    }));
  it("should return the doc when getting the digest", () =>
    storageProvider
      .get(digest)
      .then((res) => {
        expect(res.data).to.deep.equal(docInBytes);
      })
      .catch((e) => {
        expect(e).to.not.exist;
      }));
});
