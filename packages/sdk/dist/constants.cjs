"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/constants.ts
var constants_exports = {};
__export(constants_exports, {
  ANS_CHAINS: () => ANS_CHAINS,
  ANS_EXPLORER_URLS: () => ANS_EXPLORER_URLS,
  ANS_REGISTRY_ABI: () => ANS_REGISTRY_ABI,
  ANS_REGISTRY_ADDRESSES: () => ANS_REGISTRY_ADDRESSES,
  ANS_RESOLVER_ABI: () => ANS_RESOLVER_ABI,
  ANS_RPC_URLS: () => ANS_RPC_URLS,
  ANS_SUPPORTED_CHAIN_IDS: () => ANS_SUPPORTED_CHAIN_IDS,
  ANS_USDC_ADDRESSES: () => ANS_USDC_ADDRESSES,
  USDC_ERC20_ABI: () => USDC_ERC20_ABI
});
module.exports = __toCommonJS(constants_exports);
var ANS_REGISTRY_ABI = [
  "function resolve(string rawLabel) view returns (address)",
  "function reverseResolve(address wallet) view returns (string)",
  "function isAvailable(string rawLabel) view returns (bool)",
  "function getRecord(string rawLabel) view returns (address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved)",
  "function quotePrice(string rawLabel, uint256 yearsCount) view returns (uint256)",
  "function getOwnedLabels(address wallet) view returns (string[] memory)",
  "function commitRevealRequired() view returns (bool)",
  "function register(string rawLabel, address resolvedAddress)",
  "function submitCommitment(bytes32 commitment)",
  "function registerWithCommit(string rawLabel, address resolvedAddress, bytes32 salt)",
  "function computeCommitment(address registrant, string rawLabel, bytes32 salt) view returns (bytes32)",
  "function renew(string rawLabel)",
  "function release(string rawLabel)",
  "function updateResolvedAddress(string rawLabel, address newAddress)",
  "function transferName(string rawLabel, address newOwner)",
  "function setPrimaryName(string rawLabel)"
];
var ANS_RESOLVER_ABI = [
  "function resolve(string rawLabel) view returns (address)",
  "function reverseResolve(address wallet) view returns (string)",
  "function isAvailable(string rawLabel) view returns (bool)",
  "function getRecord(string rawLabel) view returns (address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved)",
  "function quotePrice(string rawLabel, uint256 yearsCount) view returns (uint256)",
  "function getOwnedLabels(address wallet) view returns (string[] memory)"
];
var USDC_ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];
var ANS_REGISTRY_ADDRESSES = {
  5042002: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db"
  // Arc Testnet
};
var ANS_USDC_ADDRESSES = {
  5042002: "0x3600000000000000000000000000000000000000"
  // Arc Testnet
};
var ANS_SUPPORTED_CHAIN_IDS = [5042002];
var ANS_RPC_URLS = {
  5042002: "https://rpc.testnet.arc.network"
};
var ANS_EXPLORER_URLS = {
  5042002: "https://testnet.arcscan.app"
};
var ANS_CHAINS = {
  5042002: {
    name: "Arc Testnet",
    chainIdHex: "0x4CEE32",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ANS_CHAINS,
  ANS_EXPLORER_URLS,
  ANS_REGISTRY_ABI,
  ANS_REGISTRY_ADDRESSES,
  ANS_RESOLVER_ABI,
  ANS_RPC_URLS,
  ANS_SUPPORTED_CHAIN_IDS,
  ANS_USDC_ADDRESSES,
  USDC_ERC20_ABI
});
