# ANS Competitive Action Plan — Closing Gaps with ArcID

## Gap 1: Multiple TLDs (.arc, .agent, .usdc)

**Effort:** ~3 hours (contract) + ~1 hour (SDK/frontend)
**Impact:** HIGH — unlocks AI agent and DeFi verticals

### Contract Changes
- Add a `validTLDs` mapping and admin function to register new TLDs
- Modify `_normalizeLabel` to accept and validate TLD suffixes
- Store TLD as part of the record key: `keccak256(label + tld)` instead of just `keccak256(label)`
- Add per-TLD pricing (optional — can share the existing pricing model)

### SDK Changes
- Update `normalizeName()` to parse and validate TLD
- Add `supportedTLDs()` method
- All existing methods work unchanged (`.arc` becomes the default)

### Frontend Changes  
- Search page shows availability across all TLDs (like ArcID's grid)
- Registration flow lets user pick TLD
- Dashboard shows names grouped by TLD

### Risk
- Requires contract redeployment
- Existing `.arc` names would need migration or parallel operation

---

## Gap 2: Modern Frontend (Tailwind + RainbowKit + wagmi)

**Effort:** ~6–8 hours full rewrite
**Impact:** MEDIUM — better DX and wallet UX, but current UI is functional

### Approach
1. Install: `tailwindcss`, `@rainbow-me/rainbowkit`, `wagmi`, `@tanstack/react-query`, `viem`
2. Replace `wallet-context.tsx` with wagmi's built-in wallet management
3. Replace manual `window.ethereum` calls with wagmi hooks (`useAccount`, `useWriteContract`, `useReadContract`)
4. Replace `globals.css` component classes with Tailwind utilities
5. Add RainbowKit `ConnectButton` in layout — handles multi-wallet, network switching, account modal

### Benefits
- RainbowKit supports MetaMask, WalletConnect, Coinbase Wallet, etc. out of the box
- wagmi handles chain switching, transaction state, and error handling automatically
- Tailwind makes responsive design easier and more consistent

### Risk
- Large rewrite — test thoroughly before merging
- Must keep the existing `@arc/names` SDK integration working alongside wagmi

---

## Gap 3: "Send USDC to .arc name" Page

**Effort:** ~2 hours
**Impact:** HIGH — transforms ANS from a registry into a payment tool

### Implementation
1. New page: `app/send/page.tsx`
2. Input: recipient (`.arc` name or 0x address) + amount (USDC)
3. Flow:
   - If input is `.arc` name → resolve via SDK → show resolved address
   - If input is 0x address → pass through
   - Check USDC balance
   - Call USDC `transfer(resolvedAddress, amount)` 
4. Show confirmation with explorer link

### Can be done independently of the frontend rewrite — uses existing SDK and wallet context.

---

## Gap 4: Agent API (Programmatic Registration)

**Effort:** ~3 hours
**Impact:** MEDIUM-HIGH — positions ANS for the agentic use case

### Implementation
1. Add a new endpoint to `packages/api`: `POST /register`
2. Requires a server-side wallet (funded with USDC) — the API acts as a registrar
3. Body: `{ name, owner, years, apiKey }`
4. Server validates, pays USDC from its own balance, registers on behalf of the caller
5. Rate limit and API key gate to prevent abuse
6. Return `{ txHash, name, owner, expiry }`

### Security Considerations
- Server wallet private key must be in env vars (never exposed)
- API key authentication required
- Per-key rate limiting
- Maximum registration budget per key
- Audit trail logging

### Alternative: Gasless meta-transactions
- User signs an EIP-712 message off-chain
- Server submits the transaction and pays gas
- More complex but doesn't require the server to hold USDC for fees

---

## Gap 5: More Competitive Pricing

**Effort:** ~5 minutes (contract owner call)
**Impact:** LOW-MEDIUM — marginal adoption factor

### Action
- Call `setFees(1000000, 20000000)` to set base fee to $1/yr and short name fee to $20/yr
- Or deploy with a 3-tier model matching ArcID: $20 (1-3), $5 (4), $1 (5+)
- This is purely a business decision, not a technical one

---

## Gap 6: Separate Resolver Pattern

**Effort:** ~1 hour (contract change)
**Impact:** LOW — only matters for advanced ENS-like architectures

### Assessment
Your current `resolvedAddress` field is functionally equivalent for 99% of use cases. The separate `resolver` pattern only matters if you want names to point to smart contract resolvers that return different addresses based on context (e.g., different addresses for different chains). 

**Recommendation:** Defer this. Your pattern is simpler and works. Only add resolver separation if cross-chain resolution becomes a requirement.

---

## Priority Execution Order

| Priority | Gap | Effort | Impact | Requires Redeploy? |
|----------|-----|--------|--------|---------------------|
| **1** | Send USDC page | 2h | HIGH | No |
| **2** | Multiple TLDs | 4h | HIGH | Yes |
| **3** | Agent API | 3h | MEDIUM-HIGH | No |
| **4** | Frontend modernization | 6-8h | MEDIUM | No |
| **5** | Pricing adjustment | 5min | LOW-MEDIUM | No (owner call) |
| **6** | Resolver pattern | 1h | LOW | Yes |

### Recommended approach:
- **This week:** Build the Send page (#1) — biggest ROI for least effort
- **Next week:** Add Agent API (#3) + adjust pricing (#5) — no redeployment needed  
- **Sprint 3:** Multi-TLD support (#2) — requires new contract, thorough testing
- **Sprint 4:** Frontend modernization (#4) — polish pass
