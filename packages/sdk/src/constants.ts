/**
 * ARC Name Service — Exported constants
 *
 * Registry ABI, addresses, and chain metadata for direct contract integration.
 */

/** Full ABI for the ARCNameRegistry contract (human-readable format) */
export const ANS_REGISTRY_ABI = [
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
  "function setPrimaryName(string rawLabel)",
] as const;

/** Minimal read-only ABI for resolution only */
export const ANS_RESOLVER_ABI = [
  "function resolve(string rawLabel) view returns (address)",
  "function reverseResolve(address wallet) view returns (string)",
  "function isAvailable(string rawLabel) view returns (bool)",
  "function getRecord(string rawLabel) view returns (address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved)",
  "function quotePrice(string rawLabel, uint256 yearsCount) view returns (uint256)",
  "function getOwnedLabels(address wallet) view returns (string[] memory)",
] as const;

/** ERC-20 ABI subset used for USDC fee approval and balance checks */
export const USDC_ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
] as const;

/** Registry contract addresses keyed by chain ID */
export const ANS_REGISTRY_ADDRESSES: Record<number, string> = {
  5042002: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db", // Arc Testnet
};

/** USDC token addresses keyed by chain ID */
export const ANS_USDC_ADDRESSES: Record<number, string> = {
  5042002: "0x3600000000000000000000000000000000000000", // Arc Testnet
};

/** Chain IDs supported by ANS */
export const ANS_SUPPORTED_CHAIN_IDS = [5042002] as const;

/** RPC endpoints keyed by chain ID */
export const ANS_RPC_URLS: Record<number, string> = {
  5042002: "https://rpc.testnet.arc.network",
};

/** Block explorer base URLs keyed by chain ID */
export const ANS_EXPLORER_URLS: Record<number, string> = {
  5042002: "https://testnet.arcscan.app",
};

/** Chain metadata */
export const ANS_CHAINS: Record<number, { name: string; chainIdHex: string; nativeCurrency: { name: string; symbol: string; decimals: number } }> = {
  5042002: {
    name: "Arc Testnet",
    chainIdHex: "0x4CEE32",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  },
};
