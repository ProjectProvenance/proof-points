# 2.3.0

## New Features

- `ProofPointRegistry_v2` smart contract introduced to replace `ProofPointRegistry`. The new contract augments
the `Issued` and `Committed` events with the new parameter `_claimFull` which is the unhashed IPFS hash of the
proof point document which can be used to fetch the document from IPFS. The smart contract ABI remains backwards
compatible.

## Bug Fixes

None

## Breaking Changes

None

# 2.2.0

## New Features

- new API `proofPoints.getByHash(hash)` fetches a proof point document given its hash

## Bug Fixes

None

## Breaking Changes

None

# 2.1.0

## New Features

- Improved proof point validation API

## Bug Fixes

None

## Breaking Changes

- `proofPoint.validate` and `proofPoint.validateByHash` now return the new type `ProofPointVlaidationResult` giving more information about the status of the proof point.

# 2.0.0

## New Features

Migrated from Javascript to Typescript

## Bug Fixes

None

## Breaking Changes

Some parts of API that were previously public by default are now correctly private and inaccessible.
