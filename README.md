# ARC Name Service (Arc Testnet MVP)

This repository implements the Arc-ready MVP from the revised plan:

- Smart contract registry (`packages/contracts`)
- TypeScript SDK (`packages/sdk`)
- Read-only REST API (`packages/api`)
- Minimal Next.js frontend (`packages/web`)

## Arc Settings

- Network: Arc Testnet
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- USDC token: `0x3600000000000000000000000000000000000000`

Arc uses USDC as native gas. No ETH is required for Arc transactions.

## Quick Start

1. Install dependencies at repo root:
```bash
npm install
```

2. Copy env file:
```bash
cp .env.example .env
```

3. Build contracts and deploy registry:
```bash
npm run build:contracts
npm run deploy:arc -w @arc/contracts
```

4. Set `ANS_REGISTRY_ADDRESS` in `.env` from deployment output.

5. Run API and web app:
```bash
npm run dev:api
npm run dev:web
```

## Contract Features Included

- Name registration and renewal with USDC `transferFrom` fees
- Name resolution and reverse resolution via primary name
- Name transfer, release, and ownership checks
- Hash-based label records, reserved name support, grace period
- Admin controls for fees, treasury, pause/unpause, reserves

## API Endpoints

- `GET /healthz`
- `GET /resolve/:name`
- `GET /reverse/:address`
- `GET /available/:name`
- `GET /profile/:name`
- `GET /qr/:name?size=300&format=png|svg`

## SDK Highlights

- `resolve`, `reverseLookup`, `isAvailable`, `getNameInfo`, `quotePrice`, `getQRCodeDataUrl`
- Write methods (signer required): `register`, `renew`, `updateResolvedAddress`, `transferName`, `setPrimaryName`
- Input normalization accepts `david` or `david.arc`
- 60-second in-memory cache for read paths

## Assumptions Frozen for MVP

- Label-only on-chain storage (`david`), `.arc` appended in presentation
- 1-year registration period
- 30-day grace period after expiry
- Base fee `5 USDC`, short-name fee (`<=4 chars`) `50 USDC`

## Security Note

This MVP does not implement commit-reveal yet. Registration is first-come-first-served and can be front-run.
