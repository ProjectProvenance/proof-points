import { ProofPoint } from "./proofPoint";
import { ProofPointId } from "./proofPointId";
import { ProofPointValidateResult } from "./proofPointValidateResult";
import { ProofPointStatus } from "./proofPointStatus";

/**
 * Proof point authenticator
 * An object capable of authenticating a proof point.
 */
interface ProofPointAuthenticator {
  /**
   * Determines whether the given proof point is authentic.
   * @param id The ID of the proof point to check.
   * @param proofPoint The proof point to check.
   * @returns True if the proof point is authentic.
   */
  authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult>;
}

class DummyProofPointAuthenticator {
  async authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult> {
    return {
      isValid: true,
      proofPoint: proofPoint,
      statusCode: ProofPointStatus.Valid,
      statusMessage: null,
    };
  }
}

export { ProofPointAuthenticator, DummyProofPointAuthenticator };
