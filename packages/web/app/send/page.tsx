"use client";

// Cache-bust: v2 — force Vercel fresh build
import { ARCNames, normalizeName, ANS_REGISTRY_ADDRESSES, ANS_USDC_ADDRESSES, ANS_RPC_URLS, ANS_EXPLORER_URLS } from "@arcnames/sdk";
import { BrowserProvider, Contract, formatUnits, parseUnits, isAddress } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "../wallet-context";

const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042002");
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || ANS_RPC_URLS[ARC_CHAIN_ID] || "https://rpc.testnet.arc.network";
const REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_ANS_REGISTRY_ADDRESS ||
  ANS_REGISTRY_ADDRESSES[ARC_CHAIN_ID] || "";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || ANS_USDC_ADDRESSES[ARC_CHAIN_ID] || "";
const EXPLORER_BASE_URL = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || `${ANS_EXPLORER_URLS[ARC_CHAIN_ID]}/tx/` || "https://testnet.arcscan.app/tx/";

/** Full USDC ERC-20 ABI for transfers (SDK exports only the subset needed for ANS registration fees) */
const USDC_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

type SendStep = "idle" | "resolving" | "confirm" | "sending" | "done" | "failed";

function readableError(err: unknown): string {
  const raw = typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
  if (/user rejected|user denied/i.test(raw)) return "You rejected the transaction in your wallet.";
  if (/insufficient funds|exceeds balance/i.test(raw)) return "Not enough USDC for this transfer plus gas.";
  if (/network|fetch/i.test(raw)) return "Network error. Check your connection and try again.";
  return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
}

