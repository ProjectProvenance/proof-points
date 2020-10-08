import { Contract } from "web3-eth-contract";
import Web3 from "web3";

import ProofPointRegistryStorage1Abi from "../build/contracts/ProofPointRegistryStorage1.json";
import { StorageProvider } from "./storage";
import {
  ProofPointRegistry,
  PROOF_POINT_REGISTRY_VERSION,
  ProofPointRegistryAbi,
  GAS_LIMIT,
} from "./proofPointRegistry";
import { HttpClient } from "./httpClient";
import { EthereumAddress } from "./proofPointEvent";

/**
 * Proof point registry root
 * Represents the eternal storage contract of the ProofPointRegistry, which has a well known address
 * and provides methods to deploy and upgrade the logic contract as well as to get a proxy to the logic
 * contract by looking up its address in the eternal storage contract.
 */
class ProofPointRegistryRoot {
  private _web3: Web3;
  private _address: EthereumAddress;
  private _contract: Contract;

  constructor(address: EthereumAddress, web3: Web3) {
    this._address = address;
    this._web3 = web3;
    this._contract = new this._web3.eth.Contract(
      ProofPointRegistryStorage1Abi.abi as any,
      this._address.toString(),
      { data: ProofPointRegistryStorage1Abi.bytecode }
    );
  }

  /**
   * Gets an instance of ProofPointRegistry representing the current logic contract that is controlling
   * this eternal storage contract.
   * @param storage A @StorageProvider to use for storing and retrieving bulk data.
   * @param httpClient An @HttpClient to use for fetching DID documents.
   * @returns An instance of @ProofPointRegistry to use for interacting with proof points.
   */
  async getRegistry(
    storage: StorageProvider | null = null,
    httpClient: HttpClient | null = null
  ): Promise<ProofPointRegistry> {
    const logicAddress = await this._contract.methods.getOwner().call();
    const registry = new ProofPointRegistry(
      logicAddress,
      this._web3,
      storage,
      httpClient
    );

    return registry;
  }

  /**
   * Gets the address of the registry root - which is the address of the eternal storage contract.
   * @returns address of registry root.
   */
  getAddress(): EthereumAddress {
    return this._address;
  }

  /**
   * Determines whether the deployed logic contract is the latest known version. If not then the
   * {@link upgrade} method can be called to deploy the latest logic contract and update the plumbing
   * so that the latest version will be used for future interactions.
   * @returns true if the {@link upgrade} method can be called to upgrade the logic contract.
   */
  async canUpgrade(): Promise<boolean> {
    const version = await this.getLogicContractVersion();
    return version < PROOF_POINT_REGISTRY_VERSION;
  }

  /**
   * Deploys an instance of the Proof Point registry, including an eternal storage contract and a logic
   * contract.
   * @param fromAddress the Ethereum account to use for signing transactions. This will become the admin account that must be used for all future smart contract upgrades.
   * @param web3 a web3 instance to use for interacting with the Ethereum blockchain.
   * @returns a {@link ProofPointRegistryRoot} for interacting with the newly deployed contracts.
   */
  static async deploy(
    fromAddress: EthereumAddress,
    web3: Web3
  ): Promise<ProofPointRegistryRoot> {
    // deploy eternal storage contract
    const eternalStorageContract = new web3.eth.Contract(
      ProofPointRegistryStorage1Abi.abi as any
    );
    const eternalStorage = await eternalStorageContract
      .deploy({ data: ProofPointRegistryStorage1Abi.bytecode })
      .send({ from: fromAddress.toString(), gas: GAS_LIMIT });

    // deploy logic contract pointing to eternal storage
    const logicContract = new web3.eth.Contract(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi as any
    );
    const logic = await logicContract
      .deploy({
        data: ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode,
        arguments: [eternalStorage.options.address],
      })
      .send({ from: fromAddress.toString(), gas: GAS_LIMIT });

    // set logic contract as owner of eternal storage
    await eternalStorage.methods
      .setOwner(logic.options.address)
      .send({ from: fromAddress.toString(), gas: GAS_LIMIT });

    // construct and return a ProofPointRegistry object for the newly deployed setup
    const registryRoot = new ProofPointRegistryRoot(
      EthereumAddress.parse(eternalStorage.options.address),
      web3
    );

    return registryRoot;
  }

  /**
   * Upgrades Proof Point registry. Performs the upgrade procedure to deploy an instance of the latest
   * logic contract, then set that as the owner of the eternal storage contract. You must control the admin
   * account to do this. Throws if already at latest version. Use {@link canUpgrade} to determine whether
   * this method can be called.
   */
  async upgrade(): Promise<void> {
    if (!(await this.canUpgrade())) {
      throw new Error(
        "Cannot upgrade Proof Point registry: Already at or above current version."
      );
    }

    // get the admin account from which to perform the upgrade
    const admin = await this._contract.methods.getAdmin().call();

    // deploy logic contract pointing to eternal storage
    const logicContract = new this._web3.eth.Contract(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi as any
    );
    const logic = await logicContract
      .deploy({
        data: ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode,
        arguments: [this._address],
      })
      .send({ from: admin, gas: GAS_LIMIT });

    // set logic contract as owner of eternal storage
    await this._contract.methods
      .setOwner(logic.options.address)
      .send({ from: admin, gas: GAS_LIMIT });
  }

  private async getLogicContractVersion(): Promise<number> {
    const logicAddress = await this._contract.methods.getOwner().call();
    const registry = new this._web3.eth.Contract(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi as any,
      logicAddress,
      { data: ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode }
    );

    try {
      const version = await registry.methods.getVersion().call();
      return version;
    } catch (e) {
      // version 1 does not have the getVersion method.
      return 1;
    }
  }
}

export { ProofPointRegistryRoot };
