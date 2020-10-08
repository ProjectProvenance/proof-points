import Web3 from "web3";

class EthereumAddress {
  private _addr: string;

  static parse(input: string): EthereumAddress {
    if (!Web3.utils.isAddress(input)) {
      throw new Error("Invalid Ethereum address");
    }

    if (!Web3.utils.checkAddressChecksum(input)) {
      throw new Error("Invalid checksum");
    }

    return new EthereumAddress(input);
  }

  toString(): string {
    return this._addr;
  }

  private constructor(addr: string) {
    this._addr = addr;
  }
}

export { EthereumAddress };
