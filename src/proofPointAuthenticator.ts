import { ProofPoint } from "./proofPoint";
import { ProofPointId } from "./proofPointId";
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
   * @returns True if the proof point is authentic.
   */
  authenticate(
    id: ProofPointId,
    proofPoint: ProofPoint
  ): Promise<ProofPointValidateResult>;
}