export default function SendPage() {
  const { wallet, chainId, onArc, connect: connectWallet, switchToArc, walletError, clearWalletError } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [step, setStep] = useState<SendStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const hasWallet = typeof window !== "undefined" && typeof window.ethereum !== "undefined";

  const ans = useMemo(() => {
    if (!REGISTRY_ADDRESS) return null;
    return new ARCNames({ rpcUrl: ARC_RPC_URL, registryAddress: REGISTRY_ADDRESS });
  }, []);

  useEffect(() => {
    if (walletError) { setError(walletError); clearWalletError(); }
  }, [walletError, clearWalletError]);

  useEffect(() => {
    if (wallet && hasWallet && USDC_ADDRESS) {
      loadBalance();
    }
  }, [wallet]);

  async function loadBalance() {
    try {
      const provider = new BrowserProvider(window.ethereum as any);
      const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider);
      const bal = (await usdc.balanceOf(wallet)) as bigint;
      setBalance(formatUnits(bal, 6));
    } catch {
      setBalance(null);
    }
  }

  function isArcName(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    if (trimmed.endsWith(".arc")) return true;
    if (/^[a-z0-9-]+$/.test(trimmed) && trimmed.length >= 3 && !trimmed.startsWith("0x")) return true;
    return false;
  }

  async function handleResolve() {
    setError(null);
    setResolvedAddress(null);
    setResolvedName(null);

    const trimmedRecipient = recipient.trim();
    const trimmedAmount = amount.trim();

    if (!trimmedRecipient) { setError("Enter a recipient (.arc name or 0x address)."); return; }
    if (!trimmedAmount || parseFloat(trimmedAmount) <= 0) { setError("Enter a valid USDC amount."); return; }

    if (isAddress(trimmedRecipient)) {
      setResolvedAddress(trimmedRecipient);
      setResolvedName(null);
      setStep("confirm");
      return;
    }

    if (isArcName(trimmedRecipient)) {
      if (!ans) { setError("Registry not configured."); return; }
      setStep("resolving");
      try {
        const result = await ans.resolveWithReason(trimmedRecipient);
        if (result.reason === "found" && result.address) {
          setResolvedAddress(result.address);
          setResolvedName(result.name);
          setStep("confirm");
        } else {
          const reasons: Record<string, string> = {
            not_registered: "This name is not registered.",
            expired: "This name has expired.",
            reserved: "This name is reserved.",
            invalid_name: "Invalid name format.",
          };
          setError(reasons[result.reason] || "Name could not be resolved.");
          setStep("idle");
        }
      } catch (err) {
        setError(readableError(err));
        setStep("idle");
      }
      return;
    }

    setError("Enter a valid .arc name or 0x address.");
  }

  async function handleSend() {
    if (!resolvedAddress || !amount) return;
    if (!wallet || !hasWallet) { setError("Connect your wallet first."); return; }
    if (!onArc) { setError("Switch to Arc Testnet first."); return; }

    setStep("sending");
    setError(null);
    try {
      const provider = new BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

      const parsedAmount = parseUnits(amount.trim(), 6);
      const bal = (await usdc.balanceOf(wallet)) as bigint;
      if (bal < parsedAmount) {
        throw new Error(`Insufficient balance. You have ${formatUnits(bal, 6)} USDC but tried to send ${amount} USDC.`);
      }

      const tx = await usdc.transfer(resolvedAddress, parsedAmount);
      await tx.wait();
      setTxHash(tx.hash);
      setStep("done");
      loadBalance();
    } catch (err) {
      setError(readableError(err));
      setStep("confirm");
    }
  }

  function reset() {
    setRecipient("");
    setAmount("");
    setResolvedAddress(null);
    setResolvedName(null);
    setStep("idle");
    setError(null);
    setTxHash(null);
  }

  /* ── Wallet not connected ── */
  if (!wallet) {
    return (
      <main className="fade-in">
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2.5rem" }}>Send <span className="text-accent">USDC</span></h1>
          <p className="text-secondary mt-sm" style={{ fontSize: "1.05rem" }}>Send to any .arc name or wallet address on Arc.</p>
        </div>
        <div className="container-narrow">
          <section className="card card-glow text-center" style={{ padding: "3rem 1.5rem" }}>
            {!hasWallet ? (
              <p className="msg msg-warn">No wallet detected. Install MetaMask to continue.</p>
            ) : (
              <button className="btn-primary btn-lg" onClick={connectWallet}>Connect Wallet</button>
            )}
          </section>
        </div>
      </main>
    );
  }

  /* ── Wrong network ── */
  if (!onArc) {
    return (
      <main className="fade-in">
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2.5rem" }}>Send <span className="text-accent">USDC</span></h1>
        </div>
        <div className="container-narrow">
          <section className="card text-center" style={{ padding: "3rem 1.5rem" }}>
            <p className="msg msg-warn mb">Please switch to Arc Testnet to send USDC.</p>
            <button className="btn-primary btn-lg" onClick={switchToArc}>Switch to Arc Testnet</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="fade-in">
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <h1 style={{ fontSize: "2.5rem" }}>Send <span className="text-accent">USDC</span></h1>
        <p className="text-secondary mt-sm" style={{ fontSize: "1.05rem" }}>
          Pay anyone by .arc name or wallet address.
          {balance !== null && <><br /><span style={{ fontWeight: 700, color: "var(--accent)" }}>{balance} USDC</span> available</>}
        </p>
      </div>

      <div className="container-narrow">
        {error && <p className="msg msg-error mb">{error}</p>}

        {/* ── Step: Done ── */}
        {step === "done" && txHash && (
          <section className="card card-glow">
            <div className="msg msg-ok" style={{ marginBottom: "1rem" }}>
              Sent <strong>{amount} USDC</strong> to {resolvedName || resolvedAddress}
            </div>
            <p className="text-xs" style={{ wordBreak: "break-all" }}>
              Tx:{" "}
              <a href={`${EXPLORER_BASE_URL}${txHash}`} target="_blank" rel="noreferrer">
                {txHash.slice(0, 14)}…{txHash.slice(-8)}
              </a>
            </p>
            <button className="btn-primary btn-lg" onClick={reset} style={{ marginTop: "1.25rem" }}>
              Send More
            </button>
          </section>
        )}

        {/* ── Step: Confirm ── */}
        {step === "confirm" && resolvedAddress && (
          <section className="card card-glow">
            <h3 style={{ marginBottom: "1rem" }}>Confirm Transfer</h3>
            <div className="profile-field">
              <span className="profile-label">To</span>
              <span className="profile-value">
                {resolvedName && <strong>{resolvedName} </strong>}
                <span className="text-secondary text-xs font-mono">{resolvedAddress}</span>
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-label">Amount</span>
              <span className="profile-value"><strong>{amount} USDC</strong></span>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button className="btn-outline" onClick={() => { setStep("idle"); setResolvedAddress(null); setResolvedName(null); }} style={{ flex: 1 }}>
                Back
              </button>
              <button className="btn-primary btn-lg" onClick={handleSend} style={{ flex: 2 }}>
                Confirm &amp; Send
              </button>
            </div>
          </section>
        )}

        {/* ── Step: Sending ── */}
        {step === "sending" && (
          <section className="card text-center" style={{ padding: "3rem 1.5rem" }}>
            <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 1.25rem" }} />
            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Sending {amount} USDC…</p>
            <p className="text-secondary text-sm mt-sm">Confirm the transaction in your wallet.</p>
          </section>
        )}

        {/* ── Step: Resolving ── */}
        {step === "resolving" && (
          <section className="card text-center" style={{ padding: "3rem 1.5rem" }}>
            <div className="spinner" style={{ width: 28, height: 28, margin: "0 auto 1.25rem" }} />
            <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Resolving {recipient}…</p>
          </section>
        )}

        {/* ── Step: Input ── */}
        {step === "idle" && (
          <section className="card card-glow">
            <label className="label">Recipient</label>
            <input
              className="input-lg"
              type="text"
              placeholder="name.arc or 0x address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              style={{ marginBottom: "1.25rem" }}
            />

            <label className="label">Amount (USDC)</label>
            <input
              className="input-lg"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ marginBottom: "1.5rem" }}
            />

            <button
              className="btn-primary btn-lg"
              onClick={handleResolve}
              disabled={!recipient.trim() || !amount.trim()}
            >
              Continue
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
