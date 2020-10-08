/**
 * Proof point represents all the data associated with a proof point document according to the specification.
 * See `docs/specification.md` for more info.
 */
interface ProofPoint {
  "@context": Array<string>;
  type: Array<string>;
  issuer: string;
  credentialSubject: unknown;
  proof: {
    type: string;
    registryRoot: string;
    proofPurpose: string;
    verificationMethod: string;
  };
  validFrom: string;
  validUntil: string;
}

export { ProofPoint };
