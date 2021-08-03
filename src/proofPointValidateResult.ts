import { ProofPoint } from "./proofPoint";
import { ProofPointStatus } from "./proofPointStatus";

interface ProofPointValidateResult {
  isValid: boolean;
  proofPoint?: ProofPoint;
  statusCode: ProofPointStatus;
  statusMessage: string | null;
}

export { ProofPointValidateResult };
