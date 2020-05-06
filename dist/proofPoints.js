"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
;
;
var PROOF_TYPE = 'https://open.provenance.org/ontology/ptf/v2/ProvenanceProofType1';
var Web3 = require('web3');
var canonicalizeJson = require('canonicalize');
var localISOdt = require('local-iso-dt').localISOdt;
var web3 = new Web3();
var ProofPointsRepo = /** @class */ (function () {
    function ProofPointsRepo(contracts, storage) {
        this.gasLimit = 200000;
        this.contracts = contracts;
        this.storage = storage;
    }
    ProofPointsRepo.prototype.issue = function (type, issuerAddress, content, validFromDate, validUntilDate) {
        if (validFromDate === void 0) { validFromDate = null; }
        if (validUntilDate === void 0) { validUntilDate = null; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._issue(type, issuerAddress, content, this.contracts.ProofPointRegistryInstance.methods.issue, validFromDate, validUntilDate)];
            });
        });
    };
    ProofPointsRepo.prototype.commit = function (type, issuerAddress, content, validFromDate, validUntilDate) {
        if (validFromDate === void 0) { validFromDate = null; }
        if (validUntilDate === void 0) { validUntilDate = null; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._issue(type, issuerAddress, content, this.contracts.ProofPointRegistryInstance.methods.commit, validFromDate, validUntilDate)];
            });
        });
    };
    ProofPointsRepo.prototype.revokeByHash = function (proofPointHash) {
        return __awaiter(this, void 0, void 0, function () {
            var storedData, proofPointObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.storage.get(proofPointHash)];
                    case 1:
                        storedData = _a.sent();
                        proofPointObject = JSON.parse(storedData.data);
                        this.revoke(proofPointObject);
                        return [2 /*return*/];
                }
            });
        });
    };
    ProofPointsRepo.prototype.revoke = function (proofPointObject) {
        return __awaiter(this, void 0, void 0, function () {
            var proofPointRegistry, proofPointHash, proofPointHashBytes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (proofPointObject.proof.type !== PROOF_TYPE) {
                            throw new Error('Unsupported proof type');
                        }
                        return [4 /*yield*/, this.getProofPointRegistry(proofPointObject)];
                    case 1:
                        proofPointRegistry = _a.sent();
                        return [4 /*yield*/, this.storeObjectAndReturnKey(proofPointObject)];
                    case 2:
                        proofPointHash = _a.sent();
                        proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);
                        return [4 /*yield*/, proofPointRegistry
                                .methods
                                .revoke(proofPointHashBytes)
                                .send({ from: proofPointObject.issuer, gas: this.gasLimit })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    ProofPointsRepo.prototype.validateByHash = function (proofPointHash) {
        return __awaiter(this, void 0, void 0, function () {
            var storedData, proofPointObject;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.storage.get(proofPointHash)];
                    case 1:
                        storedData = _a.sent();
                        proofPointObject = JSON.parse(storedData.data);
                        return [2 /*return*/, this.validate(proofPointObject)];
                }
            });
        });
    };
    ProofPointsRepo.prototype.validate = function (proofPointObject) {
        return __awaiter(this, void 0, void 0, function () {
            var validFromDate, validUntilDate, proofPointRegistry, proofPointHash, proofPointHashBytes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (proofPointObject.proof.type !== PROOF_TYPE) {
                            throw new Error('Unsupported proof type');
                        }
                        if (typeof proofPointObject.validFrom !== 'undefined') {
                            validFromDate = Date.parse(proofPointObject.validFrom);
                            if (validFromDate > Date.now()) {
                                return [2 /*return*/, false];
                            }
                        }
                        if (typeof proofPointObject.validUntil !== 'undefined') {
                            validUntilDate = Date.parse(proofPointObject.validUntil);
                            if (validUntilDate < Date.now()) {
                                return [2 /*return*/, false];
                            }
                        }
                        if (!this.isRegistryWhitelisted(proofPointObject)) {
                            return [2 /*return*/, false];
                        }
                        return [4 /*yield*/, this.getProofPointRegistry(proofPointObject)];
                    case 1:
                        proofPointRegistry = _a.sent();
                        return [4 /*yield*/, this.storeObjectAndReturnKey(proofPointObject)];
                    case 2:
                        proofPointHash = _a.sent();
                        proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);
                        return [2 /*return*/, proofPointRegistry
                                .methods
                                .validate(proofPointObject.issuer, proofPointHashBytes)
                                .call()];
                }
            });
        });
    };
    ProofPointsRepo.prototype._issue = function (type, issuerAddress, content, issueFunction, validFromDate, validUntilDate) {
        if (validFromDate === void 0) { validFromDate = null; }
        if (validUntilDate === void 0) { validUntilDate = null; }
        return __awaiter(this, void 0, void 0, function () {
            var proofPointObject, proofPointHash, proofPointHashBytes, transactionReceipt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        proofPointObject = this.buildJson(type, issuerAddress, content, validFromDate, validUntilDate);
                        return [4 /*yield*/, this.storeObjectAndReturnKey(proofPointObject)];
                    case 1:
                        proofPointHash = _a.sent();
                        proofPointHashBytes = web3.utils.asciiToHex(proofPointHash);
                        return [4 /*yield*/, issueFunction(proofPointHashBytes)
                                .send({ from: issuerAddress, gas: this.gasLimit })];
                    case 2:
                        transactionReceipt = _a.sent();
                        return [2 /*return*/, {
                                proofPointHash: proofPointHash,
                                transactionHash: transactionReceipt.transactionHash,
                                proofPointObject: proofPointObject
                            }];
                }
            });
        });
    };
    ProofPointsRepo.prototype.buildJson = function (type, issuerAddress, content, validFromDate, validUntilDate) {
        if (validFromDate === void 0) { validFromDate = null; }
        if (validUntilDate === void 0) { validUntilDate = null; }
        var issuerAddressChecksum = web3.utils.toChecksumAddress(issuerAddress);
        var proofPoint = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://provenance.org/ontology/ptf/v2'
            ],
            type: ['VerifiableCredential', type],
            issuer: issuerAddressChecksum,
            credentialSubject: content,
            proof: {
                type: PROOF_TYPE,
                registryRoot: this.contracts.proofPointStorageAddress,
                proofPurpose: 'assertionMethod',
                verificationMethod: issuerAddressChecksum
            },
            validFrom: undefined,
            validUntil: undefined
        };
        if (validFromDate !== null) {
            proofPoint.validFrom = localISOdt(validFromDate);
        }
        if (validUntilDate !== null) {
            proofPoint.validUntil = localISOdt(validUntilDate);
        }
        return proofPoint;
    };
    ProofPointsRepo.prototype.getProofPointRegistry = function (proofPoint) {
        return __awaiter(this, void 0, void 0, function () {
            var proofPointStorage1, proofPointRegistryAddress, proofPointRegistry;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this
                            .contracts
                            .ProofPointRegistryStorage1
                            .at(proofPoint.proof.registryRoot)];
                    case 1:
                        proofPointStorage1 = _a.sent();
                        return [4 /*yield*/, proofPointStorage1
                                .methods
                                .getOwner()
                                .call()];
                    case 2:
                        proofPointRegistryAddress = _a.sent();
                        return [4 /*yield*/, this
                                .contracts
                                .ProofPointRegistry
                                .at(proofPointRegistryAddress)];
                    case 3:
                        proofPointRegistry = _a.sent();
                        return [2 /*return*/, proofPointRegistry];
                }
            });
        });
    };
    ProofPointsRepo.removeEmptyFields = function (obj) {
        Object.keys(obj).forEach(function (key) {
            if (obj[key] && typeof obj[key] === 'object')
                ProofPointsRepo.removeEmptyFields(obj[key]);
            // eslint-disable-next-line no-param-reassign
            else if (obj[key] === undefined)
                delete obj[key];
        });
        return obj;
    };
    ProofPointsRepo.prototype.storeObjectAndReturnKey = function (dataObject) {
        return __awaiter(this, void 0, void 0, function () {
            var cleanedDataObject, dataStr, storageResult;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        cleanedDataObject = ProofPointsRepo.removeEmptyFields(dataObject);
                        dataStr = canonicalizeJson(cleanedDataObject);
                        return [4 /*yield*/, this.storage.add(dataStr)];
                    case 1:
                        storageResult = _a.sent();
                        return [2 /*return*/, storageResult.digest];
                }
            });
        });
    };
    ProofPointsRepo.prototype.isRegistryWhitelisted = function (proofPointObject) {
        return proofPointObject.proof.registryRoot.toLowerCase()
            === this.contracts.proofPointStorageAddress.toLowerCase();
    };
    return ProofPointsRepo;
}());
exports.ProofPointsRepo = ProofPointsRepo;
