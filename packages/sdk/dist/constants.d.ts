/**
 * ARC Name Service — Exported constants
 *
 * Registry ABI, addresses, and chain metadata for direct contract integration.
 */
/** Full ABI for the ARCNameRegistry contract (human-readable format) */
declare const ANS_REGISTRY_ABI: readonly ["function resolve(string rawLabel) view returns (address)", "function reverseResolve(address wallet) view returns (string)", "function isAvailable(string rawLabel) view returns (bool)", "function getRecord(string rawLabel) view returns (address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved)", "function quotePrice(string rawLabel, uint256 yearsCount) view returns (uint256)", "function getOwnedLabels(address wallet) view returns (string[] memory)", "function commitRevealRequired() view returns (bool)", "function register(string rawLabel, address resolvedAddress)", "function submitCommitment(bytes32 commitment)", "function registerWithCommit(string rawLabel, address resolvedAddress, bytes32 salt)", "function computeCommitment(address registrant, string rawLabel, bytes32 salt) view returns (bytes32)", "function renew(string rawLabel)", "function release(string rawLabel)", "function updateResolvedAddress(string rawLabel, address newAddress)", "function transferName(string rawLabel, address newOwner)", "function setPrimaryName(string rawLabel)"];
/** Minimal read-only ABI for resolution only */
declare const ANS_RESOLVER_ABI: readonly ["function resolve(string rawLabel) view returns (address)", "function reverseResolve(address wallet) view returns (string)", "function isAvailable(string rawLabel) view returns (bool)", "function getRecord(string rawLabel) view returns (address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved)", "function quotePrice(string rawLabel, uint256 yearsCount) view returns (uint256)", "function getOwnedLabels(address wallet) view returns (string[] memory)"];
/** ERC-20 ABI subset used for USDC fee approval and balance checks */
declare const USDC_ERC20_ABI: readonly ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)", "function balanceOf(address owner) view returns (uint256)"];
/** Registry contract addresses keyed by chain ID */
declare const ANS_REGISTRY_ADDRESSES: Record<number, string>;
/** USDC token addresses keyed by chain ID */
declare const ANS_USDC_ADDRESSES: Record<number, string>;
/** Chain IDs supported by ANS */
declare const ANS_SUPPORTED_CHAIN_IDS: readonly [5042002];
/** RPC endpoints keyed by chain ID */
declare const ANS_RPC_URLS: Record<number, string>;
/** Block explorer base URLs keyed by chain ID */
declare const ANS_EXPLORER_URLS: Record<number, string>;
/** Chain metadata */
declare const ANS_CHAINS: Record<number, {
    name: string;
    chainIdHex: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
}>;

export { ANS_CHAINS, ANS_EXPLORER_URLS, ANS_REGISTRY_ABI, ANS_REGISTRY_ADDRESSES, ANS_RESOLVER_ABI, ANS_RPC_URLS, ANS_SUPPORTED_CHAIN_IDS, ANS_USDC_ADDRESSES, USDC_ERC20_ABI };
