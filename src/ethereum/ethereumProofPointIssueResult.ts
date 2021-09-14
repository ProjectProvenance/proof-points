import { ProofPoint } from "../proofPoint";
import { ProofPointId } from "../proofPointId";
import { EthereumTransactionHash } from "./ethereumTransactionHash";

export interface EthereumProofPointIssueResult {
  proofPointId: ProofPointId;
  transactionHash: EthereumTransactionHash;
  proofPointObject: ProofPoint;
}
