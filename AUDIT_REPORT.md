# ARC Name Service — Security & Code Audit Report

**Date:** April 23, 2026
**Auditor:** Cascade AI
**Scope:** Full codebase — contracts, SDK, API, frontend
**Severity scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

The ARC Name Service is a well-structured monorepo implementing a domain name system for Arc Testnet. The codebase uses industry-standard libraries (OpenZeppelin, ethers.js, Next.js) and follows generally sound patterns. **No backdoors were found.** Several vulnerabilities and bugs are documented below, ranging from medium to informational severity.

---

## 1. Smart Contract — `ARCNameRegistry.sol`

### 1.1 MEDIUM — Fee overflow in `_quotePriceForNormalized`

```solidity
uint256 annual = bytes(normalized).length <= 4 ? shortNameFeeUSDC : baseFeeUSDC;
return annual * yearsCount;
```

If `setFees()` sets an extremely large fee and `yearsCount` is large, `annual * yearsCount` can overflow. Solidity 0.8 reverts on overflow, so this is safe from exploitation, but it means legitimate renewals/quotes could revert unexpectedly.

**Recommendation:** Add a reasonable upper bound check on `yearsCount` (e.g., `require(yearsCount <= 10)`).

### 1.2 MEDIUM — `setFees()` allows zero fees

```solidity
function setFees(uint256 newBaseFeeUSDC, uint256 newShortNameFeeUSDC) external onlyOwner {
    baseFeeUSDC = newBaseFeeUSDC;
    shortNameFeeUSDC = newShortNameFeeUSDC;
```

Owner can set fees to zero, enabling free name squatting. This is not a vulnerability per se (owner is trusted), but could be called accidentally.

**Recommendation:** Add minimum fee validation or emit a warning event.

### 1.3 MEDIUM — `release()` missing `whenNotPaused` modifier

```solidity
function release(string calldata rawLabel) external {
```

`register`, `renew`, and `submitCommitment` are all gated by `whenNotPaused`, but `release` is not. This means names can be released even when the contract is paused (during an emergency).

**Recommendation:** Add `whenNotPaused` to `release()`.

### 1.4 MEDIUM — `transferName`, `setPrimaryName`, `updateResolvedAddress` missing `whenNotPaused`

Same issue as above. These state-changing functions can be called during pause.

**Recommendation:** Add `whenNotPaused` to all user-facing state-mutation functions.

### 1.5 LOW — Commitment replay across re-deployments

Commitments use `keccak256(abi.encodePacked(msg.sender, labelHash, salt))`. Since there is no domain separator or contract address in the hash, a commitment created for one deployment could theoretically be submitted to a new deployment at a different address. In practice this is harmless since `MIN_COMMITMENT_AGE = 0` and the old commitment timestamp wouldn't exist on the new contract.

**Recommendation:** Include `address(this)` in the commitment hash for defense in depth.

### 1.6 LOW — `MIN_COMMITMENT_AGE = 0` weakens front-running protection

The commit-reveal pattern is designed to prevent front-running. With `MIN_COMMITMENT_AGE = 0`, a user can submit a commitment and register in the same block, which largely defeats the purpose. A mempool observer could still front-run by submitting their own commitment + registration in the same block with higher gas.

**Recommendation:** Set `MIN_COMMITMENT_AGE` to at least 1 block or a few seconds.

### 1.7 LOW — `getOwnedLabels` gas cost grows unbounded

```solidity
function getOwnedLabels(address wallet) external view returns (string[] memory labels) {
    bytes32[] storage hashes = ownedLabelHashes[wallet];
    labels = new string[](hashes.length);
    for (uint256 i = 0; i < hashes.length; i++) {
        labels[i] = string.concat(records[hashes[i]].label, ".arc");
    }
}
```

If a wallet owns hundreds of names, this view function may hit gas limits when called from on-chain. Fine for off-chain reads, but could break composability.

**Recommendation:** Add pagination parameters.

### 1.8 INFO — No events for `transferName` resolved address

When a name is transferred, the `resolvedAddress` is not updated. The new owner inherits the old resolved address. This is arguably correct, but the new owner may not realize their name still points to the old wallet.

### 1.9 INFO — `_endsWithArc` uses inline assembly

