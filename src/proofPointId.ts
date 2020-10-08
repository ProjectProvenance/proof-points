class ProofPointId {
  private _id: string;

  static parse(input: string): ProofPointId {
    if (!/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(input)) {
      throw new Error(`Invalid Proof Point ID: ${input}`);
    }

    return new ProofPointId(input);
  }

  toString(): string {
    return this._id;
  }

  equals(other: ProofPointId): boolean {
    return this._id === other._id;
  }

  private constructor(id: string) {
    this._id = id;
  }
}

export { ProofPointId };
