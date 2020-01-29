# ProofPoints
Documentation, Javascript package and smart contracts for working with Provenance Proof Points

## Introduction

This repo contains everything you need to work with [Provenance Proof Points](https://open.provenance.org/proof-points). That includes:

- Specification documentation
- Solidity smart contracts that implement the blockchain part of the spec
- A javascript library that implements the client side part of the spec

## Quick Start

All proof point functionality is accessed through an instance of the `Provenance` object. To construct a `Provenance` object you will need a `web3` instance and the address of a `ProofPointRegistryStorage1` contract. The production instance of the `ProofPointRegistryStorage1` contract is deployed on kovan and its address is published at https://open.provenance.org/public-addresses. If you want to `issue` a proof point you will also need a funded Ethereum account.

```
// construct an instance of the Provenance object
const provenance = new Provenance({
    web3: web3,
    proofPointStorageAddress: '0x...'
  });

// initialize the instance
await provenance.init();
```

### Issue a Proof Point

Each proof point has a type, an issuer and some data. The issuer should be a funded Ethereum account that you control. The type should be a type identifying string, for example one of the types defined in the [Provenance ontology](https://open.provenance.org/ontology). The data can be any javascript object but when serialized to JSON should meet any specification for the type.

```
// issue a proof point
const result = await provenance.proofPoint.issue(
    'https://provenance.org/ontology/ptf/v2/...', // A type identifying URL, such as one from the Provenance ontology
    '0x...', // The issuer account, a funded account that you control
    { a: 'b' }, // The data payload of the proof point, should match the schema defined by the type
    '2020-10-10', // Optional valid from date,
    '2030-10-10', // optional valid until date
);
```

The returned `result` has three fields:

| Field | Notes |
|-------|-------|
| `proofPointHash` | A unique identifier for the proof point that is also the IPFS address of the proof point object |
| `proofPointObject` | A javascript object that can be serialized to JSON to form the self describing JSON representation of the proof point |
| `transactionHash` | The Ethereum transaction hash of the transaction that issued the proof point |

### Validate a Proof Point

```
// validate a proof point object
const isValid = await provenance.proofPoint.validate(proofPointObject);

// validate a proof point given its identifier
const isValid = await provenance.proofPoint.validateByHash(proofPointHash);
```

### Revoke a Proof Point

```
// revoke a proof point object
await provenance.proofPoint.revoke(proofPointObject);

// revoke a proof point given its identifier
await provenance.proofPoint.revokeByHash(proofPointHash);
```

## Development

Clone the repo

```
git clone https://github.com/ProjectProvenance/proof-points.git 
cd proof-points
```

Install javascript dependencies

```
npm install
```

Compile solidity contracts

```
npm run compile
```

[Install IPFS](https://docs.ipfs.io/guides/guides/install/) then in a separate shell start an IPFS daemon

```
ipfs daemon
```

Run unit tests

```
npm test
```

start a local Ethereum node in a separate shell, e.g.

```
npm i -g ganache-cli
ganache-cli
```

Deploy the smart contracts to a local Ethereum node

```
truffle migrate
```

Note the contract address of the `ProofPointRegistryStorage1` contract. This will be needed when constructing your `Provenance` object. See [Quick Start](#quick-start) for more info.

> For more advanced deployment scenarios look at `truffle-config.js` and read the Truffle documentation.

### Publishing NPM Package

Use the following command substituting the correct version number. A git tag will be created and if the CircleCI build is successful then the package will be published to NPM

```
npm version 10.0.1
git push --follow-tags
```




