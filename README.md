# Provenance Proof Points

Documentation, Javascript package and smart contracts for working with Provenance Proof Points

## Introduction

This repo contains everything you need to work with [Provenance Proof Points](https://open.provenance.org/proof-points). That includes:

- Specification documentation
- Solidity smart contracts that implement the blockchain part of the spec
- A javascript library that implements the client side part of the spec

## Quick Start

This section covers how to use the NPM package to issue, revoke and validate Proof Points.

Functionality is split into two areas:

- Issuing and revoking proof points is accomplished using an instance of `EthereumProofPointIssuer`
- Validating proof points is done using an instance of `ProofPointValidator`

To construct a `EthereumProofPointIssuer` or `ProofPointValidator` object you will need an `ethers.providers.JsonRpcProvider` instance and the address of a `ProofPointRegistryStorage1` contract. The production instance of the `ProofPointRegistryStorage1` contract is deployed on kovan and its address is published at https://open.provenance.org/developers . If you want to `issue` a Proof Point you will also need a funded Ethereum account.

> If you want to deploy your own instance of the Proof Point registry contracts you can use the static `EthereumProofPointRegistryRoot.deploy(...)` method.

Install required NPM packages:

```
$ npm i @provenance/proof-points ethers
```

### Validate

```js
import { ProofPointId, EthereumAddress, ProofPointValidator } from '@provenance/proof-points';
import { ethers } from ethers;

const registryRootAddress = EthereumAddress.parse('0x...');
const ipfsSettings = {
  host: 'example.com',
  port: 443,
  protocol: 'https'
}
const ethereumProvider = new ethers.providers.JsonRpcProvider();

const proofPointValidator = ProofPointValidator.production(
    registryRootAddress,
    ethereumProvider,
    ipfsSettings
);

const proofPointId = ProofPointId.parse('Qm...');

const {  
    isValid,
    proofPoint,
    statusCode,
    statusMessage
} = await proofPointValidator.validate(proofPointId)
```

### Issue or Revoke

```js
import { EthereumAddress, EthereumProofPointIssuer } from '@provenance/proof-points';
import { ethers } from ethers;

const registryRootAddress = EthereumAddress.parse('0x...');
const ipfsSettings = {
  host: 'example.com',
  port: 443,
  protocol: 'https'
}
const ethereumProvider = new ethers.providers.JsonRpcProvider();

const ethereumProofPointIssuer = await EthereumProofPointIssuer.production(
    registryRootAddress,
    ipfsSettings,
    ethereumProvider
);

const type = 'https://example.com/1';
const issuer = 'did:web:example.com';
const content = { 'a': 'b' };
const validFromDate = new Date();
const validUntilDate = new Date();

const {
  proofPointId;
  transactionHash;
  proofPointObject;
} = await ethereumProofPointIssuer.issue(
    type,
    issuer,
    content,
    validFromDate,
    validUntilDate
);

await ethereumProofPointIssuer.revoke(proofPointId);
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

### Publishing NPM Package

Use the following command substituting the correct version number. A git tag will be created and if the CircleCI build is successful then the package will be published to NPM

```
npm version 10.0.1
git push --follow-tags
```




