class EthereumTransactionHash {
  private _hash: string;

  static parse(input: string): EthereumTransactionHash {
    if (!/^0x[a-z0-9]{64}$/.test(input)) {
      throw new Error("Invalid Ethereum transaction hash");
    }

    return new EthereumTransactionHash(input);
  }

  toString(): string {
    return this._hash;
  }

  equals(other: EthereumTransactionHash): boolean {
    return this._hash === other._hash;
  }

  private constructor(hash: string) {
    this._hash = hash;
  }
}

export { EthereumTransactionHash };
