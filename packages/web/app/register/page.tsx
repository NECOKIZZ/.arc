"use client";

import { ARCNames, normalizeName, ANS_REGISTRY_ADDRESSES, ANS_USDC_ADDRESSES, ANS_RPC_URLS, ANS_REGISTRY_ABI, USDC_ERC20_ABI } from "@arcnames/sdk";
import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  formatUnits,
  isAddress,
} from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../wallet-context";

const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002");
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || ANS_RPC_URLS[ARC_CHAIN_ID] || "https://rpc.testnet.arc.network";
const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_ANS_REGISTRY_ADDRESS ||
  ANS_REGISTRY_ADDRESSES[ARC_CHAIN_ID] || "";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || ANS_USDC_ADDRESSES[ARC_CHAIN_ID] || "";

type FlowStep = "idle" | "balance" | "approve" | "register" | "done" | "failed";
type NameType = "human" | "agent" | "payment";

const NAME_TYPES: { type: NameType; emoji: string; label: string; desc: string; suffix: string }[] = [
  { type: "human", emoji: "\u{1F9D1}", label: "Human", desc: "Personal identity", suffix: "" },
  { type: "agent", emoji: "\u{1F916}", label: "AI Agent", desc: "Requires -agent suffix", suffix: "-agent" },
  { type: "payment", emoji: "\u{1F4B8}", label: "Payment App", desc: "Requires -usdc suffix", suffix: "-usdc" },
];

