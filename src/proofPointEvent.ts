import { ProofPointEventType } from "./proofPointEventType";
import { EthereumAddress } from "./ethereumAddress";
import { ProofPointId } from "./proofPointId";
import { EthereumTransactionHash } from "./ethereumTransactionHash";

/**
 * Proof Point event, describes a single event in the history of a Proof Point.
 */
interface ProofPointEvent {
  /**
   * The blockchain block number at which the event occurred.
   * */
  blockNumber: number;
  /**
   * The type of event e.g. Issued, Revoked etc.
   */
  type: ProofPointEventType;
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
  ProofPointEvent,
  EthereumAddress,
  ProofPointId,
  EthereumTransactionHash,
};
