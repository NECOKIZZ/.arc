"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002");
const ARC_CHAIN_ID_HEX = `0x${ARC_CHAIN_ID.toString(16)}`;
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";
const STORAGE_KEY = "ans_wallet_connected";

interface WalletState {
  wallet: string | null;
  chainId: number | null;
  onArc: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  switchToArc: () => Promise<void>;
  walletError: string | null;
  clearWalletError: () => void;
}

const WalletContext = createContext<WalletState>({
  wallet: null,
  chainId: null,
  onArc: false,
  connecting: false,
  connect: async () => {},
  switchToArc: async () => {},
  walletError: null,
  clearWalletError: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const onArc = chainId === ARC_CHAIN_ID;

  const clearWalletError = useCallback(() => setWalletError(null), []);

  const syncChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const hex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      setChainId(Number.parseInt(hex, 16));
    } catch {}
  }, []);

  const silentReconnect = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
      if (accounts[0]) {
        setWallet(accounts[0]);
        await syncChain();
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, [syncChain]);

  const connect = useCallback(async () => {
    setWalletError(null);
    if (!window.ethereum) {
      setWalletError("No wallet found. Please install MetaMask or another Web3 wallet and refresh the page.");
      return;
    }
    try {
      setConnecting(true);
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      const cidHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
      setWallet(accounts[0] || null);
      setChainId(Number.parseInt(cidHex, 16));
      if (accounts[0]) localStorage.setItem(STORAGE_KEY, "1");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("user denied")) {
        setWalletError("Wallet connection was rejected.");
      } else {
        setWalletError(msg);
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const switchToArc = useCallback(async () => {
    if (!window.ethereum) return;
    setWalletError(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID_HEX }],
      });
      setChainId(ARC_CHAIN_ID);
    } catch (switchErr) {
      const errorCode = (switchErr as { code?: number })?.code;
      if (errorCode === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: ARC_CHAIN_ID_HEX,
                chainName: "Arc Testnet",
                nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
                rpcUrls: [ARC_RPC_URL],
                blockExplorerUrls: ["https://testnet.arcscan.app"],
              },
            ],
          });
          setChainId(ARC_CHAIN_ID);
        } catch (addErr) {
          setWalletError("Failed to add Arc Testnet to your wallet.");
        }
      } else {
        const msg = switchErr instanceof Error ? switchErr.message : String(switchErr);
        if (msg.toLowerCase().includes("user rejected")) {
          setWalletError("Network switch was rejected.");
        } else {
          setWalletError(msg);
        }
      }
    }
  }, []);

  useEffect(() => {
    const wasConnected = localStorage.getItem(STORAGE_KEY);
    if (wasConnected) silentReconnect();

    if (!window.ethereum?.on) return;

    const onAccountsChanged = (accounts: unknown) => {
      const values = Array.isArray(accounts) ? (accounts as string[]) : [];
      if (values[0]) {
        setWallet(values[0]);
        localStorage.setItem(STORAGE_KEY, "1");
      } else {
        setWallet(null);
        setChainId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    };

    const onChainChanged = (value: unknown) => {
      const hex = typeof value === "string" ? value : "0x0";
      setChainId(Number.parseInt(hex, 16));
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, [silentReconnect]);

  return (
    <WalletContext.Provider
      value={{ wallet, chainId, onArc, connecting, connect, switchToArc, walletError, clearWalletError }}
    >
      {children}
    </WalletContext.Provider>
  );
}
