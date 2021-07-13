import { EthereumAddressResolver } from "./ethereumAddressResolver";
import {
  EthereumProofPointRegistry,
  ETHEREUM_PROOF_TYPE,
} from "./ethereumProofPointRegistry";
import { ProofPoint } from "./proofPoint";
import { ProofPointId, ProofPointIdType } from "./proofPointId";
import { ProofPointStatus } from "./proofPointStatus";
import { ProofPointValidateResult } from "./proofPointValidateResult";

export interface ProofPointAuthenticator {
  authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult>;
}

export class GeneralProofPointAuthenticator {
  private _ethereumAuthenticator: EthereumProofPointAuthenticator;
  private _webAuthenticator: WebProofPointAuthenticator;

  constructor(
    registry: EthereumProofPointRegistry,
    ethereumAddressResolver: EthereumAddressResolver
  ) {
    this._webAuthenticator = new WebProofPointAuthenticator();
    this._ethereumAuthenticator = new EthereumProofPointAuthenticator(
      registry,
      ethereumAddressResolver
    );
  }

  authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult> {
    switch (id.getType()) {
      case ProofPointIdType.Ipfs:
        return this._ethereumAuthenticator.authenticate(id, proofPoint);
      case ProofPointIdType.Web:
        return this._webAuthenticator.authenticate(id, proofPoint);
      default:
        throw `Unexpected ID type: ${id.getType()}`;
    }
  }
}

class WebProofPointAuthenticator {
  private PROOF_TYPE =
    "https://open.provenance.org/ontology/ptf/v2/ProvenanceProofTypeWeb1";

  public async authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult> {
    if (id.getType() !== ProofPointIdType.Web) {
      throw `Unexpected ID type: ${id.getType()}`;
    }

    if (proofPoint.proof.type !== this.PROOF_TYPE) {
      return {
        isValid: false,
        statusCode: ProofPointStatus.BadlyFormed,
        statusMessage: "The Proof Point uses an unsupported proof type.",
      };
    }

    const sourceUrl = new URL(id.toString());
    const expectedIssuerId = `did:web:${sourceUrl.hostname}`;
    const actualIssuerId = proofPoint.issuer;
    const isAuthentic = actualIssuerId == expectedIssuerId;

    if (isAuthentic) {
      return {
        isValid: true,
        statusCode: ProofPointStatus.Valid,
        statusMessage: null,
      };
    } else {
      return {
        isValid: false,
        statusCode: ProofPointStatus.NotFound,
        statusMessage: "The Proof Point cannot be authenticated.",
      };
    }
  }
}

class EthereumProofPointAuthenticator {
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
        statusCode: ProofPointStatus.BadlyFormed,
        statusMessage: "The Proof Point uses an unsupported proof type.",
      };
    }

    if (!this._registry.isSameRegistry(proofPoint)) {
      return {
        isValid: false,
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
        statusCode: ProofPointStatus.UnknownIssuer,
        statusMessage: `The issuer '${proofPoint.issuer}' could not be resolved to an Ethereum address.`,
      };
    }

    const isAuthentic = await this._registry.isAuthentic(id, issuerAddress);

    if (isAuthentic) {
      return {
        isValid: true,
        statusCode: ProofPointStatus.Valid,
        statusMessage: null,
      };
    } else {
      return {
        isValid: false,
        statusCode: ProofPointStatus.NotFound,
        statusMessage: "The Proof Point cannot be authenticated.",
      };
    }
  }
}
