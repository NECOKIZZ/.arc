# Integrating ARC Name Service into Your dApp

ARC Name Service (ANS) resolves human-readable `.arc` names to wallet addresses on Arc Testnet. This guide shows how to integrate ANS into existing protocols and dApps.

---

## 1. SDK (Recommended)

Install the SDK directly from the monorepo or publish it as an npm package:

```bash
npm install @arc/names
```

### Resolve a name to a wallet address

```typescript
import { ARCNames } from "@arc/names";

const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2",
});

// Forward lookup: name → address
const address = await ans.resolve("david");
// "0x858f3232E7d6702F20c4D3FEAB987A405D225f4E"

// Reverse lookup: address → name
const name = await ans.reverseLookup("0x858f3232E7d6702F20c4D3FEAB987A405D225f4E");
// "david.arc"

// Check availability
const available = await ans.isAvailable("myname");
// true or false

// Full record: owner, resolved address, expiry, etc.
const info = await ans.getNameInfo("david");
```

### Register / manage names (requires signer)

```typescript
import { BrowserProvider } from "ethers";

const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2",
  signer,
});

const txHash = await ans.register("myname", "0x...");
await ans.renew("myname");
await ans.transferName("myname", "0xNewOwner...");
await ans.setPrimaryName("myname");
await ans.updateResolvedAddress("myname", "0xNewAddr...");
```

---

## 2. REST API

Run the API server for serverless or backend integrations:

```
GET /resolve/:name       → { "address": "0x..." }
GET /reverse/:address    → { "name": "david.arc" }
GET /available/:name     → { "available": true }
GET /profile/:name       → { "name", "address", "expiry", "qrUrl", "profileUrl" }
GET /qr/:name            → PNG image (QR code)
GET /healthz             → { "ok": true, "chainId": 5042002 }
```

### Example: resolve in any language

```bash
curl http://localhost:8787/resolve/david
# {"address":"0x858f3232E7d6702F20c4D3FEAB987A405D225f4E"}
```

```python
import requests
r = requests.get("http://localhost:8787/resolve/david")
address = r.json()["address"]
```

---

## 3. Direct Contract Integration (Solidity)

For on-chain integrations, call the registry contract directly:

```solidity
interface IANSRegistry {
    function resolve(string calldata rawLabel) external view returns (address);
    function getRecord(string calldata rawLabel) external view returns (
        address owner,
        address resolvedAddress,
        uint64 expiry,
        bool expired,
        bool reserved
    );
    function isAvailable(string calldata rawLabel) external view returns (bool);
    function reverseLookup(address wallet) external view returns (string memory);
}
```

### Example: accept `.arc` names in your payment contract

```solidity
import "./IANSRegistry.sol";

contract PaymentRouter {
    IANSRegistry public immutable ans;

    constructor(address ansRegistry) {
        ans = IANSRegistry(ansRegistry);
    }

    function payByName(string calldata name) external payable {
        address recipient = ans.resolve(name);
        require(recipient != address(0), "Name not registered");
        (bool ok, ) = recipient.call{value: msg.value}("");
        require(ok, "Transfer failed");
    }
}
```

---

## 4. Frontend Widget Pattern

Add name resolution to any input field:

```tsx
import { ARCNames } from "@arc/names";

function AddressInput({ onResolved }) {
  const [input, setInput] = useState("");
  const [resolved, setResolved] = useState(null);

  const ans = useMemo(() => new ARCNames({
    rpcUrl: "https://rpc.testnet.arc.network",
    registryAddress: "0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2",
  }), []);

  async function handleChange(value) {
    setInput(value);
    if (value.endsWith(".arc") || (!value.startsWith("0x") && value.length >= 3)) {
      try {
        const addr = await ans.resolve(value.replace(/\.arc$/, ""));
        setResolved(addr);
        if (addr) onResolved(addr);
      } catch {
        setResolved(null);
      }
    } else if (value.startsWith("0x")) {
      setResolved(value);
      onResolved(value);
    }
  }

  return (
    <div>
      <input
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="0x... or name.arc"
      />
      {resolved && <small>Resolved: {resolved}</small>}
    </div>
  );
}
```

---

## 5. Integration Patterns by Use Case

| Use Case | Method | Example |
|---|---|---|
| **Wallet / DEX** | SDK `resolve()` | Let users send tokens to `alice.arc` instead of `0x...` |
| **NFT marketplace** | SDK `reverseLookup()` | Show `david.arc` next to creator addresses |
| **Payment gateway** | REST API `/resolve/:name` | Backend resolves names before processing payments |
| **On-chain protocol** | Contract interface | Accept `.arc` names directly in smart contracts |
| **Profile pages** | REST API `/profile/:name` | Embed user profiles with QR codes |
| **Block explorer** | SDK `reverseLookup()` | Display names instead of raw addresses |

---

## 6. Contract Addresses

| Network | Registry | USDC |
|---|---|---|
| Arc Testnet (5042002) | `0xaDe3b1ae4C5831163Fe8e9727645e2416DD83AD2` | `0x3600000000000000000000000000000000000000` |

---

## 7. Key Constraints

- Names are **3–32 characters**, lowercase alphanumeric only (`a-z`, `0-9`)
- Names ending in `.arc` are automatically normalized (the suffix is stripped internally)
- Registration costs **5 USDC/year** (standard) or **50 USDC/year** (4 chars or fewer)
- Names expire after 1 year and have a 30-day grace period
- Reserved names (`admin`, `arc`, `treasury`, `null`, `void`) cannot be registered
- The SDK caches read results for 60 seconds by default (configurable via `cacheTimeout`)
