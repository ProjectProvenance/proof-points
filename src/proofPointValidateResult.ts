import { ProofPointStatus } from "./proofPointStatus";

interface ProofPointValidateResult {
  isValid: boolean;
  statusCode: ProofPointStatus;
  statusMessage: string | null;
}

export { ProofPointValidateResult };
