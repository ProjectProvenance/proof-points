import { ethers, Contract } from "ethers";
import ProofPointRegistryStorage1Abi from "../build/ProofPointRegistryStorage1.json";
import {
  EthereumProofPointRegistry,
  PROOF_POINT_REGISTRY_VERSION,
  ProofPointRegistryAbi,
} from "./ethereumProofPointRegistry";
import { EthereumAddress } from "./proofPointEvent";

/**
 * Proof point registry root
 * Represents the eternal storage contract of the ProofPointRegistry, which has a well known address
 * and provides methods to deploy and upgrade the logic contract as well as to get a proxy to the logic
 * contract by looking up its address in the eternal storage contract.
 */
export class EthereumProofPointRegistryRoot {
  private _address: EthereumAddress;
  private _contract: Contract;
  private _provider: ethers.providers.JsonRpcProvider;

  /**
   * Creates an instance of proof point registry root.
   * @param address the well-known address of the deployed eternal storage contract.
   * @param provider an ethers.providers.JsonRpcProvider to use for interacting with the blockchain.
   */
  constructor(
    address: EthereumAddress,
    provider: ethers.providers.JsonRpcProvider
  ) {
    this._address = address;
    this._provider = provider;
    this._contract = new Contract(
      this._address.toString(),
      ProofPointRegistryStorage1Abi.abi,
      provider
    );
  }

  /**
   * Gets an instance of ProofPointRegistry representing the current logic contract that is controlling
   * this eternal storage contract.
   * @returns An instance of @EthereumProofPointRegistry to use for interacting with proof points.
   */
  async getRegistry(): Promise<EthereumProofPointRegistry> {
    const logicAddress = EthereumAddress.parse(await this._contract.getOwner());
    const registry = new EthereumProofPointRegistry(
      this._address,
      logicAddress,
      this._provider
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
    provider: ethers.providers.JsonRpcProvider,
    from: EthereumAddress
  ): Promise<EthereumProofPointRegistryRoot> {
    const signer = provider.getSigner(from.toString());

    // deploy eternal storage contract
    let factory = new ethers.ContractFactory(
      ProofPointRegistryStorage1Abi.abi,
      ProofPointRegistryStorage1Abi.bytecode,
      signer
    );
    const eternalStorage = await factory.deploy();

    // deploy logic contract pointing to eternal storage
    factory = new ethers.ContractFactory(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi,
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode,
      signer
    );
    const logic = await factory.deploy(eternalStorage.address);

    // set logic contract as owner of eternal storage
    await eternalStorage.setOwner(logic.address);

    // construct and return a ProofPointRegistry object for the newly deployed setup
    const registryRoot = new EthereumProofPointRegistryRoot(
      EthereumAddress.parse(eternalStorage.address),
      provider
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
    const admin = await this._contract.getAdmin();

    // deploy logic contract pointing to eternal storage
    const signer = this._provider.getSigner(admin);
    const factory = new ethers.ContractFactory(
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi,
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].bytecode,
      signer
    );
    const logic = await factory.deploy(this._address.toString());

    // set logic contract as owner of eternal storage
    const contractWithSigner = this._contract.connect(signer);
    await contractWithSigner.setOwner(logic.address);
  }

  private async getLogicContractVersion(): Promise<number> {
    const logicAddress = await this._contract.getOwner();
    const registry = new ethers.Contract(
      logicAddress,
      ProofPointRegistryAbi[PROOF_POINT_REGISTRY_VERSION].abi,
      this._provider
    );

    try {
      const version = await registry.getVersion();
      return version;
    } catch (e) {
      // version 1 does not have the getVersion method.
      return 1;
    }
  }
}
