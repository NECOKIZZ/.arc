# ARC Name Service (ANS) — Developer Experience Feedback & Recommendations

> Written after hands-on integration of ANS into [Arc Global Payouts](https://arc-payouts.vercel.app), a full-featured USDC payment platform on Arc Network.
>
> Author: GoGo — [@0xGoGochain](https://x.com/0xGoGochain)
> Date: April 2026

---

## Context

We integrated ARC Name Service into 6 pages of a production Next.js dApp:

- **Send** — single USDC transfers to `.arc` names
- **Batch** — CSV-imported payouts with `.arc` resolution
- **AI Assistant** — natural-language payments ("Send 10 USDC to alice.arc")
- **Contacts** — address book with `.arc` name storage
- **Split** — bill splitting with `.arc` participant resolution
- **Schedule** — recurring payments to `.arc` names

The integration required **2 custom library files** (~200 lines) and **modifications to 6 app files** — all of which could be eliminated or drastically reduced with the improvements below.

---

## Recommendation 1: Publish `@arc/names` to npm

**Priority: P0 — Critical**

The SDK documentation references `npm install @arc/names`, but the package does not exist on the npm registry. This is the single biggest blocker for adoption.

We had to fall back to raw viem contract calls against the registry, manually defining the ABI and hardcoding the registry address. Every dApp builder on Arc will hit this same wall.

**Action:** Publish a lightweight, tree-shakable package to npm with the interface described in the current docs.

---

## Recommendation 2: Ship a React/wagmi Hooks Package

**Priority: P0 — Critical**

The vast majority of Arc dApps use React + wagmi (the natural stack for EVM frontends). A companion `@arc/names-react` package with ready-made hooks would eliminate ~80% of integration boilerplate.

### What we had to build ourselves:

```typescript
// useANSResolve — debounced forward resolution
const { resolvedAddress, arcName, isResolving, error } = useANSResolve(input)

// useANSReverse — reverse lookup for display
const { arcName, isLoading } = useANSReverse(walletAddress)
```

### What the official package should provide:

```typescript
import { useANSResolve, useANSReverse, useANSAvailability } from '@arc/names-react'

// Forward: name → address (with debounce, caching, error states)
const { address, name, isResolving, error } = useANSResolve(input, { debounceMs: 400 })

// Reverse: address → name (for navbar, profiles, tx history)
const { arcName, isLoading } = useANSReverse(walletAddress)

// Availability check (for registration flows)
const { available, isChecking } = useANSAvailability(nameInput)
```

These hooks should include:
- Configurable debounce timing
- Built-in 60s cache (configurable)
- Stale-while-revalidate pattern
- Proper cleanup on unmount
- TypeScript types

---

## Recommendation 3: Provide a Drop-in `<ANSInput />` Component

**Priority: P2 — High Value**

Every page in our app needed an address input with ANS resolution. We duplicated the same UI pattern 5 times (Send, Batch, Split, Schedule, Contacts). A headless or lightly-styled component would save significant effort:

```tsx
// Headless mode — full control over rendering
<ANSAddressInput
  value={recipient}
  onChange={setRecipient}
  onResolved={(address, arcName) => { /* ready to send */ }}
  render={({ input, resolvedAddress, arcName, isResolving, error }) => (
    <div>
      <input value={input} onChange={...} placeholder="0x... or name.arc" />
      {isResolving && <span>Resolving...</span>}
      {arcName && <span>✓ {arcName} → {resolvedAddress}</span>}
      {error && <span>{error}</span>}
    </div>
  )}
/>

// Styled mode — zero config
<ANSAddressInput
  value={recipient}
  onChange={setRecipient}
  theme="dark"
/>
```

---

## Recommendation 4: Support viem Client Pass-through

**Priority: P3 — Nice to Have**

The current SDK requires manual `rpcUrl` + `registryAddress` configuration. Most dApps already have a viem `PublicClient` configured. The SDK should accept it directly and auto-resolve the registry address from the chain ID:

```typescript
// Current (verbose):
const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2",
})

// Better — auto-detect from chain:
const ans = new ARCNames({ chain: arcTestnet })

// Best — accept existing viem client:
import { ansFromClient } from '@arc/names/viem'
const ans = ansFromClient(existingPublicClient)
// Registry address auto-resolved from chain ID 5042002
```

This also future-proofs dApps for mainnet — the SDK can map `chainId → registryAddress` internally without requiring code changes.

---

## Recommendation 5: Export Contract ABI & Registry Addresses as Constants

**Priority: P1 — Important**

We had to manually define the IANSRegistry ABI (4 functions, ~40 lines) and hardcode the registry address. The SDK should export these as importable constants:

```typescript
import {
  ANS_REGISTRY_ABI,
  ANS_REGISTRY_ADDRESS,   // Record<chainId, address>
  ANS_SUPPORTED_CHAINS,
} from '@arc/names/constants'

// For advanced users doing direct contract calls:
const result = await client.readContract({
  address: ANS_REGISTRY_ADDRESS[5042002],
  abi: ANS_REGISTRY_ABI,
  functionName: 'resolve',
  args: ['david'],
})
```

---

## Recommendation 6: Add a wagmi Name Resolver Plugin

**Priority: P1 — Important**

wagmi supports custom name resolution. ANS should provide a plugin so `.arc` names resolve automatically across the entire wagmi ecosystem — balance lookups, transaction sends, address display, etc.:

```typescript
import { arcNameResolver } from '@arc/names/wagmi'

const config = createConfig({
  chains: [arcTestnet],
  // .arc names "just work" everywhere in the app
  nameResolver: arcNameResolver(),
})

// Then throughout the app:
const balance = useBalance({ address: 'david.arc' })  // auto-resolves
```

This is the gold standard — ENS achieves this on Ethereum, and it makes name resolution invisible to the application layer.

---

## Recommendation 7: Host a Public REST API

**Priority: P1 — Important**

The docs describe a REST API (`GET /resolve/:name`, etc.) but it's self-hosted only. A publicly hosted endpoint would dramatically expand the integration surface:

```
https://ans-api.arc.network/resolve/david
→ { "address": "0x858f3232E7d6702F20c4D3FEAB987A405D225f4E" }

https://ans-api.arc.network/reverse/0x858f3232E7d6702F20c4D3FEAB987A405D225f4E
→ { "name": "david.arc" }
```

**Benefits:**
- Non-JS backends (Python, Go, Rust) integrate with a single HTTP call
- Mobile apps resolve names without bundling the SDK
- Quick prototypes work with just `fetch()`
- Server-side rendering (Next.js API routes) can resolve without client-side JS
- Rate-limited public endpoint with optional API key for higher limits

---

## Recommendation 8: Improve Error Semantics

**Priority: P2 — High Value**

When a name doesn't exist, `resolve()` returns the zero address (`0x0000...000`). This is ambiguous — is it:
- Never registered?
- Expired (past 30-day grace period)?
- Reserved (`admin`, `arc`, `treasury`, etc.)?
- Temporarily unresolvable (RPC issue)?

### Current behavior:
```typescript
const addr = await ans.resolve("nonexistent")
// Returns: "0x0000000000000000000000000000000000000000"
// Caller must check for zero address manually
```

### Suggested behavior:
```typescript
const result = await ans.resolve("nonexistent")
// Returns: null (not found)

// Or with detail:
const result = await ans.resolveWithReason("nonexistent")
// Returns: { address: null, reason: "not_found" | "expired" | "reserved" | "invalid_format" }
```

The `getRecord()` function has more detail, but requiring a separate call for basic error handling is poor DX.

---

## Recommendation 9: Add Batch Resolution (Multicall)

**Priority: P2 — High Value**

Batch payouts are a core Arc use case (our app supports CSV import of hundreds of recipients). Currently, resolving N names requires N sequential RPC calls:

```typescript
// Current — slow, sequential
for (const name of names) {
  const addr = await ans.resolve(name)  // ~200ms each
}
// 100 names = ~20 seconds
```

### Suggested:
```typescript
// Batch — single multicall
const results = await ans.resolveMany(["alice", "bob", "charlie", ...names])
// Returns: [{ name: "alice.arc", address: "0x..." }, { name: "bob.arc", address: null }, ...]
// 100 names = ~200ms (single multicall)
```

Under the hood, this should use viem's `multicall` to batch all `resolve()` calls into a single RPC request.

---

## Recommendation 10: Documentation — Add a "5-Minute Integration" Guide

**Priority: P2 — High Value**

The current docs are comprehensive but long. Many developers just need the 3 most common patterns. A dedicated quick-start section would dramatically lower the barrier:

### Pattern A: Resolve before sending (3 lines)
```typescript
const resolved = await ans.resolve(userInput.replace(/\.arc$/, ''))
if (!resolved || resolved === '0x000...') throw new Error('Name not found')
await sendUSDC(resolved, amount)
```

### Pattern B: Show .arc name in navbar (1 hook)
```typescript
const { arcName } = useANSReverse(connectedAddress)
// Display: arcName ?? truncateAddress(connectedAddress)
```

### Pattern C: Address input with live resolution (1 component)
```tsx
<ANSAddressInput value={to} onChange={setTo} onResolved={setResolvedAddr} />
```

---

## Summary: Priority Matrix

| Priority | # | Recommendation | Impact |
|----------|---|----------------|--------|
| **P0** | 1 | Publish `@arc/names` to npm | Unblocks all JS/TS dApps |
| **P0** | 2 | Ship React hooks package | 90%+ of dApps are React |
| **P1** | 5 | Export ABI + addresses as constants | Eliminates hardcoding |
| **P1** | 6 | wagmi name resolver plugin | Ecosystem-wide integration |
| **P1** | 7 | Public hosted REST API | Non-JS ecosystem access |
| **P2** | 3 | Drop-in `<ANSInput />` component | Kills UI boilerplate |
| **P2** | 8 | Better error semantics | Debugging DX |
| **P2** | 9 | Batch resolution / multicall | Batch payout performance |
| **P2** | 10 | 5-minute integration guide | Onboarding speed |
| **P3** | 4 | Auto-detect chain from viem client | Cleaner initialization |

---

## Appendix: What We Built (Available as Reference)

During integration, we created two reusable modules that could serve as a starting point for the official SDK:

### `src/lib/ans.ts` — Core resolution engine
- Singleton viem `PublicClient` for Arc Testnet
- `resolveANS(name)` — forward lookup with cache
- `reverseANS(address)` — reverse lookup with cache
- `smartResolve(input)` — auto-detect name vs address
- `isArcName(input)` — input classification
- 60-second in-memory cache with TTL

### `src/lib/useANS.ts` — React hooks
- `useANSResolve(input, debounceMs)` — debounced forward resolution with loading/error states
- `useANSReverse(address)` — reverse lookup for display

These are MIT-licensed and available for the ANS team to reference or adopt.

---

*Built on Arc Network · Powered by Circle · ANS Registry: `0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2`*
