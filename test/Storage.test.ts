import { expect } from "chai";
import {
  IpfsStorageProvider,
  IpfsStorageProviderSettings,
} from "../dist/src/storage";

const IPFS_OPTIONS: IpfsStorageProviderSettings = {
  host: "localhost",
  port: 5001,
};

const digest = "QmemSCLVMGoqsC21mgJJh2FJAzvv5aRTeVnBXXnnKmQuXd";
const docInBytes = '{"quantity":42,"name":"British Gladioli","unit":""}';

describe("IPFSProvider", () => {
  let storageProvider: IpfsStorageProvider;
  beforeEach(() => {
    storageProvider = new IpfsStorageProvider(IPFS_OPTIONS);
  });
  it("should have get and add methods", () => {
    expect(typeof storageProvider.get).to.equal("function");
    expect(typeof storageProvider.add).to.equal("function");
  });
  it("should return the digest when adding the doc", async () => {
    const res = await storageProvider.add(docInBytes);
    expect(res.digest).to.equal(digest);
  });
  it("should return the doc when getting the digest", async () => {
    const res = await storageProvider.get(digest);
    expect(res.data).to.deep.equal(docInBytes);
  });
});
