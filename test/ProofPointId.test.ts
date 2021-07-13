import { expect } from "chai";
import { ProofPointId } from "../dist/src/index";
import { ProofPointIdType } from "../dist/src/proofPointId";

describe("ProofPointId", () => {
  it("Can be constructed from IPFS address", () => {
    const subject = ProofPointId.parse(
      "QmPyAqBVEgEt9VP7sBwMKmfAsUnZRYJ4YMKzsMk4ASpjfi"
    );
    expect(subject.getType()).to.eq(ProofPointIdType.Ipfs);
  });

  it("Cannot be constructed from arbitrary string", () => {
    try {
      ProofPointId.parse("AAPyAqBVEgEt9VP7sBwMKmfAsUnZRYJ4YMKzsMk4ASpjfi");
    } catch (e) {}

    expect(false);
  });

  it("Can be constructed from HTTPS URL", () => {
    const subject = ProofPointId.parse("https://example.com:80/a/b?c=d");
    expect(subject.getType()).to.eq(ProofPointIdType.Web);
  });

  it("Cannot be constructed from HTTP URL", () => {
    try {
      ProofPointId.parse("http://example.com/a");
    } catch (e) {}

    expect(false);
  });
});
