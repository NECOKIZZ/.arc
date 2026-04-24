import { useEffect, useRef, useState } from "react";
import { ARCNames } from "@arcnames/sdk";
import { useOptionalANSClient } from "./ANSProvider.js";

export type UseANSAvailabilityOptions = {
  /** Debounce delay in ms. Default: 400 */
  debounceMs?: number;
  /** ARCNames config — required if not wrapped in ANSProvider */
  rpcUrl?: string;
  /** Registry address — required if not wrapped in ANSProvider */
  registryAddress?: string;
};

export type UseANSAvailabilityResult = {
  /** Whether the name is available for registration */
  available: boolean | null;
  /** Whether the check is in progress */
  isChecking: boolean;
  /** Error message, or null */
  error: string | null;
};

/**
 * Check if an .arc name is available for registration.
 *
 * Debounces input and returns availability status.
 *
 * ```ts
 * const { available, isChecking } = useANSAvailability(nameInput)
 * ```
 */
export function useANSAvailability(
  name: string,
  options: UseANSAvailabilityOptions = {}
): UseANSAvailabilityResult {
  const { debounceMs = 400, rpcUrl, registryAddress } = options;
  const contextClient = useOptionalANSClient();
  const [result, setResult] = useState<UseANSAvailabilityResult>({
    available: null,
    isChecking: false,
    error: null,
  });
  const abortRef = useRef(0);

  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setResult({ available: null, isChecking: false, error: null });
      return;
    }

    let client: ARCNames | null = contextClient;
    if (!client && rpcUrl && registryAddress) {
      client = new ARCNames({ rpcUrl, registryAddress });
    }
    if (!client) {
      setResult({ available: null, isChecking: false, error: "ANS not configured." });
      return;
    }

    const currentClient = client;
    const requestId = ++abortRef.current;
    setResult((prev) => ({ ...prev, isChecking: true, error: null }));

    const timer = setTimeout(async () => {
      try {
        const isAvail = await currentClient.isAvailable(trimmed);
        if (abortRef.current !== requestId) return;
        setResult({ available: isAvail, isChecking: false, error: null });
      } catch (err) {
        if (abortRef.current !== requestId) return;
        setResult({
          available: null,
          isChecking: false,
          error: err instanceof Error ? err.message : "Availability check failed",
        });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [name, debounceMs, contextClient, rpcUrl, registryAddress]);

  return result;
}
