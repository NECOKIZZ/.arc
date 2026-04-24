# ARC Name Service (ANS) — Complete Documentation

**Version:** 0.1.0 (MVP)
**Network:** Arc Testnet (Chain ID: 5042002)
**Native Gas Token:** USDC

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Smart Contract](#3-smart-contract)
4. [TypeScript SDK](#4-typescript-sdk)
5. [REST API](#5-rest-api)
6. [Web Frontend](#6-web-frontend)
7. [Environment Configuration](#7-environment-configuration)
8. [Deployment Guide](#8-deployment-guide)
9. [Development Workflow](#9-development-workflow)
10. [Security Model](#10-security-model)
11. [Error Reference](#11-error-reference)
12. [Contract Addresses](#12-contract-addresses)

---

## 1. Overview

ARC Name Service (ANS) provides human-readable `.arc` domain names on the Arc Testnet blockchain. Instead of sharing raw wallet addresses like `0x858f3232E7d6702F20c4D3FEAB987A405D225f4E`, users register names like `david.arc` and share those for payments and identity.

### Core Capabilities

- **Name registration** — Claim a `.arc` name linked to your wallet
- **Name resolution** — Convert `.arc` names to wallet addresses (forward lookup)
- **Reverse resolution** — Convert wallet addresses back to `.arc` names
- **Name management** — Renew, transfer, update resolved address, release
- **Primary names** — Set one name as your identity for reverse lookups
- **Payment QR codes** — Generate QR codes for payment profiles
- **Commit-reveal registration** — Front-running protection for name claims

### Key Facts

| Property | Value |
|---|---|
| Name format | 3–32 characters, lowercase alphanumeric only (`a-z`, `0-9`) |
| Registration fee | 5 USDC/year (standard), 50 USDC/year (≤4 chars) |
| Registration period | 365 days |
| Grace period | 30 days after expiry |
| Payment token | USDC (ERC-20 on Arc) |
| Reserved names | `admin`, `arc`, `treasury`, `null`, `void` |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Monorepo Root                      │
│  package.json (workspaces: packages/*)               │
├──────────────┬───────────┬───────────┬───────────────┤
│  contracts   │    sdk    │    api    │      web      │
│  (Solidity)  │   (TS)    │ (Express) │   (Next.js)   │
│              │           │           │               │
│  ARCName     │  ARCNames │  REST     │  Register     │
│  Registry    │  class    │  endpoints│  Dashboard    │
│  .sol        │           │           │  Profile      │
│              │           │           │  WalletCtx    │
└──────┬───────┴─────┬─────┴─────┬─────┴───────┬───────┘
       │             │           │             │
       │    imports   │  imports  │   imports   │
       │             │           │             │
       ▼             ▼           ▼             ▼
  Arc Testnet    Arc Testnet  SDK + QR     SDK + ethers
  (on-chain)     (via RPC)    (read-only)  (read+write)
```

### Package Dependencies

```
@arc/contracts  →  (standalone, Hardhat + OpenZeppelin)
@arc/names      →  ethers, qrcode
@arc/names-api  →  @arc/names, express, cors, express-rate-limit, lru-cache
@arc/names-web  →  @arc/names, ethers, next, react
```

### Data Flow

1. **Registration:** Browser → MetaMask → USDC.approve() → Registry.registerWithCommit() → Arc Testnet
2. **Resolution:** Browser → SDK.resolve() → RPC → Registry.resolve() → address
3. **Profile view:** Browser → Next.js SSR → API → SDK → RPC → Registry → response → HTML

---

## 3. Smart Contract

**File:** `packages/contracts/contracts/ARCNameRegistry.sol`
**Solidity:** 0.8.24
**Dependencies:** OpenZeppelin 5.x (Ownable2Step, Pausable, ReentrancyGuard, SafeERC20)

### 3.1 Storage Layout

```solidity
struct Record {
    address owner;           // Who owns this name
    address resolvedAddress; // What address the name points to
    uint64  expiry;          // Unix timestamp when registration expires
    bool    reserved;        // Whether admin has reserved this name
    string  label;           // The normalized label (e.g., "david")
}

mapping(bytes32 => Record) records;                          // labelHash → Record
mapping(address => bytes32[]) ownedLabelHashes;              // wallet → array of owned hashes
mapping(address => mapping(bytes32 => uint256)) ownerIndexPlusOne; // wallet → hash → index+1
mapping(address => bytes32) primaryName;                     // wallet → primary label hash
mapping(bytes32 => uint64) commitTimestamp;                  // commitment → timestamp
```

### 3.2 Constants

| Constant | Value | Description |
|---|---|---|
| `REGISTRATION_PERIOD` | 365 days | How long a registration lasts |
| `GRACE_PERIOD` | 30 days | Window after expiry before name becomes available |
| `MIN_COMMITMENT_AGE` | 0 | Minimum wait between commit and reveal |
| `MAX_COMMITMENT_AGE` | 1 day | Maximum wait between commit and reveal |
| `DOT_ARC` | `0x2e617263` | Bytes4 encoding of ".arc" |

### 3.3 Public Functions

#### Registration

| Function | Access | Modifiers | Description |
|---|---|---|---|
| `register(rawLabel, resolvedAddress)` | Public | `whenNotPaused`, `nonReentrant` | Direct registration (only when commit-reveal disabled) |
| `submitCommitment(commitment)` | Public | `whenNotPaused` | Submit a commitment hash for commit-reveal |
| `registerWithCommit(rawLabel, resolvedAddress, salt)` | Public | `whenNotPaused`, `nonReentrant` | Register using prior commitment |
| `computeCommitment(registrant, rawLabel, salt)` | Pure | — | Helper to compute commitment off-chain |

#### Resolution

| Function | Access | Description |
|---|---|---|
| `resolve(rawLabel)` | View | Returns resolved address or `address(0)` |
| `reverseResolve(wallet)` | View | Returns primary name with `.arc` suffix or empty string |
| `getRecord(rawLabel)` | View | Returns (owner, resolvedAddress, expiry, expired, reserved) |
| `isAvailable(rawLabel)` | View | Returns true if name can be registered |
| `getOwnedLabels(wallet)` | View | Returns array of owned name strings |
| `quotePrice(rawLabel, yearsCount)` | View | Returns fee in USDC (6 decimals) |

#### Management

| Function | Access | Description |
|---|---|---|
| `renew(rawLabel)` | Public (`whenNotPaused`, `nonReentrant`) | Extend registration by 1 year. Requires USDC. |
| `release(rawLabel)` | Public | Permanently give up a name |
| `updateResolvedAddress(rawLabel, newAddress)` | Public | Change where the name points |
| `transferName(rawLabel, newOwner)` | Public | Transfer ownership to another wallet |
| `setPrimaryName(rawLabel)` | Public | Set as your reverse-lookup identity |

#### Admin (onlyOwner)

| Function | Description |
|---|---|
| `setCommitRevealRequired(bool)` | Toggle commit-reveal mode |
| `reserveName(rawLabel)` | Reserve a name (prevent registration) |
| `setFees(baseFee, shortNameFee)` | Update registration fees |
| `setTreasury(newTreasury)` | Update fee recipient |
| `pause()` / `unpause()` | Emergency stop |

### 3.4 Events

| Event | Parameters |
|---|---|
| `NameRegistered` | label, labelHash, owner, resolvedAddress, expiry |
| `NameCommitmentSubmitted` | registrant, commitment, timestamp |
| `NameUpdated` | label, labelHash, newAddress |
| `NameTransferred` | label, labelHash, oldOwner, newOwner |
| `NameRenewed` | label, labelHash, newExpiry |
| `NameReleased` | label, labelHash |
| `NameReserved` | label, labelHash |
| `PrimaryNameSet` | owner, label, labelHash |
| `CommitRevealModeUpdated` | required |
| `FeesUpdated` | baseFeeUSDC, shortNameFeeUSDC |
| `TreasuryUpdated` | treasury |

### 3.5 Custom Errors

| Error | When |
|---|---|
| `InvalidLabel()` | Name fails validation (length, characters) |
| `NameNotAvailable()` | Name is already registered and not expired+grace |
| `NotLabelOwner()` | Caller doesn't own this name |
| `InvalidAddress()` | Zero address passed |
| `NameExpired()` | Name is past expiry + grace period |
| `NameNotFound()` | No registration exists for this name |
| `NameIsReserved()` | Name is in the reserved list |
| `CommitmentMissing()` | No prior commitment found |
| `CommitmentTooNew()` | Commitment submitted too recently |
| `CommitmentExpired()` | Commitment is older than MAX_COMMITMENT_AGE |
| `CommitmentAlreadyUsed()` | Commitment hash was already submitted |
| `CommitRevealRequired()` | Direct registration called when commit-reveal is enabled |

### 3.6 Name Normalization Rules

The contract's `_normalizeLabel` function:

1. Converts uppercase letters to lowercase
2. Strips trailing `.arc` suffix if present
3. Validates length: 3–32 characters
4. Validates characters: only `a-z` and `0-9` (alphanumeric)
5. Returns the normalized label

### 3.7 Registration Flow (Commit-Reveal)

```
Step 1: User calls submitCommitment(hash)
        hash = keccak256(abi.encodePacked(msg.sender, labelHash, salt))
        Contract stores timestamp

Step 2: User calls registerWithCommit(rawLabel, resolvedAddress, salt)
        Contract verifies:
          - Commitment exists and matches
          - MIN_COMMITMENT_AGE ≤ elapsed ≤ MAX_COMMITMENT_AGE
          - Name is available and not reserved
          - USDC fee is transferred to treasury
        Contract creates the record
```

### 3.8 Availability Logic

A name is "available" if:
- `record.owner == address(0)` (never registered), OR
- `record.expiry + GRACE_PERIOD < block.timestamp` (expired past grace)

AND the name is not reserved.

### 3.9 Renewal Logic

- Only the owner can renew
- Must be before `expiry + GRACE_PERIOD`
- New expiry = `max(current_expiry, now) + 365 days`
- Requires USDC fee payment

---

## 4. TypeScript SDK

**Package:** `@arc/names`
**File:** `packages/sdk/src/index.ts`
**Build:** `tsup` (outputs ESM + CJS + DTS)

### 4.1 Installation & Setup

```typescript
import { ARCNames, normalizeName } from "@arc/names";

// Read-only (no signer needed)
const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2",
  cacheTimeout: 60000, // optional, default 60s
});

// Read + Write (signer required)
const ansWrite = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2",
  signer: ethersJsSigner,
});
```

### 4.2 Read Methods

#### `resolve(rawName): Promise<string | null>`
Forward lookup. Returns wallet address or `null`.
```typescript
const addr = await ans.resolve("david"); // "0x858f..." or null
```

#### `reverseLookup(address): Promise<string | null>`
Reverse lookup. Returns `"david.arc"` or `null`.
```typescript
const name = await ans.reverseLookup("0x858f...");
```

#### `isAvailable(rawName): Promise<boolean>`
Check if a name can be registered.
```typescript
const avail = await ans.isAvailable("myname");
```

#### `getNameInfo(rawName): Promise<NameInfo>`
Full record including owner, resolved address, expiry, status.
```typescript
const info = await ans.getNameInfo("david");
// { name: "david.arc", address: "0x...", owner: "0x...", expiry: 1745..., isExpired: false, isReserved: false }
```

#### `quotePrice(rawName, years?): Promise<bigint>`
Get registration/renewal fee in USDC (6 decimals).
```typescript
const fee = await ans.quotePrice("david"); // 5000000n (5 USDC)
const shortFee = await ans.quotePrice("abc"); // 50000000n (50 USDC)
```

#### `getQRCodeDataUrl(rawName, baseUrl?): Promise<string>`
Generate a QR code as a data URL.
```typescript
const qr = await ans.getQRCodeDataUrl("david");
// "data:image/png;base64,..."
```

### 4.3 Write Methods (require signer)

All write methods return the transaction hash as a `string`.

| Method | Description |
|---|---|
| `register(rawName, resolvedAddress?)` | Register a name. Auto-detects commit-reveal mode. |
| `renew(rawName)` | Extend registration by 1 year |
| `releaseName(rawName)` | Permanently release a name |
| `updateResolvedAddress(rawName, newAddress)` | Change resolved address |
| `transferName(rawName, newOwner)` | Transfer ownership |
| `setPrimaryName(rawName)` | Set as primary (reverse lookup) |

### 4.4 `normalizeName(rawName): string`

Exported standalone function. Validates and normalizes a name:
- Trims whitespace, lowercases
- Strips `.arc` suffix
- Validates: 3–32 chars, alphanumeric only (`/^[a-z0-9]+$/`)
- Throws descriptive `Error` on failure

### 4.5 Caching

- All read methods cache results in an in-memory `Map`
- Default TTL: 60 seconds (configurable via `cacheTimeout`)
- Write methods automatically evict related cache entries
- Cache is per-instance (not shared across instances)

### 4.6 Commit-Reveal Auto-Detection

The SDK automatically:
1. Checks `commitRevealRequired()` on first write
2. If enabled: generates random salt → submits commitment → registers with commit
3. If disabled: calls `register()` directly
4. Result is cached for the lifetime of the instance

---

## 5. REST API

**Package:** `@arc/names-api`
**File:** `packages/api/src/server.ts`
**Framework:** Express.js
**Default port:** 8787

### 5.1 Endpoints

#### `GET /healthz`
Health check. Always returns 200.
```json
{
  "ok": true,
  "network": "arcTestnet",
  "chainId": 5042002,
  "timestamp": "2026-04-23T20:00:00.000Z"
}
```

#### `GET /resolve/:name`
Resolve a name to its full record.
```json
{
  "name": "david.arc",
  "address": "0x858f3232E7d6702F20c4D3FEAB987A405D225f4E",
  "owner": "0x858f3232E7d6702F20c4D3FEAB987A405D225f4E",
  "expiry": 1745441232,
  "resolved": true
}
```

#### `GET /reverse/:address`
Reverse lookup an address to its primary name.
```json
{
  "address": "0x858f3232E7d6702F20c4D3FEAB987A405D225f4E",
  "name": "david.arc",
  "resolved": true
}
```

#### `GET /available/:name`
Check name availability.
```json
{
  "name": "david.arc",
  "available": false
}
```

#### `GET /profile/:name`
Full profile with QR code URL.
```json
{
  "name": "david.arc",
  "address": "0x858f3232E7d6702F20c4D3FEAB987A405D225f4E",
  "expiry": 1745441232,
  "qrUrl": "http://localhost:8787/qr/david.arc",
  "profileUrl": "http://localhost:8787/profile/david.arc"
}
```

#### `GET /qr/:name`
QR code image. Returns PNG by default.

| Parameter | Default | Description |
|---|---|---|
| `size` | 300 | Image width in pixels (100–1000) |
| `format` | png | `png` or `svg` |

### 5.2 Error Handling

All errors return HTTP 400 with:
```json
{ "error": "error message" }
```

### 5.3 Rate Limiting

- **100 requests per minute** per IP
- Standard rate-limit headers included in responses

### 5.4 Caching

- LRU cache with 5000 entry max, 30-second TTL
- SDK internal cache adds another 60-second layer

---

## 6. Web Frontend

**Package:** `@arc/names-web`
**Framework:** Next.js 15.5
**Styling:** Custom CSS (dark theme, no external UI library)

### 6.1 Pages

| Route | File | Type | Description |
|---|---|---|---|
| `/` | `app/page.tsx` | Server Component | Home page with hero, how-it-works, API status |
| `/register` | `app/register/page.tsx` | Client Component | Name search + registration flow |
| `/dashboard` | `app/dashboard/page.tsx` | Client Component | Name management (renew, transfer, etc.) |
| `/n/[name]` | `app/n/[name]/page.tsx` | Server Component | Public profile page |

### 6.2 Shared Components

| File | Purpose |
|---|---|
| `app/layout.tsx` | Root layout with navigation bar, Google Fonts, WalletProvider |
| `app/wallet-context.tsx` | React context for persistent wallet state |
| `app/globals.css` | Complete design system (dark theme, components) |
| `global.d.ts` | TypeScript types for `window.ethereum` |

### 6.3 Wallet Context

The `WalletProvider` component manages:

- **Wallet address** — Current connected account
- **Chain ID** — Current network
- **Auto-reconnect** — On page load, silently checks `eth_accounts` if previously connected
- **Persistence** — Stores connection flag in `localStorage` (`ans_wallet_connected`)
- **Event listeners** — Reacts to `accountsChanged` and `chainChanged` globally
- **`connect()`** — Triggers `eth_requestAccounts`
- **`switchToArc()`** — Switches to Arc Testnet (adds chain if not present)

All pages consume wallet state via `useWallet()` hook. Wallet stays connected across page navigation.

### 6.4 Registration Flow (UI)

```
1. User connects wallet → WalletContext stores address
2. User types a name → Clicks "Search"
3. Frontend calls SDK.isAvailable() → Shows availability message
4. If available, user clicks "Register [name].arc"
5. Step indicator appears: Check Balance → Approve USDC → Register → Done
6. Frontend checks USDC balance via ERC-20 contract
7. If allowance insufficient, prompts USDC approval tx
8. Calls SDK.register() (handles commit-reveal internally)
9. Shows success message with explorer link
```

### 6.5 Dashboard Features

| Feature | Description |
|---|---|
| **Name selector** | Dropdown of all owned names, auto-loaded when wallet connects |
| **Renew** | Checks USDC balance/allowance, approves if needed, calls SDK.renew() |
| **Set primary** | Calls SDK.setPrimaryName() |
| **Update resolved address** | Input + validate + SDK.updateResolvedAddress() |
| **Transfer** | Input new owner + confirm + SDK.transferName() |
| **Release** | Confirm dialog + SDK.releaseName() |
| **Transaction history** | Collapsible log of recent actions with explorer links |

### 6.6 Error Messages

The frontend translates raw blockchain errors into user-friendly messages:

| Raw Error | User Sees |
|---|---|
| `user rejected` / `user denied` | "You rejected the transaction in your wallet." |
| `NameIsReserved` / `reserved` | "This name is reserved and cannot be registered." |
| `NameNotAvailable` | "This name is no longer available." |
| `insufficient funds` / `exceeds balance` | "Not enough funds for gas. You need USDC in your wallet for both the fee and gas." |
| `revert` (generic) | "Transaction failed on-chain. This can happen if the name was just taken, or if USDC approval is insufficient." |
| `network` / `fetch` | "Network error. Check your connection and try again." |
| Balance check | "You need X USDC but only have Y USDC. Get testnet USDC from the Circle faucet." |

### 6.7 CSS Design System

The `globals.css` file provides a complete design language:

**Colors (CSS variables):**
| Variable | Value | Usage |
|---|---|---|
| `--bg-start` / `--bg-end` | `#060d11` / `#0a1a22` | Background gradient |
| `--surface` | `rgba(12,30,38,0.65)` | Card backgrounds |
| `--accent` | `#44ffc9` | Primary accent (teal/mint) |
| `--danger` | `#ff6b6b` | Error/destructive actions |
| `--warn` | `#ffd666` | Warnings |
| `--text` | `#e8f4fa` | Primary text |
| `--text-secondary` | `#8eb8cc` | Muted text |

**Components:** `.card`, `.badge`, `.msg`, `.steps`, `.btn-primary`, `.btn-danger`, `.btn-sm`, `.log-list`, `.collapsible-trigger`, `.profile-avatar`, `.profile-field`, `.qr-wrap`, `.spinner`, `.fade-in`

---

## 7. Environment Configuration

All configuration is via a single `.env` file at the project root.

### 7.1 Required Variables

| Variable | Example | Used By |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | `0xabc...` | Contracts (deploy script) |
| `ARC_RPC_URL` | `https://rpc.testnet.arc.network` | Contracts, API |
| `ANS_REGISTRY_ADDRESS` | `0xaDe3b1ae...` | API |
| `NEXT_PUBLIC_ANS_REGISTRY_ADDRESS` | `0xaDe3b1ae...` | Web frontend |

### 7.2 Optional Variables (with defaults)

| Variable | Default | Used By |
|---|---|---|
| `ARC_CHAIN_ID` | `5042002` | Contracts |
| `USDC_TOKEN_ADDRESS` | `0x360000...` | Contracts |
| `TREASURY_ADDRESS` | deployer address | Contracts |
| `REGISTRATION_FEE_USDC` | `5000000` (5 USDC) | Contracts |
| `SHORT_NAME_FEE_USDC` | `50000000` (50 USDC) | Contracts |
| `PORT` | `8787` | API |
| `WEB_PUBLIC_API_BASE_URL` | `http://localhost:8787` | API |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8787` | Web |
| `NEXT_PUBLIC_ARC_CHAIN_ID` | `5042002` | Web |
| `NEXT_PUBLIC_ARC_RPC_URL` | `https://rpc.testnet.arc.network` | Web |
| `NEXT_PUBLIC_USDC_TOKEN_ADDRESS` | `0x360000...` | Web |
| `NEXT_PUBLIC_ARC_EXPLORER_URL` | `https://testnet.arcscan.app/tx/` | Web |

### 7.3 Important Notes

- Variables prefixed with `NEXT_PUBLIC_` are embedded into the frontend JavaScript bundle at build time
- Changing `NEXT_PUBLIC_` variables requires restarting the Next.js dev server
- `DEPLOYER_PRIVATE_KEY` must NEVER be committed to version control
- `ANS_REGISTRY_ADDRESS` and `NEXT_PUBLIC_ANS_REGISTRY_ADDRESS` should contain the same value

---

## 8. Deployment Guide

### 8.1 Prerequisites

- Node.js 18+
- A wallet with USDC on Arc Testnet (for deploying and testing)
- Private key for the deployer wallet

### 8.2 Initial Setup

```bash
# Clone and install
git clone <repo-url>
cd arc-name-service
npm install

# Configure environment
cp .env.example .env
# Edit .env: set DEPLOYER_PRIVATE_KEY and TREASURY_ADDRESS
```

### 8.3 Deploy Contract

```bash
cd packages/contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network arcTestnet
```

Output: `Deployed ARCNameRegistry: 0x...`

Update `.env` with the new address:
```
ANS_REGISTRY_ADDRESS=0x<new-address>
NEXT_PUBLIC_ANS_REGISTRY_ADDRESS=0x<new-address>
```

### 8.4 Start Services

```bash
# From project root
npm run dev:api   # Starts API on port 8787
npm run dev:web   # Builds SDK + starts Next.js on port 3000
```

### 8.5 Verify Deployment

```bash
# Check API
curl http://localhost:8787/healthz

# Check name availability
curl http://localhost:8787/available/testname
```

---

## 9. Development Workflow

### 9.1 Monorepo Scripts

| Command | Description |
|---|---|
| `npm run dev:web` | Build SDK → Start Next.js dev server |
| `npm run dev:api` | Build SDK → Start Express API |
| `npm run build` | Build all packages |
| `npm run build:sdk` | Build SDK only |
| `npm run build:contracts` | Compile Solidity contracts |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all packages |

### 9.2 Package Structure

```
arc-name-service/
├── .env                        # Environment config (not committed)
├── .env.example                # Template for .env
├── package.json                # Root monorepo config
├── deployments/
│   └── arc-testnet.json        # Last deployment record
├── packages/
│   ├── contracts/
│   │   ├── contracts/
│   │   │   ├── ARCNameRegistry.sol
│   │   │   └── MockUSDC.sol
│   │   ├── scripts/deploy.ts
│   │   ├── test/ARCNameRegistry.test.ts
│   │   └── hardhat.config.ts
│   ├── sdk/
│   │   ├── src/index.ts
│   │   ├── dist/               # Build output
│   │   └── tsconfig.json
│   ├── api/
│   │   └── src/server.ts
│   └── web/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   ├── wallet-context.tsx
│       │   ├── register/page.tsx
│       │   ├── dashboard/page.tsx
│       │   └── n/[name]/page.tsx
│       ├── global.d.ts
│       └── next.config.ts
```

### 9.3 Making Changes

- **Contract changes:** Edit `.sol` → `npx hardhat compile` → `npx hardhat test` → re-deploy
- **SDK changes:** Edit `src/index.ts` → SDK auto-rebuilds on `dev:web`/`dev:api`
- **API changes:** Edit `src/server.ts` → restart `dev:api`
- **Frontend changes:** Edit files in `app/` → Next.js hot-reloads automatically

---

## 10. Security Model

### 10.1 Trust Assumptions

| Entity | Trust Level | Powers |
|---|---|---|
| Contract Owner | Fully trusted | Can pause, set fees, reserve names, change treasury, toggle commit-reveal |
| Users | Untrusted | Can only manage their own names, must pay fees |
| API Server | Read-only | Cannot modify on-chain state |
| Frontend | Untrusted client | All write operations require wallet signature |

### 10.2 On-Chain Protections

- **ReentrancyGuard** on all payment functions
- **SafeERC20** for all token transfers
- **Ownable2Step** requires two transactions to transfer contract ownership
- **Pausable** emergency circuit breaker
- **Commit-reveal** prevents mempool front-running of registrations
- **Existence checks** before ownership checks (proper error ordering)
- **Input normalization** prevents case/suffix variants from registering duplicates

### 10.3 Off-Chain Security

- **No private keys** in frontend code
- **No write capabilities** in the API
- **Rate limiting** on API (100 req/min)
- **`NEXT_PUBLIC_` prefix** ensures only intended variables reach the browser
- **`rel="noreferrer"`** on all external links
- **`encodeURIComponent`** on user input in URLs
- **Wallet events** properly cleaned up on unmount

### 10.4 Known Limitations (MVP)

- No contract upgrade mechanism (immutable deployment)
- No multi-sig on owner role
- No domain separator in commitment hash
- `MIN_COMMITMENT_AGE = 0` (front-running protection is weak)
- Only 1 unit test
- No formal verification

---

## 11. Error Reference

### 11.1 Contract Errors

| Error | Cause | Resolution |
|---|---|---|
| `InvalidLabel()` | Name too short/long or contains invalid characters | Use 3-32 chars, a-z and 0-9 only |
| `NameNotAvailable()` | Name is registered and not past grace period | Wait for expiry + 30 days, or choose another name |
| `NotLabelOwner()` | Caller doesn't own this name | Connect with the correct wallet |
| `NameExpired()` | Name is past expiry + grace period | Cannot renew; re-register instead |
| `NameNotFound()` | No record exists for this name | Register the name first |
| `NameIsReserved()` | Name is in the reserved list | Choose a different name |
| `InvalidAddress()` | Zero address provided | Provide a valid non-zero address |
| `CommitmentMissing()` | No prior commitment for this registration | Call submitCommitment first |
| `CommitmentTooNew()` | Commitment submitted too recently | Wait for MIN_COMMITMENT_AGE |
| `CommitmentExpired()` | Commitment is older than 1 day | Submit a new commitment |
| `CommitRevealRequired()` | Direct register called when commit-reveal is on | Use registerWithCommit instead |

### 11.2 Common Frontend Errors

| Symptom | Cause | Fix |
|---|---|---|
| "No wallet found" | No MetaMask or Web3 wallet | Install MetaMask browser extension |
| "Wrong network" badge | Wallet not on Arc Testnet | Click "Switch to Arc" button |
| "You need X USDC but only have Y" | Insufficient USDC balance | Get testnet USDC from Circle faucet |
| "Transaction rejected in wallet" | User clicked "Reject" in MetaMask | Try again and approve the transaction |
| "Transaction failed on-chain" | Generic revert | Check USDC approval, name availability |
| "Network error" | RPC or internet connectivity issue | Check connection, try again |

---

## 12. Contract Addresses

### Arc Testnet (Chain ID: 5042002)

| Contract | Address |
|---|---|
| **ARCNameRegistry** | `0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2` |
| **USDC Token** | `0x3600000000000000000000000000000000000000` |

### Network Details

| Property | Value |
|---|---|
| Chain ID | 5042002 |
| RPC URL | `https://rpc.testnet.arc.network` |
| Block Explorer | `https://testnet.arcscan.app` |
| Native Gas Token | USDC |

### Previous Deployments

| Address | Status | Notes |
|---|---|---|
| `0xF317e6A747595F143Fc400D4fE0E866595731D5A` | Deprecated | First deployment, had bugs in renew/release check ordering |
| `0xae91b30E833ea6f6248D325b776fE1C55D7248D7` | Deprecated | Second deployment, allowed hyphens in names |
| `0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2` | **Active** | Current deployment, alphanumeric only |
