enum ProofPointIdType {
  Ipfs,
  Web,
}

class ProofPointId {
  private _id: string;
  private _type: ProofPointIdType;

  static parse(input: string): ProofPointId {
    if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(input)) {
      return new ProofPointId(input, ProofPointIdType.Ipfs);
    }

    try {
      const url = new URL(input);
      if (url.protocol !== "https:") {
        throw new Error(`Invalid Proof Point ID: ${input}`);
      }

      return new ProofPointId(input, ProofPointIdType.Web);
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error(`Invalid Proof Point ID: ${input}`);
      }
      throw e;
    }
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
