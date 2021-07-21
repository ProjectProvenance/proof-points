import { ProofPoint } from "./proofPoint";
import {
  EthereumTransactionHash,
  ProofPointId,
} from "./ethereumProofPointEvent";

interface ProofPointIssueResult {
  proofPointId: ProofPointId;
  transactionHash: EthereumTransactionHash;
  proofPointObject: ProofPoint;
}

export { ProofPointIssueResult };
