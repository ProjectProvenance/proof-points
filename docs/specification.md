> **TODO** support for the issuer to be separate from the blockchain transaction signer, so that we can act as a gas payer for people that want to issue claims on our system

> **TODO** support for [EIP-1056](https://github.com/ethereum/EIPs/issues/1056) so that the transaction submitter can be a delegate of the issuer

> **TODO** specify specific claim types, host human and machine readable claim type descriptions at the claim type IRIs

> **TODO** specify subject IDs format for business, product and ingredient - this is not for this document though, as its Provenance specific

> **TODO** find out how to encode a fully qualified Ethereum address as an IRI and specify that for all Ethereum addresses

# Provenance Proof Points Version 1 Specification

The Provenance Proof Point system is an implementation of the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) specification, with an extension to ensure there is a public, trustless append-only log of all Proof Points ever issued and to enable the authenticity and revocation status of a presented Proof Point to be checked using a smart contract on the Ethereum blockchain.

In general the system supports the following functionality:

- A Proof Point is a claim by an `issuer` that a given property or relation is held by one or more `subject`s
- The Proof Point is represented by a self-describing JSON document that meets the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) specification and an associated blockchain record which serves to authenticate (or by its absence revoke) the document 
- The `issuer` is represented by an Ethereum address
- The `subject` may be represented by any URI
- The system supports four functions
  1. `issue` by which an `issuer` may create and publish a new Proof Point
  2. `commit` by which an `issuer` may create and publish a new Proof Point that cannot be `revoke`d
  3. `revoke` by which the `issuer` of an `issue`d Proof Point may revoke it, meaning that is it no longer valid and will subsequently fail the `validate` process.
  4. `validate` by which anyone presented with a Proof Point may verify that it was `issue`d or `commit`ed by the `issuer` and has not subsequently been revoked. **Note** that a _valid_ Proof Point is not necessarily _true_ just as any signed statement is not necessarily true.
- A Proof Point can be issued or validated by anyone with access to the Ethereum network, and may be revoked only by the issuer.
- Proof Points are tamper proof in that modifying the content of a valid Proof Point invalidates it.
- There is a public, trustless, append-only log of all Proof Points that have ever been `issue`d or `commit`ed

## Proof Point Document Format

The JSON document part of the Proof Point is an implementation of the [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/) with a special, Provenance specific `proof` type as defined here.

```
{
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
    "type": "ProvenanceProofType1",
    "registryRoot": <registry-root>,
    "proofPurpose": "assertionMethod",
    "verificationMethod": "<issuer>"
  }
}
```

