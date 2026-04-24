import { Signer } from 'ethers';
export { ANS_CHAINS, ANS_EXPLORER_URLS, ANS_REGISTRY_ABI, ANS_REGISTRY_ADDRESSES, ANS_RESOLVER_ABI, ANS_RPC_URLS, ANS_SUPPORTED_CHAIN_IDS, ANS_USDC_ADDRESSES, USDC_ERC20_ABI } from './constants.js';

type NameInfo = {
    name: string;
    address: string | null;
    owner: string | null;
    expiry: number | null;
    isExpired: boolean;
    isReserved: boolean;
};
type ResolveReason = "found" | "not_registered" | "expired" | "reserved" | "invalid_name";
type ResolveResult = {
    address: string | null;
    name: string;
    reason: ResolveReason;
};
type BatchResolveResult = {
    name: string;
    address: string | null;
};
type ARCNamesConfig = {
    rpcUrl: string;
    registryAddress: string;
    cacheTimeout?: number;
    signer?: Signer;
};
declare class ARCNames {
    private readonly provider;
    private readonly registryAddress;
    private readonly cacheTimeout;
    private readonly readContract;
    private readonly signer?;
    private readonly writeContract?;
    private readonly cache;
    private commitModeChecked;
    private commitModeSupported;
    constructor(config: ARCNamesConfig);
    resolve(rawName: string): Promise<string | null>;
    reverseLookup(address: string): Promise<string | null>;
    isAvailable(rawName: string): Promise<boolean>;
    getNameInfo(rawName: string): Promise<NameInfo>;
    quotePrice(rawName: string, years?: number): Promise<bigint>;
    resolveWithReason(rawName: string): Promise<ResolveResult>;
    resolveMany(rawNames: string[]): Promise<BatchResolveResult[]>;
    getQRCodeDataUrl(rawName: string, baseUrl?: string): Promise<string>;
    register(rawName: string, resolvedAddress?: string): Promise<string>;
    renew(rawName: string): Promise<string>;
    releaseName(rawName: string): Promise<string>;
    updateResolvedAddress(rawName: string, newAddress: string): Promise<string>;
    transferName(rawName: string, newOwner: string): Promise<string>;
    setPrimaryName(rawName: string): Promise<string>;
    private requireWriter;
    private getCache;
    private setCache;
    private evictNameCaches;
    private detectCommitRevealSupport;
}
declare function normalizeName(rawName: string): string;

export { ARCNames, type ARCNamesConfig, type BatchResolveResult, type NameInfo, type ResolveReason, type ResolveResult, normalizeName };
