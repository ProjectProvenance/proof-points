import { EthereumAddress, ProofPointId } from "./ethereumProofPointEvent";
import { ProofPointValidateResult } from "./proofPointValidateResult";
import {
  GeneralProofPointResolver,
  ProofPointResolver,
} from "./proofPointResolver";
import { ProofPointStatus } from "./proofPointStatus";
import {
  GeneralProofPointAuthenticator,
  ProofPointAuthenticator,
} from "./proofPointAuthenticator";
import { ethers } from "ethers";
import { EthereumProofPointRegistryRoot } from ".";
import { RealHttpClient } from "./httpClient";
import { EthereumAddressResolver } from "./ethereumAddressResolver";
import { IpfsStorageProvider, IpfsStorageProviderSettings } from "./storage";
import { EthereumProofPointRegistry } from "./ethereumProofPointRegistry";

/**
 * Proof point validator
 * Used to validate proof points.
 */
export class ProofPointValidator {
  _resolver: ProofPointResolver;
  _authenticator: ProofPointAuthenticator;

  /**
   * Construct a @ProofPointValidator for production use
   * @param registryRootAddress The Ethereum address of a proof point registry
   * @param ethereumProvider A provider to use for Ethereum interactions
   * @param ipfsSettings connection settings for an IPFS node to use for storage
   * @param registryAddress Optional, if provided will be used as the registry address, meaning
   * the address will not be looked up in the storage contract, saving one Ethereum call.
   * @returns a ready to use @ProofPointValidator capable of validating all types of proof point.
   */
  public static async production(
    registryRootAddress: EthereumAddress,
    ethereumProvider: ethers.providers.JsonRpcProvider,
    ipfsSettings: IpfsStorageProviderSettings,
    registryAddress?: EthereumAddress
  ): Promise<ProofPointValidator> {
    const registryRoot = new EthereumProofPointRegistryRoot(
      registryRootAddress,
      ethereumProvider
    );
    const registry = registryAddress
      ? new EthereumProofPointRegistry(
          registryRootAddress,
          registryAddress,
          ethereumProvider
        )
      : await registryRoot.getRegistry();
    const httpClient = new RealHttpClient();
    const ethereumAddressResolver = new EthereumAddressResolver(httpClient);
    const ipfs = new IpfsStorageProvider(ipfsSettings);
    const proofPointResolver = new GeneralProofPointResolver(ipfs);
    const proofPointAuthenticator = new GeneralProofPointAuthenticator(
      registry,
      ethereumAddressResolver
    );
    const proofPointValidator = new ProofPointValidator(
      proofPointResolver,
      proofPointAuthenticator
    );

    return proofPointValidator;
  }

  public constructor(
    resolver: ProofPointResolver,
    authenticator: ProofPointAuthenticator
  ) {
    this._resolver = resolver;
    this._authenticator = authenticator;
  }

  /**
   * Determines the validity of a given proof point
   * @param id the ID of the proof point to validate.
   * @returns a @ProofPointValidateResult representing the validity of the given proof point.
   */
  public async validate(id: ProofPointId): Promise<ProofPointValidateResult> {
    try {
      const proofPoint = await this._resolver.resolve(id);

      if (typeof proofPoint.validFrom !== "undefined") {
        const validFromDate = Date.parse(proofPoint.validFrom);
        if (validFromDate > Date.now()) {
          return {
            isValid: false,
            proofPoint: proofPoint,
            statusCode: ProofPointStatus.Pending,
            statusMessage: "The Proof Point will become valid at a later date.",
          };
        }
      }

      if (typeof proofPoint.validUntil !== "undefined") {
        const validUntilDate = Date.parse(proofPoint.validUntil);
        if (validUntilDate < Date.now()) {
          return {
            isValid: false,
            proofPoint: proofPoint,
            statusCode: ProofPointStatus.Expired,
            statusMessage: "The Proof Point has expired.",
          };
        }
      }

      const authenticationResult = await this._authenticator.authenticate(
        id,
        proofPoint
      );

      return authenticationResult;
    } catch (e) {
      return {
        isValid: false,
        statusCode: ProofPointStatus.NotFound,
        statusMessage: `The Proof Point ${id.toString()} could not be resolved.`,
      };
    }
  }
}