| Token | Meaning |
|-------|---------|
| `type` | An IRI representing the type of claim being made. This defines the meaning of the claim as well as defining what fields should be expected in the `type-specific-data` |
| `issuer` | The Ethereum address of the issuer of the claim. This is the account that must be used to `issue`, `commit` and `revoke` the claim. The address may be represented either directly or using the did:web URI scheme. See (Proof Point Issuer)[#proof-point-issuer] |
| `valid-from-date` | Optional, the date from which the claim is valid, in [RFC3339](https://tools.ietf.org/html/rfc3339) format. If present this will be checked as part of validation |
| `valid-until-date` | Optional, the date until which the claim is valid, in [RFC3339](https://tools.ietf.org/html/rfc3339) format. If present this will be checked as part of validation |
| `subject` | A URL identifying the subject of the claim. For business, product and ingredient claims it could be the address of the corresponding page within `provenance.org`. A claim with multiple subjects such as a connection claim should include one `credentialSubject` entry for each subject |
| `type-specific-data` | Data fields specific to the `type` which serve to further specify the meaning of the claim |
| `registry-root` | The Ethereum address of the `RegistryRoot` instance which indirectly specifies the `ProofPointRegistry` contract that should be used to `issue`, `commit`, `revoke` and `validate` this claim. See [Locating the Claims Registry](#locating-the-claims-registry). |

> **Note** The `method` field of the `proof` is what makes this W3C Verifiable Credential a Proof Point. The identifier `https://open.provenance.org/ontology/ptf/v2#ProvenanceProofType1` specifies the proof method defined in this document.

An example claim document:

```
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://open.provenance.org/ontology/ptf/v2"
  ],
  "type": ["VerifiableCredential", "CertificationClaim"],
  "issuer": "0x8F36fd828D18a060CF4523DE69eE9Ddc3ec23135",
  "validFrom": "2018-01-01T00:00:00",
  "validUntil": "2020-01-01T00:00:00",
  "credentialSubject": [
    {
      "id": "https://www.provenance.org/users/great-beer-co",
      "certification": "https://provenance.org/ontology/ptf/v2/certifications/ava-certified-vegetarian"
    }
  ],
  "proof": {
    "type": "ProvenanceProofType1",
    "registryRoot": "0x2756e9d20c621A0eF9F4fF58c9809DD5F4c2dca1",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "0x8F36fd828D18a060CF4523DE69eE9Ddc3ec23135"
  }
}
```

## Proof Point Identifier

Each Proof Point has a unique identifier (or ID), which is a fixed length string that can be generated from the Proof Point JSON document using the following method. The ID is used to represent the Proof Point when interacting with the Proof Point Registry Smart Contract and may also be a convenient way to represent the 
Proof Point in other situations.

The Proof Point ID is designed to be a valid [IPFS](https://ipfs.io/) digest. When an `issuer` `issue`s a Proof Point they have the option to store the Proof Point document on IPFS. In this case it is possible to recover the Proof Point document from the Proof Point ID using an IPFS lookup.

### Generating the Proof Point Identifier

The ID is generated from the Proof Point JSON document according to to the following method:

1. Canonicalize the document according to the [draft-rundgren-json-canonicalization-scheme](https://tools.ietf.org/html/draft-rundgren-json-canonicalization-scheme-14). For example, by using [this NPM package](https://www.npmjs.com/package/canonicalize)
2. Compute the base 58 encoding of the [multihash](https://github.com/multiformats/multihash) encoding of the 32 byte SHA-256 hash of the canonicalized document. Note that this the IPFS digest you will get if you add the file to IPFS and  specify the `sha2-256` hash method: `ipfs add --hash sha2-256 <file>`. The result is the Proof Point ID.

## The ProofPointRegistry Smart Contract

The `ProofPointRegistry` smart contract is a singleton smart contract on the Ethereum blockchain that is used to support Proof Point functionality. The following is the API of the contract. We will see how it is used in later sections.

```
contract ProofPointRegistry {

    event Issued(address _issuer, bytes _claim);
    event Committed(address _issuer, bytes _claim);
    event Revoked(address _issuer, bytes _claim);
    
    function issue(bytes memory _claim);

    function commit(bytes memory _claim);

    function revoke(bytes memory _claim);

    function validate(address _issuer, bytes memory _claim) view returns(bool);
}
```

## Proof Point Issuer

Each Proof Point declares an `issuer` which is an Ethereum address represented either directly or using the did:web protocol. Where the `issuer` is represented using a did:web URI it will be neccesary to resolve this
to an Ethereum address in order to either `issue`, `commit` or `validate` it. For more information on how to
do this please see the [did:web Decentralized Identifier Method Specification](https://w3c-ccg.github.io/did-method-web/)

## Issue

To issue a new valid Proof Point the following process is used:

> **Note** This process involves a blockchain write, so can only be carried out by an `issuer` account with Ether funds and the process is subject to the normal block finalization delay.

1. Determine the `<issuer>`, `<subject>`, `<type>`, `<type-specific-data>`, `<valid-from-date>` (optional), `<valid-until-date>` (optional) and `<registry-root>`. The `<issuer>` must be an Ethereum account that you control. The issued claim will only be valid between the `<valid-from-date>` and `<valid-until-date>` if present.
2. Construct a JSON document according to the [Claim Data Format](#claim-data-format)
3. [Compute the Proof Point ID](#generating-the-proof-point-identifier)
4. (Optional) Store the canonicalized Proof Point document on IPFS
5. [Locate the ProofPointRegistry](#locating-the-ProofPointRegistry)
6. Using the `<issuer>` account, call the `issue` method of the `ProofPointRegistry` contract with the ID generated in 3.

The document (both canonical, pre-canonical and ID form) is now a valid Proof Point and may be published or transmitted to a holder or validator.

## Commit

A commitment is a Proof Point that cannot be revoked. Once issued it is valid forever (within the `validFrom` to `validUntil` time range). To commit a new valid Proof Point the process for [issuing a claim](#issue) is followed except that the `commit` method of the `ProofPointRegistry` contract is called, instead of the `issue` method.

> **Note** that this process involves a blockchain write, so can only be carried out by an `issuer` account with Ether funds and the process is subject to the normal block finalization delay.

## Revoke

To revoke a valid Proof Point the following process is used:

> **Note** This process involves a blockchain write, so can only be carried out by an `issuer` account with Ether funds and the process is subject to the normal block finalization delay.

> **Note** Only the `issuer` can revoke a Proof Point

> **Note** Revoking a `commit`ed claim has no effect

1. Start with the JSON document that was issued
2. [Compute the Proof Point ID](#generating-the-proof-point-identifier)
3. [Locate the ProofPointRegistry](#locating-the-ProofPointRegistry)
4. Using the `issuer` account, call the `revoke` method of the `ProofPointRegistry` contract with the ID computed in 2.

The Proof Point is no longer valid in any form.

## Validate

To check the validity of a given Proof Point the following process is used:

> **Note** This process involves a blockchain read, but not a write, so no Ether funds are required to perform this process.

1. Start with the JSON document that you want to validate. This may have been directly transmitted to you, or may be recovered from the ID using an IPFS lookup.
2. If the `validFrom` field is present and is in the future then the claim is **invalid**
3. If the `validUntil` field is present and is in the past then the claim is **invalid**
4. [Compute the Proof Point ID](#generating-the-proof-point-identifier) if you don't already have it.
5. [Locate the ProofPointRegistry](#locating-the-ProofPointRegistry)
6. Call the `validate` method of the `ProofPointRegistry` contract with the `<issuer>` and the ID computed in 5. If the return value is `true` then the Proof Point is **valid**, otherwise it is **invalid**.

## Locating the ProofPointRegistry

The `ProofPointRegistry` is a singleton smart contract on the Ethereum blockchain. In order to enable upgrades and bug fixes the [Eternal Storage Pattern](https://fravoll.github.io/solidity-patterns/eternal_storage.html) is used. This means that the address of the contract can change over time. Therefore the location of the `ProofPointRegistry` is not directly recorded in a claim. Instead the claim records `registryRoot`; the address of a permanent contract that can be used to look up the current address of the `ProofPointRegistry`.

The `registryRoot` is the address of a contract with the following API:

```
contract RegistryRoot {
    function getOwner() view returns(address);
}
```

 In order to resolve the `registryRoot` to the address of the `ProofPointRegistry` the following process is used:

1. Call the `getOwner` method of the `RegistryRoot` contract at `<registry-root>` to get the address for the current implementation of the `ProofPointRegistry`
2. Use the `ProofPointRegistry` at the specified address for all `ProofPointRegistry` interactions




