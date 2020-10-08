import Web3 from "web3";

import { EthereumAddress } from "./ethereumAddress";
import { HttpClient } from "./httpClient";
import { ProofPoint } from "./proofPoint";
import { ProofPointIssueResult } from "./proofPointIssueResult";
import { ProofPointRegistry } from "./proofPointRegistry";
import { ProofPointValidateResult } from "./proofPointValidateResult";
import { ProofPointStatus } from "./proofPointStatus";
import { ProofPointEventType } from "./proofPointEventType";
import { ProofPointEvent } from "./proofPointEvent";
import { ProofPointRegistryRoot } from "./proofPointRegistryRoot";
import {
  StorageProvider,
  IpfsStorageProvider,
  IpfsStorageProviderSettings,
} from "./storage";

export {
  Web3,
  EthereumAddress,
  HttpClient,
  ProofPointRegistry,
  StorageProvider,
  IpfsStorageProvider,
  IpfsStorageProviderSettings,
  ProofPoint,
  ProofPointIssueResult,
  ProofPointValidateResult,
  ProofPointStatus,
  ProofPointEventType,
  ProofPointEvent,
  ProofPointRegistryRoot,
};
