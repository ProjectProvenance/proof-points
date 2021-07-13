import { EthereumAddress, ProofPointId } from "./proofPointEvent";
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

export class ProofPointValidator {
  _resolver: ProofPointResolver;
  _authenticator: ProofPointAuthenticator;

  public static async production(
    registryRootAddress: EthereumAddress,
    ethereumProvider: ethers.providers.JsonRpcProvider,
    ipfsSettings: IpfsStorageProviderSettings
  ): Promise<ProofPointValidator> {
    const registryRoot = new EthereumProofPointRegistryRoot(
      registryRootAddress,
      ethereumProvider
    );
    const registry = await registryRoot.getRegistry();
    const httpClient = new RealHttpClient();
    const ethereumAddressResolver = new EthereumAddressResolver(httpClient);
    const ipfs = new IpfsStorageProvider(ipfsSettings);
    const proofPointResolver = new GeneralProofPointResolver(httpClient, ipfs);
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

  public async validate(id: ProofPointId): Promise<ProofPointValidateResult> {
    const proofPoint = await this._resolver.resolve(id);

    if (typeof proofPoint.validFrom !== "undefined") {
      const validFromDate = Date.parse(proofPoint.validFrom);
      if (validFromDate > Date.now()) {
        return {
          isValid: false,
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
  }
}
