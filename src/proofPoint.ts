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
