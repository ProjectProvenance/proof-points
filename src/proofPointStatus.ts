export enum ProofPointStatus {
  /**
   * The Proof Point object is badly formed. The Proof Point is invalid.
   */
  BadlyFormed,
  /**
   * The validFrom date is in the future. The Proof Point is invalid.
   */
  Pending,
  /**
   * The validUntil date is in the past. The Proof Point is invalid.
   */
  Expired,
  /**
   * The proof.registryRoot field references a smart contract that is not a whitelisted Proof Point registry,
   * the validation provided is not trusted so the Proof Point is considered invalid.
   */
  NonTrustedRegistry,
  /**
   * The Proof Point registry smart contract does not contain this Proof Point issued by this issuer. Either
   * the issuer never issued the Proof Point or it was issued and later revoked by the issuer. The proof
   * point is invalid.
   */
  NotFound,
  /**
   * The issuer of the Proof Point could not be resolved to an Ethereum address
   */
  UnknownIssuer,
  /**
   * The Proof Point has passed all of the validation checks. If you trust the issuer you can trust the meaning
   * of the Proof Point.
   */
  Valid,
}