export default function RegisterPage() {
  const { wallet, chainId, onArc, connect: connectWallet, switchToArc, walletError, clearWalletError } = useWallet();
  const [nameType, setNameType] = useState<NameType>("human");
  const [rawName, setRawName] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checkedName, setCheckedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [success, setSuccess] = useState<string | null>(null);
  const [txLogs, setTxLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const selectedType = NAME_TYPES.find((t) => t.type === nameType)!;
  const fullName = rawName.trim() ? `${rawName.trim().toLowerCase().replace(/\.arc$/, "")}${selectedType.suffix}` : "";
  const displayName = fullName ? `${fullName}.arc` : "";

  const canRegister = useMemo(() => {
    return Boolean(fullName && wallet && onArc && REGISTRY_ADDRESS && isAddress(REGISTRY_ADDRESS));
  }, [fullName, wallet, onArc]);

  function pushTxLog(message: string) {
    setTxLogs((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 25));
  }

  async function runDiagnostics() {
    const lines: string[] = [];
    const hasWallet = Boolean(window.ethereum);
    lines.push(`wallet_provider: ${hasWallet ? "detected" : "missing"}`);
    lines.push(`registry: ${REGISTRY_ADDRESS}`);
    lines.push(`wallet: ${wallet ?? "not connected"}`);
    lines.push(`chain: ${chainId ?? "unknown"} ${onArc ? "(Arc Testnet)" : ""}`);

    try {
      const rpcProvider = new JsonRpcProvider(ARC_RPC_URL);
      const block = await rpcProvider.getBlockNumber();
      lines.push(`rpc: reachable (block ${block})`);
    } catch (err) {
      lines.push(`rpc: unreachable (${readableError(err)})`);
    }

    if (wallet && hasWallet && isAddress(REGISTRY_ADDRESS)) {
      try {
        const provider = new BrowserProvider(window.ethereum as any);
        const signer = await provider.getSigner();
        const usdc = new Contract(USDC_ADDRESS, USDC_ERC20_ABI, signer);
        const registry = new Contract(REGISTRY_ADDRESS, ANS_REGISTRY_ABI, signer);
        const balance = (await usdc.balanceOf(wallet)) as bigint;
        const quote = (await registry.quotePrice("random", 1)) as bigint;
        const allowance = (await usdc.allowance(wallet, REGISTRY_ADDRESS)) as bigint;
        lines.push(`balance: ${formatUnits(balance, 6)} USDC`);
        lines.push(`base_fee: ${formatUnits(quote, 6)} USDC`);
        lines.push(`allowance: ${formatUnits(allowance, 6)} USDC`);
      } catch (err) {
        lines.push(`rpc_check: failed (${readableError(err)})`);
      }
    }

    setDiagnostics(lines);
  }

  useEffect(() => {
    runDiagnostics().catch(() => {});
  }, [wallet, chainId]);

  useEffect(() => {
    if (walletError) { setError(walletError); clearWalletError(); }
  }, [walletError, clearWalletError]);

  async function checkAvailability() {
    if (!fullName) return;
    setLoading(true);
    setError(null);
    setAvailable(null);
    setCheckedName("");
    setSuccess(null);
    try {
      if (!REGISTRY_ADDRESS || !isAddress(REGISTRY_ADDRESS)) {
        throw new Error("Registry address is not configured.");
      }
      const label = normalizeName(fullName);
      const ans = new ARCNames({
        rpcUrl: ARC_RPC_URL,
        registryAddress: REGISTRY_ADDRESS
      });
      const isAvail = await ans.isAvailable(label);
      setAvailable(isAvail);
      setCheckedName(`${label}.arc`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function approveAndRegister() {
    setError(null);
    setSuccess(null);
    if (!window.ethereum) { setError("No wallet found. Install a Web3 wallet and refresh."); return; }
    if (!wallet) { setError("Connect your wallet first."); return; }
    if (!onArc) { setError("Please switch to Arc Testnet in your wallet."); return; }
    if (!REGISTRY_ADDRESS || !isAddress(REGISTRY_ADDRESS)) { setError("Registry not configured."); return; }

    try {
      setLoading(true);
      setTxLogs([]);
      setFlowStep("balance");
      pushTxLog("Preparing transaction");
      const provider = new BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();

      const label = normalizeName(fullName);
      const sdk = new ARCNames({
        rpcUrl: ARC_RPC_URL,
        registryAddress: REGISTRY_ADDRESS,
        signer
      });
      const registry = new Contract(REGISTRY_ADDRESS, ANS_REGISTRY_ABI, signer);

      pushTxLog("Checking USDC balance");
      const usdc = new Contract(USDC_ADDRESS, USDC_ERC20_ABI, signer);
      const balance = (await usdc.balanceOf(owner)) as bigint;
      const quote = (await registry.quotePrice(label, 1)) as bigint;
      if (balance < quote) {
        throw new Error(`You need ${formatUnits(quote, 6)} USDC but only have ${formatUnits(balance, 6)} USDC. Get testnet USDC from the Circle faucet.`);
      }

      setFlowStep("approve");
      const allowance = (await usdc.allowance(owner, REGISTRY_ADDRESS)) as bigint;
      if (allowance < quote) {
        pushTxLog(`Requesting USDC approval (${formatUnits(quote, 6)} USDC)`);
        const approveTx = await usdc.approve(REGISTRY_ADDRESS, quote);
        pushTxLog("Waiting for approval confirmation...");
        await approveTx.wait();
        pushTxLog("Approval confirmed");
      } else {
        pushTxLog("USDC already approved");
      }

      setFlowStep("register");
      let commitMode = false;
      try { commitMode = Boolean(await registry.commitRevealRequired()); } catch { commitMode = false; }
      pushTxLog(`Mode: ${commitMode ? "commit-reveal" : "direct"}`);

      pushTxLog("Submitting registration...");
      const txHash = await sdk.register(label, owner);
      pushTxLog(`Confirmed: ${txHash}`);
      setSuccess(txHash);
      setFlowStep("done");
      setAvailable(false);
      setCheckedName(`${label}.arc`);
      await runDiagnostics();
    } catch (err) {
      setError(readableError(err));
      setFlowStep("failed");
      pushTxLog(`Error: ${readableError(err)}`);
    } finally {
      setLoading(false);
    }
  }

  const stepIndex = flowStep === "balance" ? 0 : flowStep === "approve" ? 1 : flowStep === "register" ? 2 : flowStep === "done" ? 3 : -1;

  return (
    <main className="fade-in">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2.5rem" }}>Claim your <span className="text-accent">.arc</span> name</h1>
        <p className="text-secondary mt-sm" style={{ fontSize: "1.05rem" }}>
          Choose what you&apos;re registering, pick a name, and you&apos;re live on Arc.
        </p>
      </div>

      <div className="container-narrow">
        {/* Wallet bar */}
        <section className="card mb" style={{ padding: "1rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {wallet ? (
                <>
                  <span className="font-mono text-sm">{wallet.slice(0, 6)}...{wallet.slice(-4)}</span>
                  {onArc
                    ? <span className="badge badge-network"><span className="dot dot-blue" /> Arc</span>
                    : <span className="badge badge-warn"><span className="dot dot-yellow" /> Wrong network</span>
                  }
                </>
              ) : (
                <span className="text-sm text-secondary">Wallet not connected</span>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {!wallet && (
                <button type="button" className="btn-primary btn-sm" style={{ width: "auto" }} onClick={connectWallet}>
                  Connect Wallet
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

        {/* Type Selector */}
        <div className="type-selector">
          {NAME_TYPES.map((t) => (
            <div
              key={t.type}
              className={`type-option ${nameType === t.type ? "selected" : ""}`}
              onClick={() => { setNameType(t.type); setAvailable(null); setCheckedName(""); setError(null); }}
            >
              <span className="type-emoji">{t.emoji}</span>
              <span className="type-label">{t.label}</span>
              <span className="type-desc">{t.desc}</span>
            </div>
          ))}
        </div>

        {/* Name input */}
        <section className="card card-glow">
          <label className="label">
            {nameType === "human" ? "Choose your name" : nameType === "agent" ? "Agent name" : "App name"}
          </label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <input
                className="input-lg"
                value={rawName}
                onChange={(e) => { setRawName(e.target.value); setAvailable(null); setCheckedName(""); }}
                placeholder={nameType === "human" ? "alice" : nameType === "agent" ? "mybot" : "payflow"}
                onKeyDown={(e) => { if (e.key === "Enter" && fullName) checkAvailability(); }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={checkAvailability}
              disabled={loading || !fullName}
              style={{ width: "auto", flexShrink: 0, padding: "0.85rem 1.5rem" }}
            >
              {loading && flowStep === "idle" ? <><span className="spinner" /> Checking</> : "Search"}
            </button>
          </div>

          {/* Preview */}
          {fullName && (
            <div style={{ marginTop: "0.75rem", padding: "0.6rem 1rem", background: "var(--cream)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="text-xs text-secondary">Will register as:</span>
              <span style={{ fontWeight: 700, fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: "1rem" }}>
                {displayName}
              </span>
              {nameType === "agent" && <span className="badge badge-agent">Agent</span>}
              {nameType === "payment" && <span className="badge badge-usdc">Payment</span>}
            </div>
          )}

          {/* Availability result */}
          {available !== null && checkedName && (
            <div className={`msg mt ${available ? "msg-success" : "msg-info"}`}>
              {available
                ? <><span>&#10003;</span> <span><strong>{checkedName}</strong> is available!</span></>
                : <><span>&#10005;</span> <span><strong>{checkedName}</strong> is already taken.</span></>
              }
            </div>
          )}

          {/* Register button */}
          {available && (
            <div className="mt-lg">
              {flowStep !== "idle" && flowStep !== "failed" && (
                <div className="steps">
                  {["Balance", "Approve", "Register", "Done"].map((label, i) => (
                    <span key={label}>
                      {i > 0 && <span className="step-line" />}
                      <span className={`step ${i < stepIndex ? "done" : i === stepIndex ? "active" : ""}`}>
                        <span className="step-num">{i < stepIndex ? "\u2713" : i + 1}</span>
                        <span>{label}</span>
                      </span>
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="btn-primary btn-lg"
                onClick={approveAndRegister}
                disabled={loading || !canRegister}
              >
                {loading
                  ? <><span className="spinner" /> Processing...</>
                  : `Register ${checkedName}`
                }
              </button>

              {!canRegister && !loading && (
                <p className="text-xs text-secondary mt-sm" style={{ textAlign: "center" }}>
                  {!wallet ? "Connect your wallet to continue." : !onArc ? "Switch to Arc Testnet to continue." : ""}
                </p>
              )}
            </div>
          )}

          {/* Messages */}
          {error && <div className="msg msg-error mt">{error}</div>}
          {success && (
            <div className="msg msg-success mt">
              Registered <strong>{checkedName}</strong> successfully!{" "}
              <a href={`https://testnet.arcscan.app/tx/${success}`} target="_blank" rel="noreferrer">
                View tx &rarr;
              </a>
            </div>
          )}

          {/* Collapsible logs */}
          {txLogs.length > 0 && (
            <div className="mt">
              <button type="button" className="collapsible-trigger" onClick={() => setShowLogs(!showLogs)}>
                {showLogs ? "\u25BE" : "\u25B8"} Transaction log ({txLogs.length})
              </button>
              {showLogs && (
                <ul className="log-list">
                  {txLogs.map((line, idx) => <li key={`${line}-${idx}`}>{line}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Collapsible diagnostics */}
          <div className="mt">
            <button type="button" className="collapsible-trigger" onClick={() => { setShowDiag(!showDiag); if (!showDiag) runDiagnostics(); }}>
              {showDiag ? "\u25BE" : "\u25B8"} Diagnostics
            </button>
            {showDiag && (
              <ul className="log-list">
                {diagnostics.map((line, idx) => <li key={`${line}-${idx}`}>{line}</li>)}
              </ul>
            )}
          </div>
        </section>
      </div>
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
  if (lower.includes("insufficient usdc") || lower.includes("you need")) return msg;
  if (lower.includes("user rejected") || lower.includes("user denied")) return "You rejected the transaction in your wallet.";
  if (lower.includes("reserved")) return "This name is reserved and cannot be registered.";
  if (lower.includes("name not available") || lower.includes("namenotavailable")) return "This name is no longer available.";
  if (lower.includes("commit")) return "Timing issue with commit-reveal. Please wait a moment and try again.";
  if (lower.includes("insufficient funds") || lower.includes("exceeds balance")) return "Not enough funds for gas. You need USDC in your wallet for both the fee and gas.";
  if (lower.includes("revert")) return "Transaction failed on-chain. This can happen if the name was just taken, or if USDC approval is insufficient.";
  if (lower.includes("network") || lower.includes("fetch")) return "Network error. Check your connection and try again.";
  return msg;
}
