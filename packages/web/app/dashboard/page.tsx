"use client";

import { ARCNames, normalizeName } from "@arc/names";
import { BrowserProvider, Contract, formatUnits, isAddress } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../wallet-context";

const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002");
const ARC_CHAIN_ID_HEX = `0x${ARC_CHAIN_ID.toString(16)}`;
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network";
const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_ANS_REGISTRY_ADDRESS ||
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || "0x3600000000000000000000000000000000000000";
const EXPLORER_BASE_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app/tx/";

const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
] as const;

const registryAbi = [
  "function getOwnedLabels(address wallet) view returns (string[] memory)",
  "function quotePrice(string rawLabel, uint256 yearsCount) view returns (uint256)"
] as const;

type TxHistoryItem = { action: string; name: string; txHash: string; at: number };

export default function DashboardPage() {
  const { wallet, chainId, onArc, connect: connectWallet, switchToArc, walletError, clearWalletError } = useWallet();
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [newResolvedAddress, setNewResolvedAddress] = useState<string>("");
  const [newOwnerAddress, setNewOwnerAddress] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const selectedLabel = useMemo(() => { try { return selectedName ? normalizeName(selectedName) : ""; } catch { return ""; } }, [selectedName]);
  const canManage = Boolean(wallet && onArc && selectedLabel);

  useEffect(() => {
    if (walletError) { setError(walletError); clearWalletError(); }
  }, [walletError, clearWalletError]);

  useEffect(() => {
    if (wallet && window.ethereum) loadOwnedNames(wallet);
  }, [wallet]);

  async function loadOwnedNames(owner: string) {
    try {
      const provider = new BrowserProvider(window.ethereum as any);
      const registry = new Contract(REGISTRY_ADDRESS, registryAbi, provider);
      const raw = await registry.getOwnedLabels(owner);
      const owned = normalizeOwnedLabels(raw);
      setNames(owned);
      const first = owned.length > 0 ? owned[0] : "";
      setSelectedName((current) => (current ? current : first));
    } catch (err) {
      setError(readableError(err));
    }
  }

  function pushTx(action: string, label: string, txHash: string) {
    setTxHistory((prev) => [{ action, name: `${label}.arc`, txHash, at: Date.now() }, ...prev].slice(0, 20));
  }

  async function withSdkAction(actionLabel: string, label: string, action: (sdk: ARCNames) => Promise<string>) {
    if (!window.ethereum || !wallet) { setError("Connect your wallet first."); return; }
    if (!onArc) { setError("Please switch to Arc Testnet in your wallet."); return; }
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);
      const provider = new BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const sdk = new ARCNames({ rpcUrl: ARC_RPC_URL, registryAddress: REGISTRY_ADDRESS, signer });
      const txHash = await action(sdk);
      setSuccess(txHash);
      pushTx(actionLabel, label, txHash);
      if (wallet) await loadOwnedNames(wallet);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function renewName() {
    if (!selectedLabel) return;
    if (!window.ethereum || !wallet) { setError("Connect your wallet first."); return; }
    if (!onArc) { setError("Please switch to Arc Testnet in your wallet."); return; }
    try {
      setBusy(true);
      setError(null);
      setSuccess(null);

      const provider = new BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();

      const usdc = new Contract(USDC_ADDRESS, erc20Abi, signer);
      const registry = new Contract(REGISTRY_ADDRESS, registryAbi, signer);
      const quote = (await registry.quotePrice(selectedLabel, 1)) as bigint;
      const balance = (await usdc.balanceOf(owner)) as bigint;
      if (balance < quote) {
        throw new Error(`You need ${formatUnits(quote, 6)} USDC but only have ${formatUnits(balance, 6)} USDC.`);
      }

      const allowance = (await usdc.allowance(owner, REGISTRY_ADDRESS)) as bigint;
      if (allowance < quote) {
        const approveTx = await usdc.approve(REGISTRY_ADDRESS, quote);
        await approveTx.wait();
      }

      const sdk = new ARCNames({ rpcUrl: ARC_RPC_URL, registryAddress: REGISTRY_ADDRESS, signer });
      const txHash = await sdk.renew(selectedLabel);
      setSuccess(txHash);
      pushTx("Renew", selectedLabel, txHash);
      await loadOwnedNames(wallet);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function setPrimary() {
    if (!selectedLabel) return;
    await withSdkAction("Set Primary", selectedLabel, (sdk) => sdk.setPrimaryName(selectedLabel));
  }

  async function updateResolved() {
    if (!selectedLabel) return;
    if (!isAddress(newResolvedAddress)) { setError("Please enter a valid wallet address."); return; }
    await withSdkAction("Update Address", selectedLabel, (sdk) => sdk.updateResolvedAddress(selectedLabel, newResolvedAddress));
    setNewResolvedAddress("");
  }

  async function transferName() {
    if (!selectedLabel) return;
    if (!isAddress(newOwnerAddress)) { setError("Please enter a valid owner address."); return; }
    await withSdkAction("Transfer", selectedLabel, (sdk) => sdk.transferName(selectedLabel, newOwnerAddress));
    setNewOwnerAddress("");
  }

  async function releaseName() {
    if (!selectedLabel) return;
    const confirmed = window.confirm(`Are you sure you want to release ${selectedLabel}.arc? This cannot be undone.`);
    if (!confirmed) return;
    await withSdkAction("Release", selectedLabel, (sdk) => sdk.releaseName(selectedLabel));
  }

  return (
    <main className="fade-in">
      {/* Wallet */}
      <section className="card mb">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2>Dashboard</h2>
            {wallet ? (
              <p className="text-sm text-secondary mt-sm">
                <span className="font-mono">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                {onArc
                  ? <span className="badge badge-network" style={{ marginLeft: 8 }}><span className="dot dot-green" /> Arc Testnet</span>
                  : <span className="badge badge-warn" style={{ marginLeft: 8 }}><span className="dot dot-yellow" /> Wrong network</span>
                }
              </p>
            ) : (
              <p className="text-sm text-secondary mt-sm">Connect your wallet to manage names</p>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {!wallet && (
              <button type="button" className="btn-primary btn-sm" style={{ width: "auto" }} onClick={connectWallet}>
                Connect wallet
              </button>
            )}
            {wallet && (
              <button type="button" className="btn-sm" style={{ width: "auto" }} onClick={() => loadOwnedNames(wallet)}>
                Refresh
              </button>
            )}
            {wallet && !onArc && (
              <button type="button" className="btn-sm" style={{ width: "auto" }} onClick={switchToArc}>
                Switch to Arc
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Messages */}
      {error && <div className="msg msg-error mb">{error}</div>}
      {success && (
        <div className="msg msg-success mb">
          Transaction confirmed.{" "}
          <a href={`${EXPLORER_BASE_URL}${success}`} target="_blank" rel="noreferrer">View on explorer &rarr;</a>
        </div>
      )}

      {/* Names */}
      {names.length > 0 ? (
        <>
          <section className="card mb">
            <span className="label">Select a name to manage</span>
            <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
              {names.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </section>

          {selectedLabel && (
            <>
              {/* Quick actions */}
              <div className="grid grid-2">
                <section className="card">
                  <h3 className="mb">Renew</h3>
                  <p className="text-xs text-secondary mb">Extend registration for another year. Requires USDC approval.</p>
                  <button type="button" onClick={renewName} disabled={busy || !canManage}>
                    {busy ? <><span className="spinner" /> Renewing...</> : `Renew ${selectedLabel}.arc`}
                  </button>
                </section>

                <section className="card">
                  <h3 className="mb">Primary name</h3>
                  <p className="text-xs text-secondary mb">Set this name as your reverse-lookup identity.</p>
                  <button type="button" onClick={setPrimary} disabled={busy || !canManage}>
                    {busy ? <><span className="spinner" /> Setting...</> : "Set as primary"}
                  </button>
                </section>
              </div>

              <section className="card mt">
                <h3 className="mb">Update resolved address</h3>
                <p className="text-xs text-secondary mb">Change which wallet address this name points to.</p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={newResolvedAddress}
                    onChange={(e) => setNewResolvedAddress(e.target.value)}
                    placeholder="0x..."
                  />
                  <button type="button" onClick={updateResolved} disabled={busy || !canManage} style={{ width: "auto", flexShrink: 0 }}>
                    Update
                  </button>
                </div>
              </section>

              <section className="card mt">
                <h3 className="mb">Transfer ownership</h3>
                <p className="text-xs text-secondary mb">Send this name to a different wallet. You will lose control.</p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    value={newOwnerAddress}
                    onChange={(e) => setNewOwnerAddress(e.target.value)}
                    placeholder="New owner address 0x..."
                  />
                  <button type="button" onClick={transferName} disabled={busy || !canManage} style={{ width: "auto", flexShrink: 0 }}>
                    Transfer
                  </button>
                </div>
              </section>

              <section className="card mt">
                <h3 className="mb">Release name</h3>
                <p className="text-xs text-secondary mb">Permanently give up this name. It becomes available for anyone to register.</p>
                <button type="button" className="btn-danger" onClick={releaseName} disabled={busy || !canManage}>
                  Release {selectedLabel}.arc
                </button>
              </section>
            </>
          )}
        </>
      ) : wallet ? (
        <div className="card text-center" style={{ padding: "2.5rem 1.5rem" }}>
          <p className="text-secondary">You don&apos;t own any <strong>.arc</strong> names yet.</p>
          <p className="text-xs text-secondary mt-sm">
            <a href="/register">Register one &rarr;</a>
          </p>
        </div>
      ) : null}

      {/* Tx history */}
      {txHistory.length > 0 && (
        <div className="mt-lg">
          <button type="button" className="collapsible-trigger" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? "\u25BE" : "\u25B8"} Recent transactions ({txHistory.length})
          </button>
          {showHistory && (
            <ul className="log-list">
              {txHistory.map((item) => (
                <li key={`${item.txHash}-${item.at}`}>
                  {item.action} <strong>{item.name}</strong>{" "}
                  <a href={`${EXPLORER_BASE_URL}${item.txHash}`} target="_blank" rel="noreferrer">
                    {item.txHash.slice(0, 10)}...
                  </a>{" "}
                  {new Date(item.at).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}

function readableError(err: unknown): string {
  const msg = err instanceof Error
    ? err.message
    : (typeof err === "object" && err !== null && "message" in err)
      ? String((err as { message: unknown }).message)
      : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("you need") || lower.includes("insufficient usdc")) return msg;
  if (lower.includes("user rejected") || lower.includes("user denied")) return "You rejected the transaction in your wallet.";
  if (lower.includes("notlabelowner")) return "You don\u2019t own this name.";
  if (lower.includes("nameexpired")) return "This name has expired and can no longer be managed.";
  if (lower.includes("namenotfound")) return "This name doesn\u2019t exist on-chain.";
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) return "Not enough USDC for gas and fees.";
  if (lower.includes("revert")) return "Transaction failed on-chain. Check that you own this name and have enough USDC.";
  if (lower.includes("network") || lower.includes("fetch")) return "Network error. Check your connection and try again.";
  return msg;
}

function normalizeOwnedLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    if (value.length > 0 && Array.isArray(value[0])) {
      return (value[0] as unknown[]).map((v) => String(v));
    }
    return value.map((v) => String(v));
  }
  if (value && typeof value === "object" && "labels" in (value as Record<string, unknown>)) {
    const labels = (value as { labels?: unknown }).labels;
    if (Array.isArray(labels)) {
      return labels.map((v) => String(v));
    }
  }
  return [];
}
