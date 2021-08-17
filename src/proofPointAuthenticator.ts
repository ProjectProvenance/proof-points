import { EthereumAddressResolver } from "./ethereumAddressResolver";
import {
  EthereumProofPointRegistry,
  ETHEREUM_PROOF_TYPE,
} from "./ethereumProofPointRegistry";
import { ProofPoint } from "./proofPoint";
import { ProofPointId } from "./proofPointId";
import { ProofPointStatus } from "./proofPointStatus";
import { ProofPointValidateResult } from "./proofPointValidateResult";

/**
 * Proof point authenticator
 * An object capable of authenticating a proof point.
 */
export interface ProofPointAuthenticator {
  /**
   * Determines whether the given proof point is authentic.
   * @param id The ID of the proof point to check.
   * @param proofPoint The proof point to check.
   * @returns true if the proof point is authentic.
   */
  authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult>;
}

/**
 * Ethereum proof point authenticator
 * A @ProofPointAuthenticator capable of handling Ethereum authenticated proof points.
 */
export class EthereumProofPointAuthenticator {
  private _registry: EthereumProofPointRegistry;
  private _ethereumAddressResolver: EthereumAddressResolver;

  public constructor(
    registry: EthereumProofPointRegistry,
    ethereumAddressResolver: EthereumAddressResolver
  ) {
    this._registry = registry;
    this._ethereumAddressResolver = ethereumAddressResolver;
  }

  async authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult> {
    if (proofPoint.proof.type !== ETHEREUM_PROOF_TYPE) {
      return {
        isValid: false,
        proofPoint: proofPoint,
        statusCode: ProofPointStatus.BadlyFormed,
        statusMessage: "The Proof Point uses an unsupported proof type.",
      };
    }

    if (!this._registry.isSameRegistry(proofPoint)) {
      return {
        isValid: false,
        proofPoint: proofPoint,
        statusCode: ProofPointStatus.NonTrustedRegistry,
        statusMessage:
          "The Proof Point is issued using a registry that is not trusted in this context.",
      };
    }

    const issuerAddress = await this._ethereumAddressResolver.resolve(
      proofPoint.issuer
    );

    if (issuerAddress === null) {
      return {
        isValid: false,
        proofPoint: proofPoint,
        statusCode: ProofPointStatus.UnknownIssuer,
        statusMessage: `The issuer '${proofPoint.issuer}' could not be resolved to an Ethereum address.`,
      };
    }

    const isAuthentic = await this._registry.isAuthentic(id, issuerAddress);

    if (isAuthentic) {
      return {
        isValid: true,
        proofPoint: proofPoint,
        statusCode: ProofPointStatus.Valid,
        statusMessage: null,
      };
    } else {
      return {
        isValid: false,
        proofPoint: proofPoint,
        statusCode: ProofPointStatus.NotFound,
        statusMessage: "The Proof Point cannot be authenticated.",
      };
    }
  }
}
