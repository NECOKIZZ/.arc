# ARC Name Service (ANS) - Revised Implementation Plan

This plan updates the original prompt to align with Arc testnet constraints, safer contract design, and realistic MVP scope.

## 1) Arc-Specific Foundations (Must Lock First)

- Network: Arc Testnet only
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Faucet: `https://faucet.circle.com`
- USDC (ERC-20) token: `0x3600000000000000000000000000000000000000`

Critical implementation rules:
- Arc uses USDC as native gas. No ETH flow should appear anywhere in docs/UI.
- Keep decimal handling explicit:
- Native gas accounting: 18 decimals
- ERC-20 USDC token accounting: 6 decimals
- Keep testnet-only assumptions in env/config to avoid accidental mainnet targeting.

## 2) Contract Design Changes (High Priority)

The original storage model is too restrictive and expensive. Replace it with a normalized-label and hash-based registry.

### 2.1 Data Model

Use normalized label hashes (`bytes32 labelHash = keccak256(bytes(normalizedLabel))`) as primary keys.

Recommended storage:
- `mapping(bytes32 => Record) records`
- `mapping(address => bytes32[]) ownerToNames` (or index-based owner enumeration)
- `mapping(address => bytes32) primaryName` (optional reverse record)

`Record`:
- `address owner`
- `address resolvedAddress`
- `uint64 expiry`
- `bool reserved`

Why:
- Avoids expensive `string` keys.
- Supports multiple names per owner.
- Makes reverse resolution explicit (`primaryName`) instead of assuming one name per wallet.

### 2.2 Function Model

Keep these core functions:
- `register(string calldata label, address resolvedAddress)`
- `resolve(string calldata label) returns (address)`
- `setPrimaryName(string calldata label)` / `reverseResolve(address wallet)`
- `updateResolvedAddress(string calldata label, address newAddress)`
- `transferName(string calldata label, address newOwner)`
- `renew(string calldata label)`
- `release(string calldata label)`
- `isAvailable(string calldata label)`
- `getRecord(string calldata label)`

Add:
- `quotePrice(string calldata label, uint256 years) returns (uint256)` for SDK/UI determinism.

### 2.3 Security and Economic Fixes

- Use OpenZeppelin: `Ownable2Step`, `ReentrancyGuard`, `Pausable`, `SafeERC20`.
- Charge fees in ERC-20 USDC via `transferFrom`; never mix with native gas accounting.
- Add commit-reveal registration flow for production (`commit` -> `register`) to reduce name sniping.
- For hackathon MVP, if skipping commit-reveal, explicitly document front-running risk.
- Add grace period (for example 30 days) before released-expired names can be re-registered.
- Validate names both off-chain and on-chain with identical normalization rules.

### 2.4 Name Rules

- Input labels are case-insensitive; normalize to lowercase before hashing.
- Allowed chars: `a-z`, `0-9`, `-`
- Length: 3-32
- Cannot start/end with `-`
- Reserved labels blocklist at deploy (hashed constants)
- Decide now whether users register `david` and UI appends `.arc`, or users register `david.arc`.
- Recommendation: store only label (`david`) on-chain; add `.arc` in presentation.

## 3) SDK Plan Changes

Split SDK into read and write clients:

- Read client (no wallet): `resolve`, `reverseLookup`, `isAvailable`, `getNameInfo`, `getQRCodeDataUrl`
- Write client (wallet/signer required): `register`, `renew`, `updateResolvedAddress`, `transferName`, `setPrimaryName`

Requirements:
- Normalize input consistently (`david` and `david.arc` both accepted)
- Cache reads (TTL default 60s)
- Return typed errors for write failures; return `null` for not-found read paths
- Export ESM + CJS (UMD optional, not required for MVP)

## 4) API Plan Changes

Keep API as a thin read layer only for MVP.

Endpoints to keep:
- `GET /resolve/:name`
- `GET /reverse/:address`
- `GET /available/:name`
- `GET /profile/:name`
- `GET /qr/:name`

Operational additions:
- Add input normalization middleware (single source of truth)
- Add per-IP rate limiting and CORS
- Add 30s cache
- Add health endpoint (`GET /healthz`)

Non-MVP:
- Avoid write endpoints in REST at this stage (wallet flow should remain in frontend).

## 5) Frontend Plan Changes

Keep pages but tighten scope:
- `/` availability + CTA
- `/register` register + fee quote + tx status
- `/[name]` public profile + QR download
- `/dashboard` manage owned names (renew/update/transfer + set primary)

Clarifications:
- Use a single canonical URL strategy:
- Public profile recommendation: `https://arcnames.io/n/david` (cleaner routing)
- Always show network badge: `Arc Testnet`
- Show both balances when relevant:
- Wallet native gas (USDC native)
- ERC-20 USDC token needed for registry fee

## 6) Deployment and DevOps Corrections

- Do not pass private keys directly in CLI flags in shared/testnet environments.
- Use `.env` + encrypted keystore or secure wallet import.
- Verify contract on Arc explorer after deployment.
- Publish ABI and deployed addresses in versioned JSON (`deployments/arc-testnet.json`).
- Keep a single env var namespace for all services:
- `ARC_CHAIN_ID=5042002`
- `ARC_RPC_URL=...`
- `ANS_REGISTRY_ADDRESS=...`
- `USDC_TOKEN_ADDRESS=0x3600...0000`

## 7) Revised MVP (Execution Order)

1. Contract v0:
- `register`, `resolve`, `isAvailable`, `getRecord`, `renew`
- USDC fee collection + treasury
- strict validation + events

2. Frontend v0:
- availability search
- register flow
- public profile with QR

3. SDK v0:
- `resolve`, `isAvailable`, `getNameInfo`, `getQRCodeDataUrl`

4. API v0:
- `/resolve/:name`, `/available/:name`, `/qr/:name`, `/healthz`

5. Hardening v1:
- commit-reveal registration
- primary name + reverse lookup
- transfer and release edge-case handling

## 8) Open Decisions to Freeze Before Coding

- Pricing policy finalization:
- base fee, short-name premium, and multi-year discounts
- Reverse policy:
- one primary name per wallet vs first-owned default
- Expiry behavior:
- immediate availability vs grace period
- Routing:
- `/david.arc` vs `/n/david`

Recommendation:
- Freeze these four decisions first, then implementation can proceed without rework.
