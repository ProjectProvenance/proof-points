<!-- vscode-markdown-toc -->
* 1. [Proof Point Document Format](#ProofPointDocumentFormat)
* 2. [Proof Point Issuer](#ProofPointIssuer)
* 3. [Issue](#Issue)
* 4. [Revoke](#Revoke)
* 5. [Validate](#Validate)

<!-- vscode-markdown-toc-config
	numbering=true
	autoSave=true
	/vscode-markdown-toc-config -->
<!-- /vscode-markdown-toc -->

> **TODO** specify specific claim types, host human and machine readable claim type descriptions at the claim type IRIs

# Provenance Proof Points Version 2 Specification

The Provenance Proof Point 2 system is an implementation of the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) specification that can be used by an authority to issue, present and revoke credentials.

The issuer is represented by an internet domain name, so that any entity that has control over an internet domain name may be an issuer and any reputation and trust that is placed in the domain name may be transferred to the Proof Point.

Any party with internet access may authenticate a presented credential.

The system has the following properties:

- A Proof Point is a claim by an `issuer` that a given property or relation is held by one or more `subject`s
- The Proof Point is a self-describing JSON document that meets the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) specification.
- The Proof Point is identified by an ID which is a URL using the HTTPS protocol.
- The `issuer` is represented by an internet domain name.
- The `subject` may be represented by any URI
- The system supports three functions
  1. `issue` by which an `issuer` may create and publish a new Proof Point
  2. `revoke` by which the `issuer` of an `issue`d Proof Point may revoke it, meaning that is it no longer valid and will subsequently fail the `validate` process.
  3. `validate` by which anyone presented with a Proof Point may verify that it was `issue`d by the named `issuer` and has not subsequently been revoked.
- A Proof Point may be issued by any entity that is represented by an internet domain name and has the capability to serve documents within that domain using the HTTPS protocol.
- A Proof Point can be validated by any entity with the capability to fetch documents over the HTTPS protocol.
- An issued Proof Point may be modified or revoked only by the `issuer`.

##  1. <a name='ProofPointDocumentFormat'></a>Proof Point Document Format

The JSON document form of the Proof Point is an implementation of the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) with a special, Provenance specific `proof` type as defined here.

```
{
  "id": "<id>",
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://open.provenance.org/ontology/ptf/v2"
  ],
  "type": ["VerifiableCredential", "<type>"],
  "issuer": "<issuer>",
  "validFrom": "<valid-from-date>",
  "validUntil": "<valid-until-date>",
  "credentialSubject": [
    {
      "id": "<subject>",
      <type-specific-data>
    }
    ...
  ], ,
  "proof": {
    "type": "https://open.provenance.org/ontology/ptf/v2#ProvenanceProofType2",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "<id>"
  }
}
```

| Token | Meaning |
|-------|---------|
| `type` | An IRI representing the type of claim being made. This defines the meaning of the claim as well as defining what fields should be expected in the `type-specific-data` |
| `issuer` | The identity of the issuer represented as an internet domain name. |
| `valid-from-date` | Optional, the date from which the claim is valid, in [RFC3339](https://tools.ietf.org/html/rfc3339) format. If present this will be checked as part of validation |
| `valid-until-date` | Optional, the date until which the claim is valid, in [RFC3339](https://tools.ietf.org/html/rfc3339) format. If present this will be checked as part of validation |
| `subject` | A URL identifying the subject of the claim. |
| `type-specific-data` | Data fields specific to the `type` which serve to further specify the meaning of the claim |
| `id` | An HTTPS URL identifying this Proof Point and which can be used to validate it. See [Validate](#Validate). 

> **Note** The `method` field of the `proof` is what makes this W3C Verifiable Credential a Proof Point. The identifier `https://open.provenance.org/ontology/ptf/v2#ProvenanceProofType2` specifies the proof method defined in this document.

An example claim document:

```
{
  "id": "https://example.com/proof-points/1",
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://open.provenance.org/ontology/ptf/v2"
  ],
  "type": ["VerifiableCredential", "CertificationClaim"],
  "issuer": "example.com",
  "validFrom": "2018-01-01T00:00:00",
  "validUntil": "2020-01-01T00:00:00",
  "credentialSubject": [
    {
      "id": "https://www.provenance.org/users/great-beer-co",
      "certification": "https://provenance.org/ontology/ptf/v2/certifications/ava-certified-vegetarian"
    }
  ],
  "proof": {
    "type": "https://open.provenance.org/ontology/ptf/v2#ProvenanceProofType2",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "https://example.com/proof-points/1"
  }
}
```

##  3. <a name='Issue'></a>Issue

Issuing is the process by which an entity publicly expresses a claim in the form of a Proof Point.

To issue a new Proof Point the following process is used:

1. Determine the `<issuer>`, `<subject>`, `<type>`, `<type-specific-data>`, `<valid-from-date>` (optional), `<valid-until-date>` (optional) and `<id>`. The `<issuer>` must be an internet domain that you control. The issued claim will only be valid between the `<valid-from-date>` and `<valid-until-date>` if present.
2. Construct a JSON document according to the [Proof Point Document Format](#ProofPointDocumentFormat)
3. Begin to serve the JSON document at the URL `<id>`.

The `<id>` now represents a valid Proof Point and may be published or transmitted to a holder or validator.

##  4. <a name='Revoke'></a>Revoke

Revoking is the process by which an issuer withdraws a claim previously made in the form of a Proof Point.

To revoke a Proof Point the following process is used:

> **Note** Only the `issuer` can revoke a Proof Point

1. Identify the `<id>` of the Proof Point you want to revoke.
2. Stop serving the JSON document at `<id>`.

The Proof Point is no longer valid.

##  5. <a name='Validate'></a>Validate

Validation is the process by which an entity presented with a Proof Point can determine whether the expressed claim is truly and intentionally made by the named issuer.

To validate a given Proof Point the following process is used:

1. Start with the Proof Point `id`.
2. Use an HTTP GET to fetch the document at `id`.
3. The Proof Point is **invalid** if any of:
    1. The GET fails.
    2. The fetched document does not contain all the fields described in [Proof Point Document Format](#ProofPointDocumentFormat).
    3. The `id` and `proof.verificationMethod` fields do not both match the `id`.
    4. The `issuer` field does not match the domain name from the `id`.
    5. The `validFrom` field is present and is in the future.
    6. The `validUntil` field is present and is in the past.
4. Otherwise the proof Point is **valid**




