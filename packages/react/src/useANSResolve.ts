import { useCallback, useEffect, useRef, useState } from "react";
import { ARCNames, type ResolveReason } from "@arcnames/sdk";
import { useOptionalANSClient } from "./ANSProvider.js";

export type UseANSResolveOptions = {
  /** Debounce delay in ms before resolving. Default: 400 */
  debounceMs?: number;
  /** ARCNames config — required if not wrapped in ANSProvider */
  rpcUrl?: string;
  /** Registry address — required if not wrapped in ANSProvider */
  registryAddress?: string;
};

export type UseANSResolveResult = {
  /** Resolved wallet address, or null */
  address: string | null;
  /** Normalized .arc name, or null if input is not an .arc name */
  arcName: string | null;
  /** Whether a resolution is in progress */
  isResolving: boolean;
  /** Error message, or null */
  error: string | null;
  /** Reason for the resolution result */
  reason: ResolveReason | null;
};

/**
 * Debounced forward resolution: name → address.
 *
 * Accepts raw user input (e.g., "david", "david.arc", or a plain address).
 * If the input looks like an .arc name, it resolves via the registry.
 * If it looks like a raw address, it passes through unchanged.
 *
 * ```ts
 * const { address, arcName, isResolving, error } = useANSResolve(input)
 * ```
 */
export function useANSResolve(
  input: string,
  options: UseANSResolveOptions = {}
): UseANSResolveResult {
  const { debounceMs = 400, rpcUrl, registryAddress } = options;
  const contextClient = useOptionalANSClient();
  const [result, setResult] = useState<UseANSResolveResult>({
    address: null,
    arcName: null,
    isResolving: false,
    error: null,
    reason: null,
  });
  const abortRef = useRef(0);

  const getClient = useCallback((): ARCNames | null => {
    if (contextClient) return contextClient;
    if (rpcUrl && registryAddress) {
      return new ARCNames({ rpcUrl, registryAddress });
    }
    return null;
  }, [contextClient, rpcUrl, registryAddress]);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setResult({ address: null, arcName: null, isResolving: false, error: null, reason: null });
      return;
    }

    // If input looks like a hex address (0x + 40 hex chars), pass through
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setResult({ address: trimmed, arcName: null, isResolving: false, error: null, reason: null });
      return;
    }

    const client = getClient();
    if (!client) {
      setResult({ address: null, arcName: null, isResolving: false, error: "ANS not configured. Provide rpcUrl + registryAddress or wrap in ANSProvider.", reason: null });
      return;
    }

    const requestId = ++abortRef.current;
    setResult((prev) => ({ ...prev, isResolving: true, error: null }));

    const timer = setTimeout(async () => {
      try {
        const res = await client.resolveWithReason(trimmed);
        if (abortRef.current !== requestId) return;
        setResult({
          address: res.address,
          arcName: res.name,
          isResolving: false,
          error: res.reason !== "found" && res.reason !== "invalid_name" ? null : null,
          reason: res.reason,
        });
      } catch (err) {
        if (abortRef.current !== requestId) return;
        setResult({
          address: null,
          arcName: null,
          isResolving: false,
          error: err instanceof Error ? err.message : "Resolution failed",
          reason: null,
        });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [input, debounceMs, getClient]);

  return result;
}
