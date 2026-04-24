# ANS Feedback — Implementation Plan

Based on analysis of `ANS-Integration-Feedback.md` from GoGo / Arc Global Payouts.

---

## Phase 1: Unblock External Adoption (P0)

### 1A. Publish `@arc/names` to npm

**Effort:** ~1 hour
**Files:** `packages/sdk/package.json`, `packages/sdk/tsconfig.json`, npm account

Steps:
1. Verify `packages/sdk/package.json` has correct `name`, `version`, `main`, `module`, `types`, `files` fields
2. Ensure `tsup` build produces clean ESM + CJS + DTS output
3. Add `publishConfig` with `"access": "public"`
4. Run `npm publish` from `packages/sdk`
5. Verify installation works in a fresh project: `npm install @arc/names`
6. Update `INTEGRATION_GUIDE.md` and `DOCUMENTATION.md` with real install instructions

### 1B. Create `@arc/names-react` hooks package

**Effort:** ~4 hours
**New package:** `packages/react/`

Hooks to implement:
- `useANSResolve(input, { debounceMs?, cacheMs? })` — forward resolution with debounce, loading, error states
- `useANSReverse(address)` — reverse lookup for navbar/profile display
- `useANSAvailability(name)` — availability check for registration UIs

Implementation details:
1. Create `packages/react/` with `package.json` (`@arc/names-react`), `tsconfig.json`, `tsup.config.ts`
2. Depend on `@arc/names` as a peer dependency
3. Use React 18+ hooks (`useState`, `useEffect`, `useRef`) — no external dependencies
4. Built-in 60s cache (configurable), stale-while-revalidate pattern
5. Proper cleanup on unmount (abort pending requests)
6. Export TypeScript types for all hook return values
7. Publish to npm alongside `@arc/names`

---

## Phase 2: Reduce Integration Friction (P1)

### 2A. Export ABI and addresses as constants

**Effort:** ~30 minutes
**Files:** `packages/sdk/src/index.ts`, `packages/sdk/src/constants.ts` (new)

Steps:
1. Create `packages/sdk/src/constants.ts`:
   - Export `ANS_REGISTRY_ABI` (the full ABI array, currently private in `index.ts`)
   - Export `ANS_REGISTRY_ADDRESSES: Record<number, string>` mapping chain IDs to addresses
   - Export `ANS_SUPPORTED_CHAIN_IDS: number[]`
   - Export `ANS_USDC_ADDRESSES: Record<number, string>`
2. Import from `constants.ts` in `index.ts` (replace inline ABI)
3. Add `@arc/names/constants` export path in `package.json` exports map
4. Update API (`server.ts`) and frontend pages to import from `@arc/names/constants` instead of hardcoding

### 2B. Deploy public REST API

**Effort:** ~2 hours
**Files:** `packages/api/`, deployment config

Steps:
1. Add a `Dockerfile` or Vercel/Railway config to `packages/api/`
2. Configure environment variables on the hosting platform
3. Deploy to a public URL (e.g., `https://ans-api.arc.network`)
4. Add CORS restriction to only allow known origins + public API key for higher rate limits
5. Update `INTEGRATION_GUIDE.md` with the public endpoint
6. Update `packages/web/` default `NEXT_PUBLIC_API_BASE_URL` to the public URL

---

## Phase 3: Developer Experience Polish (P2)

### 3A. Add `resolveWithReason()` to SDK

**Effort:** ~1 hour
**Files:** `packages/sdk/src/index.ts`

Steps:
1. Add new method `resolveWithReason(rawName)` that calls `getRecord()` and returns:
   ```typescript
   type ResolveResult = {
     address: string | null;
     reason: "found" | "not_registered" | "expired" | "reserved" | "invalid_name";
   }
   ```
2. Keep existing `resolve()` unchanged for backward compatibility
3. Add to React hooks: `useANSResolve` can optionally return reason

### 3B. Add batch resolution (multicall)

**Effort:** ~2 hours
**Files:** `packages/sdk/src/index.ts`

Steps:
1. Add `resolveMany(names: string[]): Promise<Array<{ name: string; address: string | null }>>` method
2. Use ethers.js `Contract.multicall()` or manual multicall encoding to batch all `resolve()` calls into a single RPC request
3. Chunk into batches of 50–100 to avoid RPC payload limits
4. Cache individual results from batch response
5. Add to React hooks: `useANSResolveMany(names[])`

### 3C. Write 5-minute integration guide

**Effort:** ~30 minutes
**Files:** `QUICK_START.md` (new) or prepend to `INTEGRATION_GUIDE.md`

Content:
- Pattern A: "Resolve a .arc name before sending USDC" (3 lines)
- Pattern B: "Show .arc name in your navbar" (using `useANSReverse` hook)
- Pattern C: "Address input with live .arc resolution" (using `useANSResolve` hook)
- Each pattern: install command, import, code snippet, expected output

---

## Phase 4: Future / Deferred (P3–P4)

These are **not planned for immediate implementation**:

| Item | Reason to Defer |
|---|---|
| `<ANSInput />` component (Rec 3) | Wait until hooks package is validated by integrators; hooks solve 90% of the need |
| wagmi name resolver plugin (Rec 6) | wagmi's `nameResolver` API is unstable; wait for it to stabilize |
| viem client pass-through (Rec 4) | SDK is ethers-based; only 1 chain currently exists; trivial for consumers to wrap |

---

## Execution Order

```
Week 1:  1A (npm publish) → 2A (export constants) → 3C (quick-start guide)
Week 2:  1B (React hooks package) → 3A (resolveWithReason)
Week 3:  3B (batch multicall) → 2B (public API deployment)
```

**Total estimated effort:** ~11 hours across 3 weeks

---

## Dependencies

- npm organization `@arc` must be available or reserved
- Hosting platform for public API (Vercel, Railway, or similar)
- Decision on whether to support both ethers.js and viem adapters long-term
