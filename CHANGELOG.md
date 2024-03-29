# 7.4.0

## New Features

## Bug Fixes

## Changes

- Updated some dependencies to include security fixes

# 7.3.0

## New Features

- Add DummyProofPointAuthenticator

## Bug Fixes

# 7.2.0

## New Features

- Web requests to resolve the DID of the issuer are cached.

## Bug Fixes

# 7.1.0

## New Features

- Added support for basic authentication when using IPFS.

## Bug Fixes

None

## Breaking Changes

None

# 7.0.0

## New Features

- Fix some errors in v1 specification document
- Enforce use CORS mode when POSTing to IPFS

## Bug Fixes

None

## Breaking Changes

- The API for issuing and validating a proof point has changed. See README.md.

None
# 6.3.0

JS dependencies upgraded

## New Features

None

## Bug Fixes

None

## Breaking Changes

None
# 6.2.0

## New Features

- When writing to the registry you can optionally provide your own signer, which can be useful when using a Provider that cannot provide a Signer.

## Bug Fixes

None

## Breaking Changes

None

# 6.1.0

## New Features

- Compatible with Node runtime

## Bug Fixes

None

## Breaking Changes

None

# 6.0.0

## New Features

- Compatible with IPFS version 0.7

## Bug Fixes

None

## Breaking Changes

- No longer compatible with IPFS versions prior to 0.7

# 5.1.0

## New Features

None

## Bug Fixes

- The type `ProofPointId` which forms part of the public interface of the `ProofPointRegistry` was previously not exported.

## Breaking Changes

None

# 5.0.0

## New Features

None

## Bug Fixes

None

## Breaking Changes

- Web3js dependency has been replaced by ethersjs dependency. The constructor of `ProofPointRegistryRoot` and that of `ProofPointRegistry` have changed to accept an `ethers.providers.JsonRpcProvider` instead of a `Web3` instance.

# 4.0.1

## New Features

None

## Bug Fixes

- Fixed: proof point is issued with `proof.registryRoot` field wrongly set

## Breaking Changes

None

# 4.0.0

## New Features

None

## Bug Fixes

None

## Breaking Changes

- The way to construct an instance of the `ProofPointRegistry` object hash changed. See README.md for details

# 3.2.0

## New Features

- Proper handling of did:web identifiers including ports: `did:web:example.com%3A1234`

## Bug Fixes

None

## Breaking Changes

None

# 3.1.1

## New Features

None

## Bug Fixes

- Fixed: `did:web` issuer doesn't work in browser. 
- Fixed: `did:web` issuer doesn't support ids with subpaths such as `did:web:example.com:subpath`

## Breaking Changes

None

# 3.1.0

## New Features

- `transactionHash` field added to `EthereumProofPointEvent` type.
- Added support for `did:web` issuer. This is now possible: `await api.issue(<type>, 'did:web:example.com', <content>);`.

## Bug Fixes

None

## Breaking Changes

None

# 3.0.0

## New Features

- Added API: `ProofPointRegistry.deploy(...)` to deploy an instance of the registry contracts
- Added API: `ProofPointRegistry.canUpgrade()` to determine whether this library can upgrade the deployed logic contract
- Added API: `ProofPointRegistry.upgrade()` to perform a logic contract upgrade
- Added API: `ProofPointRegistry.getAll()` to get a list of the IDs of all Proof Points ever issued or committed.
- Added API: `ProofPointRegistry.getHistory(...)` to fetch a list of blockchain events related to the given Proof Point.

## Bug Fixes

- Fixed ProofPointRegistry_v2 smart contract to be ABI backwards compatible with the previous version. This is done by reverting the `Issued` and `Committed` events to be identical to the version 1 contract and adding a new
event `Published` which is used to record a list of all Proof Point IDs.

## Breaking Changes

- The way the API is initialized and used has changed. To construct an instance of the API for a pre-existing registry deployment use the constructor `const api = new ProofPointRegistry(...)`. You must then initialize the API: `await api.init()`. Interact with the Proof Point registry using methods directly on the API object e.g. `api.issue(...)`.
- Proof point 'hash' is now referred to as 'ID' throughout and this has changed some API names for example `ProofPointRegistry.getByHash` is renamed to `getById` and the field `ProofPointIssueResult.proofPointHash` is renamed to `proofPointId`.

# 2.4.0

## New Features

None

## Bug Fixes

- Fixed types file location in `package.json`
- Use `ProofPointRegistry_v2` ABI for interacting with the contract

## Breaking Changes

None

# 2.3.0

## New Features

- `ProofPointRegistry_v2` smart contract introduced to replace `ProofPointRegistry`. The new contract augments
the `Issued` and `Committed` events with the new parameter `_claimFull` which is the unhashed IPFS hash of the
Proof Point document which can be used to fetch the document from IPFS. The smart contract ABI remains backwards
compatible.

## Bug Fixes

None

## Breaking Changes

None

# 2.2.0

## New Features

- new API `proofPoints.getByHash(hash)` fetches a Proof Point document given its hash

## Bug Fixes

None

## Breaking Changes

None

# 2.1.0

## New Features

- Improved Proof Point validation API

## Bug Fixes

None

## Breaking Changes

- `proofPoint.validate` and `proofPoint.validateByHash` now return the new type `ProofPointVlaidationResult` giving more information about the status of the Proof Point.

# 2.0.0

## New Features

Migrated from Javascript to Typescript

## Bug Fixes

None

## Breaking Changes

Some parts of API that were previously public by default are now correctly private and inaccessible.
