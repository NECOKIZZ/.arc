import { createContext, useContext, useMemo } from "react";
import { ARCNames, type ARCNamesConfig } from "@arcnames/sdk";

const ANSContext = createContext<ARCNames | null>(null);

export type ANSProviderProps = {
  config: ARCNamesConfig;
  children: React.ReactNode;
};

/**
 * Provides a shared ARCNames SDK instance to all child components.
 * Wrap your app (or a subtree) with this provider to avoid creating
 * a new SDK instance in every hook call.
 *
 * ```tsx
 * <ANSProvider config={{ rpcUrl: "...", registryAddress: "..." }}>
 *   <App />
 * </ANSProvider>
 * ```
 */
export function ANSProvider({ config, children }: ANSProviderProps) {
  const client = useMemo(
    () => new ARCNames(config),
    [config.rpcUrl, config.registryAddress, config.cacheTimeout]
  );

  return <ANSContext.Provider value={client}>{children}</ANSContext.Provider>;
}

/**
 * Returns the ARCNames SDK instance from the nearest ANSProvider.
 * Throws if used outside of an ANSProvider.
 */
export function useANSClient(): ARCNames {
  const client = useContext(ANSContext);
  if (!client) {
    throw new Error("useANSClient must be used within an <ANSProvider>");
  }
  return client;
}

/**
 * Returns the ARCNames instance from context, or null if no provider exists.
 * Used internally by hooks to optionally consume context.
 */
export function useOptionalANSClient(): ARCNames | null {
  return useContext(ANSContext);
}
