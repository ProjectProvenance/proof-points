import { ProofPoint } from "./proofPoint";
import { ProofPointId } from "./proofPointId";

/**
 * Proof point resolver
 * An object capable of resolving a @ProofPointId to a @ProofPoint
 */
export interface ProofPointResolver {
  /**
   * Resolve the given @PRoofPointId
   * @param id The ID of the proof point to resolve
   * @returns The @ProofPoint corresponding to the given ID.
   */
  resolve(id: ProofPointId): Promise<ProofPoint>;
}
