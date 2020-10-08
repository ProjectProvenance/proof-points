import { ProofPoint } from "./proofPoint";
import { EthereumTransactionHash, ProofPointId } from "./proofPointEvent";

interface ProofPointIssueResult {
  proofPointId: ProofPointId;
  transactionHash: EthereumTransactionHash;
  proofPointObject: ProofPoint;
}

export { ProofPointIssueResult };
