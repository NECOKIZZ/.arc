import {
  ANS_CHAINS,
  ANS_EXPLORER_URLS,
  ANS_REGISTRY_ABI,
  ANS_REGISTRY_ADDRESSES,
  ANS_RESOLVER_ABI,
  ANS_RPC_URLS,
  ANS_SUPPORTED_CHAIN_IDS,
  ANS_USDC_ADDRESSES,
  USDC_ERC20_ABI
} from "./chunk-NPQJYXJZ.js";

// src/index.ts
import { Contract, JsonRpcProvider, isAddress, randomBytes, solidityPackedKeccak256 } from "ethers";
import QRCode from "qrcode";
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
var ARCNames = class {
  provider;
  registryAddress;
  cacheTimeout;
  readContract;
  signer;
  writeContract;
  cache = /* @__PURE__ */ new Map();
  commitModeChecked = false;
  commitModeSupported = false;
  constructor(config) {
    if (!isAddress(config.registryAddress)) {
      throw new Error("Invalid registry address");
    }
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.registryAddress = config.registryAddress;
    this.cacheTimeout = config.cacheTimeout ?? 6e4;
    this.readContract = new Contract(this.registryAddress, ANS_REGISTRY_ABI, this.provider);
    this.signer = config.signer;
    this.writeContract = config.signer ? this.readContract.connect(config.signer) : void 0;
  }
  async resolve(rawName) {
    const name = normalizeName(rawName);
    const key = `resolve:${name}`;
    const cached = this.getCache(key);
    if (cached !== void 0) return cached;
    const address = await this.readContract.resolve(name);
    const result = address === ZERO_ADDRESS ? null : address;
    this.setCache(key, result);
    return result;
  }
  async reverseLookup(address) {
    if (!isAddress(address)) throw new Error("Invalid wallet address");
    const key = `reverse:${address.toLowerCase()}`;
    const cached = this.getCache(key);
    if (cached !== void 0) return cached;
    const value = await this.readContract.reverseResolve(address);
    const result = value.length ? value : null;
    this.setCache(key, result);
    return result;
  }
  async isAvailable(rawName) {
    const name = normalizeName(rawName);
    const key = `available:${name}`;
    const cached = this.getCache(key);
    if (cached !== void 0) return cached;
    const result = await this.readContract.isAvailable(name);
    this.setCache(key, result);
    return result;
  }
  async getNameInfo(rawName) {
    const name = normalizeName(rawName);
    const key = `info:${name}`;
    const cached = this.getCache(key);
    if (cached !== void 0) return cached;
    const [owner, resolvedAddress, expiry, expired, reserved] = await this.readContract.getRecord(name);
    const info = {
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
  async quotePrice(rawName, years = 1) {
    const name = normalizeName(rawName);
    return await this.readContract.quotePrice(name, years);
  }
  async resolveWithReason(rawName) {
    let name;
    try {
      name = normalizeName(rawName);
    } catch {
      return { address: null, name: rawName, reason: "invalid_name" };
    }
    const key = `info:${name}`;
    const cached = this.getCache(key);
    const info = cached ?? await (async () => {
      const [owner, resolvedAddress, expiry, expired, reserved] = await this.readContract.getRecord(name);
      const result = {
        name: `${name}.arc`,
        address: resolvedAddress === ZERO_ADDRESS ? null : resolvedAddress,
        owner: owner === ZERO_ADDRESS ? null : owner,
        expiry: expiry === 0n ? null : Number(expiry),
        isExpired: Boolean(expired),
        isReserved: Boolean(reserved)
      };
      this.setCache(key, result);
      return result;
    })();
    if (info.isReserved) return { address: null, name: `${name}.arc`, reason: "reserved" };
    if (!info.owner) return { address: null, name: `${name}.arc`, reason: "not_registered" };
    if (info.isExpired) return { address: null, name: `${name}.arc`, reason: "expired" };
    return { address: info.address, name: `${name}.arc`, reason: "found" };
  }
  async resolveMany(rawNames) {
    const CHUNK_SIZE = 50;
    const results = [];
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
  async getQRCodeDataUrl(rawName, baseUrl = "https://arcnames.io/pay") {
    const name = normalizeName(rawName);
    return QRCode.toDataURL(`${baseUrl}/${name}.arc`, {
      errorCorrectionLevel: "M",
      width: 300
    });
  }
  async register(rawName, resolvedAddress) {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const target = resolvedAddress ?? (this.signer ? await this.signer.getAddress() : void 0);
    if (!target || !isAddress(target)) {
      throw new Error("A valid resolved address is required");
    }
    const supportsCommitReveal = await this.detectCommitRevealSupport();
    if (!supportsCommitReveal) {
      const tx2 = await contract.register(name, target);
      const receipt2 = await tx2.wait();
      this.evictNameCaches(name);
      return receipt2.hash;
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
  async renew(rawName) {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.renew(name);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }
  async releaseName(rawName) {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.release(name);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }
  async updateResolvedAddress(rawName, newAddress) {
    if (!isAddress(newAddress)) throw new Error("Invalid address");
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.updateResolvedAddress(name, newAddress);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }
  async transferName(rawName, newOwner) {
    if (!isAddress(newOwner)) throw new Error("Invalid owner address");
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.transferName(name, newOwner);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }
  async setPrimaryName(rawName) {
    const contract = this.requireWriter();
    const name = normalizeName(rawName);
    const tx = await contract.setPrimaryName(name);
    const receipt = await tx.wait();
    this.evictNameCaches(name);
    return receipt.hash;
  }
  requireWriter() {
    if (!this.writeContract) {
      throw new Error("This operation requires a signer");
    }
    return this.writeContract;
  }
  getCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return void 0;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return void 0;
    }
    return entry.value;
  }
  setCache(key, value) {
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTimeout });
  }
  evictNameCaches(name) {
    const suffix = `${name}.arc`;
    for (const key of this.cache.keys()) {
      if (key.includes(name) || key.includes(suffix)) {
        this.cache.delete(key);
      }
    }
  }
  async detectCommitRevealSupport() {
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
};
function normalizeName(rawName) {
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
export {
  ANS_CHAINS,
  ANS_EXPLORER_URLS,
  ANS_REGISTRY_ABI,
  ANS_REGISTRY_ADDRESSES,
  ANS_RESOLVER_ABI,
  ANS_RPC_URLS,
  ANS_SUPPORTED_CHAIN_IDS,
  ANS_USDC_ADDRESSES,
  ARCNames,
  USDC_ERC20_ABI,
  normalizeName
};
