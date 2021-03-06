# Provenance Proof Points

Documentation, Javascript package and smart contracts for working with Provenance Proof Points

## Introduction

This repo contains everything you need to work with [Provenance Proof Points](https://open.provenance.org/proof-points). That includes:

- Specification documentation
- Solidity smart contracts that implement the blockchain part of the spec
- A javascript library that implements the client side part of the spec

## Quick Start

This section covers how to use the NPM package to issue, revoke and validate Proof Points.

All Proof Point functionality is accessed through an instance of the `ProofPointRegistry` object. To construct a `ProofPointRegistry` object you will need an `ethers.providers.JsonRpcProvider` instance and the address of a `ProofPointRegistryStorage1` contract. The production instance of the `ProofPointRegistryStorage1` contract is deployed on kovan and its address is published at https://open.provenance.org/developers . If you want to `issue` a Proof Point you will also need a funded Ethereum account.

> If you want to deploy your own instance of the Proof Point registry contracts you can use the static `ProofPointRegistryRoot.deploy(...)` method.

Install required NPM packages:

```
$ npm i @provenance/proof-points ethers
```

Import the packages in your Javascript

```
import { EthereumAddress, ProofPointRegistryRoot, ProofPointRegistry } from '@provenance/proof-points';
import { ethers } from ethers;
```

Construct a `ProofPointRegistry` object

```
const provider = new ethers.providers.JsonRpcProvider();
const registryRootAddress = EthereumAddress.parse('0x...');
const registryRoot = new ProofPointRegistryRoot(registryRootAddress, provider);
const registry = await registryRoot.getRegistry();
```

### Issue a Proof Point

Each Proof Point has a type, an issuer and some data. The issuer should be a funded Ethereum account that you control. The type should be a type identifying string, for example one of the types documented [here](https://open.provenance.org/developers/specification/). The data can be any javascript object but when serialized to JSON should meet any specification for the type.

```
// issue a Proof Point
const result = await registry.issue(
    'https://open.provenance.org/ontology/ptf/v2/...', // A type identifying URL, such as one from the Provenance ontology
    '0x...', // The issuer account, a funded account that you control or a did:web identifier that maps to such an account
    { a: 'b' }, // The data payload of the Proof Point, should match the schema defined by the type
    '2020-01-01', // Optional valid from date,
    '2030-01-01', // optional valid until date
);
```

The returned `result` has three fields:

| Field | Notes |
|-------|-------|
| `proofPointId` | A unique identifier (ID) for the Proof Point that is also the IPFS address of the Proof Point document |
| `proofPointObject` | A javascript object that can be serialized to JSON to form the self describing JSON representation of the Proof Point |
| `transactionHash` | The Ethereum transaction hash of the transaction that issued the Proof Point |

### Validate a Proof Point

```
// validate a Proof Point object
const isValid = await registry.validate(proofPointObject);

// validate a Proof Point given its ID
const isValid = await registry.validateById(proofPointId);
```

### Revoke a Proof Point

```
// revoke a Proof Point object
await registry.revoke(proofPointObject);

// revoke a Proof Point given its ID
await registry.revokeById(proofPointId);
``` 

## Contribute

This section covers how to set up so that you can build the smart contracts and Javascript library and run the unit tests. This is mainly of interest for developers who wish to contribute to the smart contracts or Javascript library.

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
npm run compile-solidity
```

Compile the typescript

```
npm run compile-typescript
```

[Install IPFS](https://docs.ipfs.io/guides/guides/install/) then in a separate terminal start an IPFS daemon

```
ipfs daemon
```

Run unit tests

```
npm test
```

#### Contribution Guidelines

##### Node and Browser Compatibility

The package is designed to be usable within either Node or a web browser context. Therefore avoid use of APIs specific to Node or the browser.

### Publishing NPM Package

Use the following command substituting the correct version number. A git tag will be created and if the CircleCI build is successful then the package will be published to NPM

```
npm version 10.0.1
git push --follow-tags
```




