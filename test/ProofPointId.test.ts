import { expect } from "chai";
import { ProofPointId } from "../src/index";
import { ProofPointIdType } from "../src/proofPointId";

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
});
