# ARC Name Service — 5-Minute Integration Guide

Get `.arc` name resolution working in your dApp in under 5 minutes.

---

## Install

```bash
npm install @arc/names
# For React hooks:
npm install @arc/names-react
```

---

## Pattern A: Resolve a .arc name before sending USDC

The most common use case — convert `"david.arc"` to a wallet address before sending a transaction.

```typescript
import { ARCNames } from "@arc/names";

const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
});

const address = await ans.resolve("david");
if (!address) throw new Error("Name not found");
await sendUSDC(address, amount);
```

**With error reason:**

```typescript
const result = await ans.resolveWithReason("david");
if (result.reason !== "found") {
  console.log(`Cannot resolve: ${result.reason}`);
  // "not_registered" | "expired" | "reserved" | "invalid_name"
}
```

---

## Pattern B: Show .arc name in your navbar (React)

Display a human-readable name instead of a hex address.

```tsx
import { useANSReverse } from "@arc/names-react";

function Navbar({ walletAddress }: { walletAddress: string }) {
  const { arcName, isLoading } = useANSReverse(walletAddress, {
    rpcUrl: "https://rpc.testnet.arc.network",
    registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
  });

  return (
    <span>
      {isLoading ? "..." : arcName ?? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
    </span>
  );
}
```

---

## Pattern C: Address input with live .arc resolution (React)

Accept both raw addresses and `.arc` names with live resolution feedback.

```tsx
import { useState } from "react";
import { useANSResolve } from "@arc/names-react";

function RecipientInput({ onResolved }: { onResolved: (addr: string) => void }) {
  const [input, setInput] = useState("");
  const { address, arcName, isResolving, reason } = useANSResolve(input, {
    rpcUrl: "https://rpc.testnet.arc.network",
    registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
    debounceMs: 400,
  });

  // Notify parent when resolved
  if (address) onResolved(address);

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="0x... or name.arc"
      />
      {isResolving && <span>Resolving...</span>}
      {arcName && address && <span>{arcName} → {address.slice(0, 10)}...</span>}
      {reason === "not_registered" && <span>Name not found</span>}
      {reason === "expired" && <span>Name expired</span>}
    </div>
  );
}
```

---

## Pattern D: Batch resolve (CSV payouts)

Resolve many names in a single call for batch payment flows.

```typescript
import { ARCNames } from "@arc/names";

const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
});

const recipients = ["alice", "bob", "charlie", "david"];
const results = await ans.resolveMany(recipients);
// [{ name: "alice.arc", address: "0x..." }, { name: "bob.arc", address: null }, ...]

const valid = results.filter((r) => r.address !== null);
const failed = results.filter((r) => r.address === null);
```

---

## Pattern E: Using the ANSProvider (React)

Wrap your app once, and all hooks share the same SDK instance and cache.

```tsx
import { ANSProvider } from "@arc/names-react";

function App() {
  return (
    <ANSProvider config={{
      rpcUrl: "https://rpc.testnet.arc.network",
      registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
    }}>
      <YourApp />
    </ANSProvider>
  );
}

// Then in any child component — no config needed:
import { useANSResolve, useANSReverse, useANSAvailability } from "@arc/names-react";

const { address } = useANSResolve(input);          // forward
const { arcName } = useANSReverse(walletAddress);   // reverse
const { available } = useANSAvailability(nameInput); // availability
```

---

## Pattern F: Direct contract calls (advanced)

Use the exported ABI and addresses for custom integrations with viem, ethers, or any library.

```typescript
import { ANS_REGISTRY_ABI, ANS_REGISTRY_ADDRESSES } from "@arc/names/constants";

// With viem:
const address = await publicClient.readContract({
  address: ANS_REGISTRY_ADDRESSES[5042002],
  abi: ANS_REGISTRY_ABI,
  functionName: "resolve",
  args: ["david"],
});

// With ethers:
import { Contract, JsonRpcProvider } from "ethers";
const provider = new JsonRpcProvider("https://rpc.testnet.arc.network");
const registry = new Contract(ANS_REGISTRY_ADDRESSES[5042002], ANS_REGISTRY_ABI, provider);
const resolved = await registry.resolve("david");
```

---

## Quick Reference

| Need | Method |
|------|--------|
| Name → Address | `ans.resolve("david")` |
| Name → Address + reason | `ans.resolveWithReason("david")` |
| Address → Name | `ans.reverseLookup("0x...")` |
| Is name available? | `ans.isAvailable("david")` |
| Full record | `ans.getNameInfo("david")` |
| Price quote | `ans.quotePrice("david", 1)` |
| Batch resolve | `ans.resolveMany(["alice", "bob"])` |
| QR code | `ans.getQRCodeDataUrl("david")` |

| React Hook | Use Case |
|------------|----------|
| `useANSResolve(input)` | Live name → address in forms |
| `useANSReverse(address)` | Display name in navbars/profiles |
| `useANSAvailability(name)` | Registration availability check |

---

## Contract Addresses

| Chain | ID | Registry | USDC |
|-------|----|----------|------|
| Arc Testnet | 5042002 | `0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db` | `0x3600000000000000000000000000000000000000` |
