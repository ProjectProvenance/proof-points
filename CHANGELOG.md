# NEXT

## New Features

- Improved proof proof point validation API

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
