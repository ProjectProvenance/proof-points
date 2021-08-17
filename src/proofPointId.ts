/**
 * Proof point id type
 */
enum ProofPointIdType {
  // The ID is an IPFS document ID. The proof point will be authenticated using Ethereum authentication.
  Ipfs,
}

/**
 * Proof point id
 * A unique identifier for a proof point.
 */
class ProofPointId {
  private _id: string;
  private _type: ProofPointIdType;

  static parse(input: string): ProofPointId {
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(input)) {
      return new ProofPointId(input, ProofPointIdType.Ipfs);
    }

    throw new Error(`Invalid Proof Point ID: ${input}`);
  }

  getType(): ProofPointIdType {
    return this._type;
  }

  toString(): string {
    return this._id;
  }

  equals(other: ProofPointId): boolean {
    return this._id === other._id;
  }

  private constructor(id: string, type: ProofPointIdType) {
    this._id = id;
    this._type = type;
  }
}

export { ProofPointId, ProofPointIdType };
