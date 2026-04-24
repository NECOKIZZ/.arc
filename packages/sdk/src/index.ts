import { Contract, JsonRpcProvider, Signer, isAddress, randomBytes, solidityPackedKeccak256 } from "ethers";
import QRCode from "qrcode";
import { ANS_REGISTRY_ABI } from "./constants.js";

export * from "./constants.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type NameInfo = {
  name: string;
  address: string | null;
  owner: string | null;
  expiry: number | null;
  isExpired: boolean;
  isReserved: boolean;
};

export type ResolveReason = "found" | "not_registered" | "expired" | "reserved" | "invalid_name";

export type ResolveResult = {
  address: string | null;
  name: string;
  reason: ResolveReason;
};

export type BatchResolveResult = {
  name: string;
  address: string | null;
};

export type ARCNamesConfig = {
  rpcUrl: string;
  registryAddress: string;
  cacheTimeout?: number;
  signer?: Signer;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class ARCNames {
  private readonly provider: JsonRpcProvider;
  private readonly registryAddress: string;
  private readonly cacheTimeout: number;
  private readonly readContract: Contract;
  private readonly signer?: Signer;
  private readonly writeContract?: Contract;
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private commitModeChecked = false;
  private commitModeSupported = false;

  constructor(config: ARCNamesConfig) {
    if (!isAddress(config.registryAddress)) {
      throw new Error("Invalid registry address");
    }
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.registryAddress = config.registryAddress;
    this.cacheTimeout = config.cacheTimeout ?? 60_000;
    this.readContract = new Contract(this.registryAddress, ANS_REGISTRY_ABI, this.provider);
    this.signer = config.signer;
    this.writeContract = config.signer ? (this.readContract.connect(config.signer) as Contract) : undefined;
  }

  async resolve(rawName: string): Promise<string | null> {
    const name = normalizeName(rawName);
    const key = `resolve:${name}`;
    const cached = this.getCache<string | null>(key);
    if (cached !== undefined) return cached;

    const address = (await this.readContract.resolve(name)) as string;
    const result = address === ZERO_ADDRESS ? null : address;
    this.setCache(key, result);
    return result;
  }

  async reverseLookup(address: string): Promise<string | null> {
    if (!isAddress(address)) throw new Error("Invalid wallet address");
    const key = `reverse:${address.toLowerCase()}`;
    const cached = this.getCache<string | null>(key);
    if (cached !== undefined) return cached;

    const value = (await this.readContract.reverseResolve(address)) as string;
    const result = value.length ? value : null;
    this.setCache(key, result);
    return result;
  }

  async isAvailable(rawName: string): Promise<boolean> {
    const name = normalizeName(rawName);
    const key = `available:${name}`;
    const cached = this.getCache<boolean>(key);
    if (cached !== undefined) return cached;

    const result = (await this.readContract.isAvailable(name)) as boolean;
    this.setCache(key, result);
    return result;
  }

  async getNameInfo(rawName: string): Promise<NameInfo> {
    const name = normalizeName(rawName);
    const key = `info:${name}`;
    const cached = this.getCache<NameInfo>(key);
    if (cached !== undefined) return cached;

    const [owner, resolvedAddress, expiry, expired, reserved] =
      (await this.readContract.getRecord(name)) as [string, string, bigint, boolean, boolean];

    const info: NameInfo = {
      name: `${name}.arc`,
      address: resolvedAddress === ZERO_ADDRESS ? null : resolvedAddress,
      owner: owner === ZERO_ADDRESS ? null : owner,
      expiry: expiry === 0n ? null : Number(expiry),
      isExpired: Boolean(expired),
      isReserved: Boolean(reserved)
    };

    this.setCache(key, info);
    return info;
  }

  async quotePrice(rawName: string, years = 1): Promise<bigint> {
    const name = normalizeName(rawName);
    return (await this.readContract.quotePrice(name, years)) as bigint;
  }

  async resolveWithReason(rawName: string): Promise<ResolveResult> {
    let name: string;
    try {
      name = normalizeName(rawName);
    } catch {
      return { address: null, name: rawName, reason: "invalid_name" };
    }

    const key = `info:${name}`;
    const cached = this.getCache<NameInfo>(key);
    const info = cached ?? await (async () => {
      const [owner, resolvedAddress, expiry, expired, reserved] =
        (await this.readContract.getRecord(name)) as [string, string, bigint, boolean, boolean];
      const result: NameInfo = {
        name: `${name}.arc`,
        address: resolvedAddress === ZERO_ADDRESS ? null : resolvedAddress,
        owner: owner === ZERO_ADDRESS ? null : owner,
        expiry: expiry === 0n ? null : Number(expiry),
        isExpired: Boolean(expired),
        isReserved: Boolean(reserved),
      };
      this.setCache(key, result);
      return result;
    })();

    if (info.isReserved) return { address: null, name: `${name}.arc`, reason: "reserved" };
    if (!info.owner) return { address: null, name: `${name}.arc`, reason: "not_registered" };
    if (info.isExpired) return { address: null, name: `${name}.arc`, reason: "expired" };
    return { address: info.address, name: `${name}.arc`, reason: "found" };
  }

  async resolveMany(rawNames: string[]): Promise<BatchResolveResult[]> {
    const CHUNK_SIZE = 50;
    const results: BatchResolveResult[] = [];

    for (let i = 0; i < rawNames.length; i += CHUNK_SIZE) {
      const chunk = rawNames.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (raw) => {
        try {
          const name = normalizeName(raw);
          const addr = await this.resolve(name);
          return { name: `${name}.arc`, address: addr };
        } catch {
          return { name: raw, address: null };
        }
      });
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults);
    }

    return results;
  }

  async getQRCodeDataUrl(rawName: string, baseUrl = "https://arcnames.io/pay"): Promise<string> {
    const name = normalizeName(rawName);
    return QRCode.toDataURL(`${baseUrl}/${name}.arc`, {
      errorCorrectionLevel: "M",
      width: 300
    });
  }

  async register(rawName: string, resolvedAddress?: string): Promise<string> {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const target = resolvedAddress ?? (this.signer ? await this.signer.getAddress() : undefined);
    if (!target || !isAddress(target)) {
      throw new Error("A valid resolved address is required");
    }

    const supportsCommitReveal = await this.detectCommitRevealSupport();
    if (!supportsCommitReveal) {
      const tx = await contract.register(name, target);
      const receipt = await tx.wait();
      this.evictNameCaches(name);
      return receipt.hash;
    }

    const signerAddress = this.signer ? await this.signer.getAddress() : null;
    if (!signerAddress) throw new Error("Signer address is required for registration");

    const salt = randomBytes(32);
    const labelHash = solidityPackedKeccak256(["string"], [name]);
    const commitment = solidityPackedKeccak256(["address", "bytes32", "bytes32"], [signerAddress, labelHash, salt]);

    const commitTx = await contract.submitCommitment(commitment);
    await commitTx.wait();

    const tx = await contract.registerWithCommit(name, target, salt);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }

  async renew(rawName: string): Promise<string> {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.renew(name);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }

  async releaseName(rawName: string): Promise<string> {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.release(name);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }

  async updateResolvedAddress(rawName: string, newAddress: string): Promise<string> {
    if (!isAddress(newAddress)) throw new Error("Invalid address");
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.updateResolvedAddress(name, newAddress);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }

  async transferName(rawName: string, newOwner: string): Promise<string> {
    if (!isAddress(newOwner)) throw new Error("Invalid owner address");
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.transferName(name, newOwner);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }

  async setPrimaryName(rawName: string): Promise<string> {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.setPrimaryName(name);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }

  private requireWriter(): Contract {
    if (!this.writeContract) {
      throw new Error("This operation requires a signer");
    }
    return this.writeContract;
  }

  private getCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private setCache<T>(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTimeout });
  }

  private evictNameCaches(name: string): void {
    const suffix = `${name}.arc`;
    for (const key of this.cache.keys()) {
      if (key.includes(name) || key.includes(suffix)) {
        this.cache.delete(key);
      }
    }
  }

  private async detectCommitRevealSupport(): Promise<boolean> {
    if (this.commitModeChecked) return this.commitModeSupported;
    this.commitModeChecked = true;
    try {
      const provider = this.provider;
      const data = this.readContract.interface.encodeFunctionData("commitRevealRequired", []);
      const result = await provider.call({ to: this.registryAddress, data });
      const decoded = this.readContract.interface.decodeFunctionResult("commitRevealRequired", result);
      this.commitModeSupported = Boolean(decoded[0]);
    } catch {
      this.commitModeSupported = false;
    }
    return this.commitModeSupported;
  }
}

export function normalizeName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") {
    throw new Error("Name is required");
  }
  const trimmed = rawName.trim().toLowerCase();
  const label = trimmed.endsWith(".arc") ? trimmed.slice(0, -4) : trimmed;

  if (label.length < 3 || label.length > 32) {
    throw new Error("Name length must be between 3 and 32 characters");
  }
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error("Name must use only lowercase letters, numbers, and hyphens");
  }
  if (label.startsWith("-") || label.endsWith("-")) {
    throw new Error("Name cannot start or end with a hyphen");
  }

  return label;
}