The assembly in `_endsWithArc` is minimal and correct — it performs a 4-byte memory read. No overflow or out-of-bounds risk since length is checked.

### 1.10 ✅ Positive Findings

- **ReentrancyGuard** correctly applied to `register`, `registerWithCommit`, `renew`
- **SafeERC20** used for all token transfers
- **Ownable2Step** prevents accidental ownership transfer
- **Pausable** emergency stop available
- **Proper existence/ownership check order** in `renew` and `release`
- **No selfdestruct, delegatecall, or proxy patterns** — no upgrade risk
- **No external calls besides USDC transfers** — minimal attack surface

---

## 2. TypeScript SDK — `@arc/names`

### 2.1 LOW — Cache poisoning on failed reads

If a resolve call returns `null` (name doesn't exist), that `null` is cached for 60 seconds. If the name is registered during that window, the SDK will return stale data.

**Recommendation:** Either don't cache null/empty results, or reduce TTL for negative results.

### 2.2 LOW — `detectCommitRevealSupport` cached permanently

```typescript
if (this.commitModeChecked) return this.commitModeSupported;
this.commitModeChecked = true;
```

Once checked, this never refreshes. If the owner toggles `commitRevealRequired` on the contract, existing SDK instances will use the stale value until recreated.

**Recommendation:** Use TTL-based caching for this value too.

### 2.3 INFO — No retry logic for RPC calls

All RPC reads fail immediately on network error. For production, consider adding retry with exponential backoff.

### 2.4 ✅ Positive Findings

- **Input validation** via `normalizeName()` before all operations
- **Address validation** via `isAddress()` for write operations
- **Cache eviction** on writes prevents stale reads after mutations
- **Signer requirement** enforced at runtime for write methods

---

## 3. REST API — `@arc/names-api`

### 3.1 MEDIUM — Open CORS allows any origin

```typescript
app.use(cors());
```

This allows any website to call the API. If the API ever serves authenticated or sensitive data, this would be a problem. For a public read-only API it's acceptable, but should be documented as intentional.

**Recommendation:** Restrict to known frontend origins in production: `cors({ origin: ["https://yourdomain.com"] })`.

### 3.2 MEDIUM — Error handler leaks internal details

```typescript
app.use((error: unknown, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  res.status(400).json({ error: message });
});
```

Raw error messages from ethers.js/RPC nodes may contain internal addresses, RPC URLs, or revert data. These are sent directly to clients.

**Recommendation:** Sanitize error messages. Map known errors to safe strings.

### 3.3 LOW — QR `size` parameter not validated beyond range

```typescript
const size = Math.max(100, Math.min(Number(req.query.size || "300"), 1000));
```

`Number("abc")` → `NaN`, `Math.min(NaN, 1000)` → `NaN`, `Math.max(100, NaN)` → `NaN`. This would pass `NaN` to QRCode which may produce unexpected results.

**Recommendation:** Default to 300 if `isNaN(size)`.

### 3.4 LOW — No input validation on `/reverse/:address`

The address parameter is passed directly to the SDK without validation:

```typescript
const name = await ans.reverseLookup(req.params.address);
```

The SDK validates it, but the error message may not be user-friendly.

**Recommendation:** Validate format before calling SDK.

### 3.5 INFO — Double caching (API LRU + SDK internal cache)

Both the API's `LRUCache` and the SDK's internal `Map` cache the same data with different TTLs (30s vs 60s). This is harmless but wastes memory.

### 3.6 ✅ Positive Findings

- **Rate limiting** configured (100 req/min)
- **LRU cache** prevents RPC spam
- **No write endpoints** — API is read-only
- **No authentication tokens** stored or required

---

## 4. Frontend — Next.js Web App

### 4.1 LOW — Hardcoded fallback contract addresses

```typescript
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_ANS_REGISTRY_ADDRESS || "0xaDe3b1ae...";
```

Multiple files contain fallback addresses. If the `.env` isn't configured, the frontend silently uses a potentially stale/wrong address.

**Recommendation:** Remove hardcoded fallbacks; require explicit configuration. Show an error state if env vars are missing.

### 4.2 LOW — `window.ethereum` cast to `any`

```typescript
const provider = new BrowserProvider(window.ethereum as any);
```

This bypasses type safety. A malicious browser extension could inject a non-standard provider.

**Recommendation:** Validate that the provider implements required methods before use.

### 4.3 INFO — Diagnostics expose contract addresses and RPC URLs

The diagnostics panel shows registry addresses, RPC endpoints, and balance info. This is useful for debugging but should be behind a flag in production.

### 4.4 INFO — No CSP headers

No Content-Security-Policy headers are configured. For a Web3 app that connects to external RPCs and wallet providers, a well-tuned CSP would add defense against XSS.

### 4.5 INFO — Profile page server-fetches from API without auth

```typescript
const res = await fetch(`${API_BASE}/profile/${encodeURIComponent(name)}`, { cache: "no-store" });
```

This runs server-side. If `API_BASE` is `localhost`, the Next.js server makes the call, not the browser. This is correct but means the API must be accessible from the server host.

### 4.6 ✅ Positive Findings

- **No private keys** in frontend code
- **No `dangerouslySetInnerHTML`** — no XSS vectors
- **Wallet state uses React context** — no prop drilling or global mutation
- **`rel="noreferrer"`** on external links
- **All env vars use `NEXT_PUBLIC_` prefix** — no server secrets leaked to client
- **`encodeURIComponent`** used in profile fetch — prevents path injection
- **User confirmation** before destructive actions (release)

---

## 5. DevOps & Configuration

### 5.1 MEDIUM — No `.gitignore` at project root

No `.gitignore` file was found at the project root. The `.env` file (containing `DEPLOYER_PRIVATE_KEY`) could be accidentally committed.

**Recommendation:** Create a root `.gitignore` that excludes `.env`, `node_modules/`, `dist/`, `artifacts/`, `cache/`, `.next/`.

### 5.2 LOW — Deploy script writes to fixed path

```typescript
const outPath = path.resolve(__dirname, "../../../deployments/arc-testnet.json");
```

This assumes the monorepo structure. Will fail if the contracts package is moved.

### 5.3 INFO — Only one test

The test suite contains a single test (`registers and resolves a name with commit-reveal`). Critical flows like renewal, transfer, release, expiry, reserved names, fee changes, and edge cases are untested.

---

## 6. Summary Table

| # | Severity | Component | Finding |
|---|----------|-----------|---------|
| 1.1 | MEDIUM | Contract | Fee * years can revert on overflow for large years |
| 1.2 | MEDIUM | Contract | `setFees()` allows zero fees |
| 1.3 | MEDIUM | Contract | `release()` missing `whenNotPaused` |
| 1.4 | MEDIUM | Contract | `transferName/setPrimaryName/updateResolvedAddress` missing `whenNotPaused` |
| 3.1 | MEDIUM | API | CORS allows all origins |
| 3.2 | MEDIUM | API | Error messages leak internal details |
| 5.1 | MEDIUM | DevOps | No root `.gitignore` |
| 1.5 | LOW | Contract | No domain separator in commitment hash |
| 1.6 | LOW | Contract | `MIN_COMMITMENT_AGE = 0` weakens anti-front-running |
| 1.7 | LOW | Contract | `getOwnedLabels` gas unbounded |
| 2.1 | LOW | SDK | Negative results cached |
| 2.2 | LOW | SDK | `commitRevealRequired` cached permanently |
| 3.3 | LOW | API | QR size NaN fallback missing |
| 3.4 | LOW | API | No address validation on reverse endpoint |
| 4.1 | LOW | Frontend | Hardcoded fallback addresses |
| 4.2 | LOW | Frontend | `window.ethereum as any` bypasses type safety |
| 1.8 | INFO | Contract | Transfer doesn't update resolved address |
| 2.3 | INFO | SDK | No retry logic |
| 3.5 | INFO | API | Double caching |
| 4.3 | INFO | Frontend | Diagnostics expose internal config |
| 4.4 | INFO | Frontend | No CSP headers |
| 5.2 | LOW | DevOps | Deploy script hardcodes path |
| 5.3 | INFO | DevOps | Only 1 test case |

**No CRITICAL vulnerabilities found.**
**No backdoors found.**
**No unauthorized fund extraction paths found.**
