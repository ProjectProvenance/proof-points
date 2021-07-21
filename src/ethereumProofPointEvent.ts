import { EthereumProofPointEventType } from "./ethereumProofPointEventType";
import { EthereumAddress } from "./ethereumAddress";
import { ProofPointId } from "./proofPointId";
import { EthereumTransactionHash } from "./ethereumTransactionHash";

/**
 * Proof Point event, describes a single event in the history of a Proof Point.
 */
interface EthereumProofPointEvent {
  /**
   * The blockchain block number at which the event occurred.
   * */
  blockNumber: number;
  /**
   * The type of event e.g. Issued, Revoked etc.
   */
  type: EthereumProofPointEventType;
  /**
   * The sender address that initiated the event.
   */
  issuer: EthereumAddress;
  /**
   * The ID of the Proof Point.
   */
  proofPointId: ProofPointId;
  /**
   * The Ethereum transaction hash of the transaction that emitted this event
   */
  transactionHash: EthereumTransactionHash;
}

export {
  EthereumProofPointEvent,
  EthereumAddress,
  ProofPointId,
  EthereumTransactionHash,
};
