import { useEffect, useRef, useState } from "react";
import { ARCNames } from "@arcnames/sdk";
import { useOptionalANSClient } from "./ANSProvider.js";

export type UseANSReverseOptions = {
  /** ARCNames config — required if not wrapped in ANSProvider */
  rpcUrl?: string;
  /** Registry address — required if not wrapped in ANSProvider */
  registryAddress?: string;
};

export type UseANSReverseResult = {
  /** The .arc name for this address, or null */
  arcName: string | null;
  /** Whether the lookup is in progress */
  isLoading: boolean;
  /** Error message, or null */
  error: string | null;
};

/**
 * Reverse lookup: address → .arc name.
 *
 * Returns the primary .arc name associated with a wallet address.
 * Useful for displaying human-readable names in navbars, profiles, tx history.
 *
 * ```ts
 * const { arcName, isLoading } = useANSReverse(walletAddress)
 * // Display: arcName ?? truncateAddress(walletAddress)
 * ```
 */
export function useANSReverse(
  address: string | null | undefined,
  options: UseANSReverseOptions = {}
): UseANSReverseResult {
  const { rpcUrl, registryAddress } = options;
  const contextClient = useOptionalANSClient();
  const [result, setResult] = useState<UseANSReverseResult>({
    arcName: null,
    isLoading: false,
    error: null,
  });
  const abortRef = useRef(0);

  useEffect(() => {
    if (!address) {
      setResult({ arcName: null, isLoading: false, error: null });
      return;
    }

    let client: ARCNames | null = contextClient;
    if (!client && rpcUrl && registryAddress) {
      client = new ARCNames({ rpcUrl, registryAddress });
    }
    if (!client) {
      setResult({ arcName: null, isLoading: false, error: "ANS not configured." });
      return;
    }

    const requestId = ++abortRef.current;
    setResult((prev) => ({ ...prev, isLoading: true, error: null }));

    client
      .reverseLookup(address)
      .then((name) => {
        if (abortRef.current !== requestId) return;
        setResult({ arcName: name, isLoading: false, error: null });
      })
      .catch((err) => {
        if (abortRef.current !== requestId) return;
        setResult({
          arcName: null,
          isLoading: false,
          error: err instanceof Error ? err.message : "Reverse lookup failed",
        });
      });
  }, [address, contextClient, rpcUrl, registryAddress]);

  return result;
}
