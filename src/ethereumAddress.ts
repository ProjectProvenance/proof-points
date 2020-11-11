import ethers from "ethers";

class EthereumAddress {
  private _addr: string;

  static parse(input: string): EthereumAddress {
    return new EthereumAddress(ethers.utils.getAddress(input));
  }

  toString(): string {
    return this._addr;
  }

  private constructor(addr: string) {
    this._addr = addr;
  }
}

export { EthereumAddress };
