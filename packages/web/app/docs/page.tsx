"use client";

import { useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "capabilities", label: "Capabilities" },
  { id: "quickstart", label: "Quick Start" },
  { id: "sdk", label: "SDK (@arcnames/sdk)" },
  { id: "react-hooks", label: "React Hooks" },
  { id: "rest-api", label: "REST API" },
  { id: "solidity", label: "Solidity Integration" },
  { id: "frontend", label: "Frontend Patterns" },
  { id: "agents", label: "For AI Agents" },
  { id: "usecases", label: "Use Cases" },
  { id: "naming", label: "Naming Rules" },
  { id: "contracts", label: "Contract Addresses" },
  { id: "errors", label: "Error Reference" },
  { id: "security", label: "Security Model" },
];

function CodeBlock({ code, lang = "typescript" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="docs-code-wrap">
      <button
        className="docs-copy-btn"
        onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="docs-code"><code>{code}</code></pre>
    </div>
  );
}

function Toggle({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="docs-toggle">
      <button className="docs-toggle-trigger" onClick={() => setOpen(!open)}>
        <span style={{ transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>&#9654;</span>
        {title}
      </button>
      {open && <div className="docs-toggle-content">{children}</div>}
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  function scrollTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="docs-layout">
      {/* Sidebar */}
      <aside className="docs-sidebar">
        <div className="docs-sidebar-title">Documentation</div>
        <nav className="docs-sidebar-nav">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`docs-sidebar-link ${activeSection === s.id ? "active" : ""}`}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="docs-main">
        {/* ═══════ OVERVIEW ═══════ */}
        <section id="overview" className="docs-section">
          <h1 style={{ fontSize: "2.5rem" }}>ARC Name Service</h1>
          <p className="docs-lead">
            Human-readable <strong>.arc</strong> names for wallets, AI agents, and payment apps on the Arc Network.
          </p>
          <div className="docs-grid-3 mt-lg">
            <div className="docs-info-card">
              <h3>Identity Layer</h3>
              <p>Replace <code>0x858f...5f4E</code> with <code>david.arc</code>. One name for payments, profiles, and discovery.</p>
            </div>
            <div className="docs-info-card">
              <h3>USDC Native</h3>
              <p>All fees paid in USDC. Gas is USDC on Arc. No ETH, no bridging, no wrapped tokens.</p>
            </div>
            <div className="docs-info-card">
              <h3>Agent Ready</h3>
              <p>AI agents register <code>bot-agent.arc</code> names, discover services, and pay each other autonomously.</p>
            </div>
          </div>
          <table className="docs-table mt-lg">
            <thead><tr><th>Property</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Network</td><td>Arc Testnet (Chain ID: 5042002)</td></tr>
              <tr><td>Name format</td><td>3–32 chars, lowercase a-z, 0-9, hyphens</td></tr>
              <tr><td>Registration fee</td><td>5 USDC/year (standard), 50 USDC/year (≤4 chars)</td></tr>
              <tr><td>Grace period</td><td>30 days after expiry</td></tr>
              <tr><td>Gas token</td><td>USDC</td></tr>
            </tbody>
          </table>
        </section>

        {/* ═══════ CAPABILITIES ═══════ */}
        <section id="capabilities" className="docs-section">
          <h2>Capabilities</h2>
          <div className="docs-grid-2">
            {[
              { title: "Name Registration", desc: "Claim a .arc name linked to your wallet. Auto-detects commit-reveal mode for front-running protection." },
              { title: "Forward Resolution", desc: "Convert .arc names to wallet addresses. david.arc → 0x858f..." },
              { title: "Reverse Resolution", desc: "Convert wallet addresses back to .arc names. Show names in navbars, profiles, and tx logs." },
              { title: "Name Management", desc: "Renew, transfer, update resolved address, set primary name, or release." },
              { title: "Payment QR Codes", desc: "Generate scannable QR codes linked to .arc profiles for instant payment." },
              { title: "Commit-Reveal Protection", desc: "Two-step registration prevents mempool front-running of name claims." },
              { title: "Name Types", desc: "Human identities (alice.arc), AI agents (bot-agent.arc), and payment apps (pay-usdc.arc)." },
              { title: "Batch Resolution", desc: "Resolve many names in a single multicall for CSV payouts and batch operations." },
            ].map((c) => (
              <div key={c.title} className="docs-cap-card">
                <h4>{c.title}</h4>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ QUICK START ═══════ */}
        <section id="quickstart" className="docs-section">
          <h2>Quick Start — 5 Minutes</h2>
          <h3>Install</h3>
          <CodeBlock lang="bash" code={`npm install @arcnames/sdk
# For React hooks:
npm install @arcnames/sdk-react`} />

          <h3 className="mt-lg">Pattern A: Resolve before sending USDC</h3>
          <p>The most common use case — convert a .arc name to an address before sending a transaction.</p>
          <CodeBlock code={`import { ARCNames } from "@arcnames/sdk";

const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
});

const address = await ans.resolve("david");
if (!address) throw new Error("Name not found");
await sendUSDC(address, amount);`} />

          <h3 className="mt-lg">Pattern B: Show .arc name in your navbar (React)</h3>
          <CodeBlock code={`import { useANSReverse } from "@arcnames/sdk-react";

function Navbar({ walletAddress }) {
  const { arcName, isLoading } = useANSReverse(walletAddress, {
    rpcUrl: "https://rpc.testnet.arc.network",
    registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
  });

  return (
    <span>
      {isLoading ? "..." : arcName ?? \`\${walletAddress.slice(0, 6)}...\${walletAddress.slice(-4)}\`}
    </span>
  );
}`} />

          <h3 className="mt-lg">Pattern C: Address input with live resolution</h3>
          <CodeBlock code={`import { useANSResolve } from "@arcnames/sdk-react";

function RecipientInput({ onResolved }) {
  const [input, setInput] = useState("");
  const { address, arcName, isResolving, reason } = useANSResolve(input, {
    rpcUrl: "https://rpc.testnet.arc.network",
    registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
    debounceMs: 400,
  });

  if (address) onResolved(address);

  return (
    <div>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="0x... or name.arc" />
      {isResolving && <span>Resolving...</span>}
      {arcName && address && <span>{arcName} → {address.slice(0, 10)}...</span>}
      {reason === "not_registered" && <span>Name not found</span>}
    </div>
  );
}`} />

          <h3 className="mt-lg">Pattern D: Batch resolve for CSV payouts</h3>
          <CodeBlock code={`const recipients = ["alice", "bob", "charlie", "david"];
const results = await ans.resolveMany(recipients);
// [{ name: "alice.arc", address: "0x..." }, { name: "bob.arc", address: null }, ...]

const valid = results.filter((r) => r.address !== null);
const failed = results.filter((r) => r.address === null);`} />
        </section>

        {/* ═══════ SDK ═══════ */}
        <section id="sdk" className="docs-section">
          <h2>TypeScript SDK — <code>@arcnames/sdk</code></h2>
          <p>The official SDK for JavaScript/TypeScript. Works in Node.js, browsers, and serverless functions.</p>

          <h3 className="mt-lg">Setup</h3>
          <CodeBlock code={`import { ARCNames, normalizeName } from "@arcnames/sdk";

// Read-only (no signer needed)
const ans = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
  cacheTimeout: 60000, // optional, default 60s
});

// Read + Write (requires ethers.js signer)
import { BrowserProvider } from "ethers";
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

const ansWrite = new ARCNames({
  rpcUrl: "https://rpc.testnet.arc.network",
  registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
  signer,
});`} />

          <h3 className="mt-lg">Read Methods</h3>
          <table className="docs-table">
            <thead><tr><th>Method</th><th>Returns</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>resolve(name)</code></td><td><code>string | null</code></td><td>Forward lookup: name → address</td></tr>
              <tr><td><code>resolveWithReason(name)</code></td><td><code>{`{address, reason}`}</code></td><td>Resolve with failure reason</td></tr>
              <tr><td><code>reverseLookup(address)</code></td><td><code>string | null</code></td><td>Reverse lookup: address → name.arc</td></tr>
              <tr><td><code>isAvailable(name)</code></td><td><code>boolean</code></td><td>Check if name can be registered</td></tr>
              <tr><td><code>getNameInfo(name)</code></td><td><code>NameInfo</code></td><td>Full record: owner, expiry, status</td></tr>
              <tr><td><code>quotePrice(name, years?)</code></td><td><code>bigint</code></td><td>Fee in USDC (6 decimals)</td></tr>
              <tr><td><code>resolveMany(names[])</code></td><td><code>Array</code></td><td>Batch resolve via multicall</td></tr>
              <tr><td><code>getQRCodeDataUrl(name)</code></td><td><code>string</code></td><td>QR code as data URL</td></tr>
            </tbody>
          </table>

          <h3 className="mt-lg">Write Methods</h3>
          <p>All write methods require a signer and return the transaction hash.</p>
          <table className="docs-table">
            <thead><tr><th>Method</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td><code>register(name, address?)</code></td><td>Register a name. Auto-detects commit-reveal mode.</td></tr>
              <tr><td><code>renew(name)</code></td><td>Extend registration by 1 year</td></tr>
              <tr><td><code>transferName(name, newOwner)</code></td><td>Transfer ownership</td></tr>
              <tr><td><code>updateResolvedAddress(name, addr)</code></td><td>Change where the name points</td></tr>
              <tr><td><code>setPrimaryName(name)</code></td><td>Set as reverse-lookup identity</td></tr>
              <tr><td><code>releaseName(name)</code></td><td>Permanently give up a name</td></tr>
            </tbody>
          </table>

          <Toggle title="Exported Constants (@arcnames/sdk/constants)">
            <p>For advanced integrations with viem or ethers directly:</p>
            <CodeBlock code={`import { ANS_REGISTRY_ABI, ANS_REGISTRY_ADDRESSES, ANS_USDC_ADDRESSES } from "@arcnames/sdk/constants";

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
const resolved = await registry.resolve("david");`} />
          </Toggle>

          <Toggle title="Caching Behavior">
            <ul>
              <li>All read methods cache results in-memory</li>
              <li>Default TTL: 60 seconds (configurable via <code>cacheTimeout</code>)</li>
              <li>Write methods automatically evict related cache entries</li>
              <li>Cache is per-instance (not shared across instances)</li>
            </ul>
          </Toggle>

          <Toggle title="Commit-Reveal Auto-Detection">
            <p>The SDK automatically handles commit-reveal registration:</p>
            <ol>
              <li>Checks <code>commitRevealRequired()</code> on first write</li>
              <li>If enabled: generates random salt → submits commitment → waits → registers</li>
              <li>If disabled: calls <code>register()</code> directly</li>
              <li>Result is cached for the lifetime of the instance</li>
            </ol>
          </Toggle>
        </section>

        {/* ═══════ REACT HOOKS ═══════ */}
        <section id="react-hooks" className="docs-section">
          <h2>React Hooks — <code>@arcnames/sdk-react</code></h2>
          <p>Drop-in hooks for React/Next.js apps. Built-in debounce, caching, cleanup on unmount.</p>

          <h3 className="mt-lg">ANSProvider (recommended)</h3>
          <p>Wrap your app once, and all hooks share the same SDK instance and cache:</p>
          <CodeBlock code={`import { ANSProvider } from "@arcnames/sdk-react";

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

// Then in any child — no config needed:
const { address } = useANSResolve(input);
const { arcName } = useANSReverse(walletAddress);
const { available } = useANSAvailability(nameInput);`} />

          <h3 className="mt-lg">Available Hooks</h3>
          <table className="docs-table">
            <thead><tr><th>Hook</th><th>Use Case</th><th>Returns</th></tr></thead>
            <tbody>
              <tr><td><code>useANSResolve(input)</code></td><td>Live name → address in forms</td><td><code>{`{address, arcName, isResolving, reason}`}</code></td></tr>
              <tr><td><code>useANSReverse(address)</code></td><td>Display name in navbars/profiles</td><td><code>{`{arcName, isLoading}`}</code></td></tr>
              <tr><td><code>useANSAvailability(name)</code></td><td>Registration availability check</td><td><code>{`{available, isChecking}`}</code></td></tr>
            </tbody>
          </table>

          <Toggle title="Hook Options">
            <CodeBlock code={`useANSResolve(input, {
  debounceMs: 400,     // Wait before resolving (default: 300)
  cacheMs: 60000,      // Cache TTL (default: 60s)
  rpcUrl: "...",        // Override (not needed with ANSProvider)
  registryAddress: "...",
});`} />
          </Toggle>
        </section>

        {/* ═══════ REST API ═══════ */}
        <section id="rest-api" className="docs-section">
          <h2>REST API</h2>
          <p>Use the REST API for backend integrations, mobile apps, Python/Go services, or quick prototyping.</p>

          <div className="docs-endpoint">
            <div className="docs-endpoint-method">GET</div>
            <code>/resolve/:name</code>
            <p>Resolve a name to its address and full record.</p>
            <CodeBlock lang="bash" code={`curl http://localhost:8787/resolve/david
# {"name":"david.arc","address":"0x858f...","owner":"0x858f...","expiry":1745441232,"resolved":true}`} />
          </div>

          <div className="docs-endpoint">
            <div className="docs-endpoint-method">GET</div>
            <code>/reverse/:address</code>
            <p>Reverse lookup an address to its primary .arc name.</p>
            <CodeBlock lang="bash" code={`curl http://localhost:8787/reverse/0x858f3232E7d6702F20c4D3FEAB987A405D225f4E
# {"address":"0x858f...","name":"david.arc","resolved":true}`} />
          </div>

          <div className="docs-endpoint">
            <div className="docs-endpoint-method">GET</div>
            <code>/available/:name</code>
            <p>Check if a name is available for registration.</p>
            <CodeBlock lang="bash" code={`curl http://localhost:8787/available/myname
# {"name":"myname.arc","available":true}`} />
          </div>

          <div className="docs-endpoint">
            <div className="docs-endpoint-method">GET</div>
            <code>/profile/:name</code>
            <p>Full profile with QR code URL.</p>
            <CodeBlock lang="bash" code={`curl http://localhost:8787/profile/david
# {"name":"david.arc","address":"0x858f...","expiry":1745441232,"qrUrl":"...","profileUrl":"..."}`} />
          </div>

          <div className="docs-endpoint">
            <div className="docs-endpoint-method">GET</div>
            <code>/qr/:name</code>
            <p>QR code PNG image. Params: <code>size</code> (100–1000), <code>format</code> (png|svg).</p>
          </div>

          <div className="docs-endpoint">
            <div className="docs-endpoint-method">GET</div>
            <code>/healthz</code>
            <p>Health check. Returns API status and chain info.</p>
            <CodeBlock lang="bash" code={`curl http://localhost:8787/healthz
# {"ok":true,"network":"arcTestnet","chainId":5042002,"timestamp":"..."}`} />
          </div>

          <Toggle title="Python Example">
            <CodeBlock lang="python" code={`import requests

r = requests.get("http://localhost:8787/resolve/david")
address = r.json()["address"]
print(f"david.arc → {address}")`} />
          </Toggle>

          <Toggle title="Rate Limiting & Caching">
            <ul>
              <li><strong>100 requests per minute</strong> per IP</li>
              <li>LRU cache: 5000 entries, 30-second TTL</li>
              <li>SDK internal cache adds another 60-second layer</li>
              <li>Standard rate-limit headers included in responses</li>
            </ul>
          </Toggle>
        </section>

        {/* ═══════ SOLIDITY ═══════ */}
        <section id="solidity" className="docs-section">
          <h2>Solidity Integration</h2>
          <p>Call the ANS registry directly from your smart contracts.</p>

          <h3 className="mt-lg">Interface</h3>
          <CodeBlock lang="solidity" code={`interface IANSRegistry {
    function resolve(string calldata rawLabel) external view returns (address);
    function getRecord(string calldata rawLabel) external view returns (
        address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved
    );
    function isAvailable(string calldata rawLabel) external view returns (bool);
    function reverseLookup(address wallet) external view returns (string memory);
}`} />

          <h3 className="mt-lg">Example: Accept .arc names in a payment contract</h3>
          <CodeBlock lang="solidity" code={`contract PaymentRouter {
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
}`} />

          <Toggle title="All Contract Functions">
            <h4>Registration</h4>
            <table className="docs-table">
              <thead><tr><th>Function</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>register(rawLabel, resolvedAddress)</code></td><td>Direct registration (when commit-reveal disabled)</td></tr>
                <tr><td><code>submitCommitment(commitment)</code></td><td>Submit commitment hash</td></tr>
                <tr><td><code>registerWithCommit(rawLabel, resolvedAddress, salt)</code></td><td>Register using prior commitment</td></tr>
                <tr><td><code>computeCommitment(registrant, rawLabel, salt)</code></td><td>Compute commitment off-chain</td></tr>
              </tbody>
            </table>

            <h4 className="mt-lg">Resolution</h4>
            <table className="docs-table">
              <thead><tr><th>Function</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>resolve(rawLabel)</code></td><td>Returns resolved address or address(0)</td></tr>
                <tr><td><code>reverseResolve(wallet)</code></td><td>Returns primary name with .arc suffix</td></tr>
                <tr><td><code>getRecord(rawLabel)</code></td><td>Full record (owner, address, expiry, status)</td></tr>
                <tr><td><code>isAvailable(rawLabel)</code></td><td>True if name can be registered</td></tr>
                <tr><td><code>getOwnedLabels(wallet)</code></td><td>Array of owned name strings</td></tr>
                <tr><td><code>quotePrice(rawLabel, yearsCount)</code></td><td>Fee in USDC (6 decimals)</td></tr>
              </tbody>
            </table>

            <h4 className="mt-lg">Management</h4>
            <table className="docs-table">
              <thead><tr><th>Function</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td><code>renew(rawLabel)</code></td><td>Extend by 1 year (requires USDC)</td></tr>
                <tr><td><code>release(rawLabel)</code></td><td>Permanently give up a name</td></tr>
                <tr><td><code>updateResolvedAddress(rawLabel, newAddress)</code></td><td>Change target address</td></tr>
                <tr><td><code>transferName(rawLabel, newOwner)</code></td><td>Transfer ownership</td></tr>
                <tr><td><code>setPrimaryName(rawLabel)</code></td><td>Set as reverse-lookup identity</td></tr>
              </tbody>
            </table>
          </Toggle>
        </section>

        {/* ═══════ FRONTEND PATTERNS ═══════ */}
        <section id="frontend" className="docs-section">
          <h2>Frontend Widget Pattern</h2>
          <p>Add .arc name resolution to any address input field in your dApp:</p>
          <CodeBlock code={`import { ARCNames } from "@arcnames/sdk";
import { useState, useMemo } from "react";

function AddressInput({ onResolved }) {
  const [input, setInput] = useState("");
  const [resolved, setResolved] = useState(null);

  const ans = useMemo(() => new ARCNames({
    rpcUrl: "https://rpc.testnet.arc.network",
    registryAddress: "0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db",
  }), []);

  async function handleChange(value) {
    setInput(value);
    if (value.endsWith(".arc") || (!value.startsWith("0x") && value.length >= 3)) {
      try {
        const addr = await ans.resolve(value.replace(/\\.arc$/, ""));
        setResolved(addr);
        if (addr) onResolved(addr);
      } catch { setResolved(null); }
    } else if (value.startsWith("0x")) {
      setResolved(value);
      onResolved(value);
    }
  }

  return (
    <div>
      <input value={input} onChange={(e) => handleChange(e.target.value)} placeholder="0x... or name.arc" />
      {resolved && <small>Resolved: {resolved}</small>}
    </div>
  );
}`} />
        </section>

        {/* ═══════ AGENTS ═══════ */}
        <section id="agents" className="docs-section">
          <h2>For AI Agents</h2>
          <p className="docs-lead">
            AI agents need semantic identity to transact autonomously. .arc names solve this — an agent understands <code>alice.arc</code> the same way it understands <code>alice@email.com</code>.
          </p>

          <div className="docs-grid-2 mt-lg">
            <div className="docs-info-card">
              <h4>Agent Identity Layer</h4>
              <p>Every agent gets a .arc name as its onchain identity: <code>payroll-agent.arc</code>, <code>rebalancer-agent.arc</code>. Agents register names, publish capabilities, and discover each other by name.</p>
            </div>
            <div className="docs-info-card">
              <h4>Agent-to-Agent Payments</h4>
              <CodeBlock code={`// Without ANS — brittle, opaque
agent.send("0x858f3232...", "100 USDC")

// With ANS — semantic, auditable
agent.send("supplier-agent.arc", "100 USDC")`} />
            </div>
          </div>

          <h3 className="mt-lg">Why Agents Need .arc Names</h3>
          <table className="docs-table">
            <thead><tr><th>Problem Without ANS</th><th>Solution With ANS</th></tr></thead>
            <tbody>
              <tr><td>Agents pass around opaque 0x... addresses</td><td>Agents reference <code>alice.arc</code> — semantic and verifiable</td></tr>
              <tr><td>Transaction logs are unreadable</td><td>Logs show <code>paid supplier.arc 500 USDC</code> — auditable</td></tr>
              <tr><td>Agent config requires hardcoded addresses</td><td>Agents discover each other by .arc name</td></tr>
              <tr><td>LLMs can hallucinate hex addresses</td><td>.arc names are short, validatable strings</td></tr>
              <tr><td>No agent identity standard</td><td>.arc names become the agent identity layer</td></tr>
            </tbody>
          </table>

          <h3 className="mt-lg">The Killer Demo: Natural Language → Onchain Action</h3>
          <div className="docs-info-card" style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
            <CodeBlock code={`User: "Pay the design team 500 USDC each"

Agent:
  → Looks up "design-team.arc"
  → Resolves alice.arc, bob.arc, charlie.arc
  → Executes 3 USDC transfers on Arc
  → Reports: "Paid 1500 USDC to 3 members of design-team.arc"`} />
          </div>

          <Toggle title="Hackathon Project Ideas">
            <div className="docs-grid-2">
              <div className="docs-cap-card">
                <h4>Agent Payment Protocol</h4>
                <p>Agents register .arc names with capability metadata. Other agents discover services and pay for them automatically.</p>
              </div>
              <div className="docs-cap-card">
                <h4>Agentic Payroll / Treasury</h4>
                <p>Multi-agent system: <code>cfo-agent.arc</code> approves, <code>payroll-agent.arc</code> executes, <code>auditor-agent.arc</code> monitors.</p>
              </div>
              <div className="docs-cap-card">
                <h4>Agent Registry with Reputation</h4>
                <p>ANS + metadata = decentralized agent marketplace. Reputation scores tied to .arc names.</p>
              </div>
              <div className="docs-cap-card">
                <h4>Conversational Wallet</h4>
                <p>Chat-based wallet where everything is .arc-native. &quot;Send 50 USDC to david.arc&quot; — no addresses shown.</p>
              </div>
            </div>
          </Toggle>

          <Toggle title="Future Agent Extensions">
            <table className="docs-table">
              <thead><tr><th>Extension</th><th>What It Does</th></tr></thead>
              <tbody>
                <tr><td>Metadata records</td><td>Store JSON capabilities, pricing, API endpoints alongside .arc names</td></tr>
                <tr><td>Group names</td><td><code>design-team.arc</code> resolves to multiple addresses</td></tr>
                <tr><td>Permissioned resolution</td><td>Only authorized agents can resolve certain names</td></tr>
                <tr><td>Event subscriptions</td><td>Watch for new registrations matching a pattern</td></tr>
                <tr><td>Text records (ENS-style)</td><td>avatar, url, description, agent-api-endpoint</td></tr>
                <tr><td>Delegation</td><td><code>treasury.arc</code> delegates spending to <code>payroll-agent.arc</code></td></tr>
              </tbody>
            </table>
          </Toggle>
        </section>

        {/* ═══════ USE CASES ═══════ */}
        <section id="usecases" className="docs-section">
          <h2>Use Cases</h2>
          <table className="docs-table">
            <thead><tr><th>Use Case</th><th>Integration Method</th><th>Example</th></tr></thead>
            <tbody>
              <tr><td><strong>Wallet / DEX</strong></td><td>SDK <code>resolve()</code></td><td>Send tokens to <code>alice.arc</code> instead of <code>0x...</code></td></tr>
              <tr><td><strong>NFT Marketplace</strong></td><td>SDK <code>reverseLookup()</code></td><td>Show <code>david.arc</code> next to creator addresses</td></tr>
              <tr><td><strong>Payment Gateway</strong></td><td>REST API <code>/resolve/:name</code></td><td>Backend resolves names before processing payments</td></tr>
              <tr><td><strong>On-chain Protocol</strong></td><td>Solidity interface</td><td>Accept .arc names directly in smart contracts</td></tr>
              <tr><td><strong>Profile Pages</strong></td><td>REST API <code>/profile/:name</code></td><td>Embed user profiles with QR codes</td></tr>
              <tr><td><strong>Block Explorer</strong></td><td>SDK <code>reverseLookup()</code></td><td>Display names instead of raw addresses</td></tr>
              <tr><td><strong>AI Agent</strong></td><td>SDK resolve + register</td><td>Agents discover and pay each other by name</td></tr>
              <tr><td><strong>CSV Batch Payouts</strong></td><td>SDK <code>resolveMany()</code></td><td>Resolve hundreds of names in one multicall</td></tr>
            </tbody>
          </table>
        </section>

        {/* ═══════ NAMING RULES ═══════ */}
        <section id="naming" className="docs-section">
          <h2>Naming Rules</h2>
          <div className="docs-grid-3">
            <div className="docs-info-card">
              <h4>Human</h4>
              <p><code>alice.arc</code></p>
              <p>Personal identity. No suffix required.</p>
            </div>
            <div className="docs-info-card">
              <h4>AI Agent</h4>
              <p><code>bot-agent.arc</code></p>
              <p>Must end with <code>-agent</code> suffix.</p>
            </div>
            <div className="docs-info-card">
              <h4>Payment App</h4>
              <p><code>pay-usdc.arc</code></p>
              <p>Must end with <code>-usdc</code> suffix.</p>
            </div>
          </div>
          <table className="docs-table mt-lg">
            <thead><tr><th>Rule</th><th>Detail</th></tr></thead>
            <tbody>
              <tr><td>Length</td><td>3–32 characters</td></tr>
              <tr><td>Characters</td><td>Lowercase <code>a-z</code>, digits <code>0-9</code>, hyphens <code>-</code></td></tr>
              <tr><td>No leading/trailing hyphens</td><td><code>-name.arc</code> is invalid</td></tr>
              <tr><td>Auto-normalization</td><td>Uppercase converted, <code>.arc</code> suffix stripped</td></tr>
              <tr><td>Reserved names</td><td><code>admin</code>, <code>arc</code>, <code>treasury</code>, <code>null</code>, <code>void</code></td></tr>
              <tr><td>Pricing</td><td>5 USDC/year (standard), 50 USDC/year (≤4 chars)</td></tr>
            </tbody>
          </table>
        </section>

        {/* ═══════ CONTRACT ADDRESSES ═══════ */}
        <section id="contracts" className="docs-section">
          <h2>Contract Addresses</h2>
          <h3>Arc Testnet (Chain ID: 5042002)</h3>
          <table className="docs-table">
            <thead><tr><th>Contract</th><th>Address</th></tr></thead>
            <tbody>
              <tr><td><strong>ARCNameRegistry</strong></td><td><code>0xf5e0E328119D16c75Fb4a001282a3a7b733EF6db</code></td></tr>
              <tr><td><strong>USDC Token</strong></td><td><code>0x3600000000000000000000000000000000000000</code></td></tr>
            </tbody>
          </table>
          <h3 className="mt-lg">Network Details</h3>
          <table className="docs-table">
            <thead><tr><th>Property</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Chain ID</td><td>5042002</td></tr>
              <tr><td>RPC URL</td><td><code>https://rpc.testnet.arc.network</code></td></tr>
              <tr><td>Block Explorer</td><td><code>https://testnet.arcscan.app</code></td></tr>
              <tr><td>Gas Token</td><td>USDC</td></tr>
            </tbody>
          </table>
        </section>

        {/* ═══════ ERROR REFERENCE ═══════ */}
        <section id="errors" className="docs-section">
          <h2>Error Reference</h2>
          <h3>Contract Errors</h3>
          <table className="docs-table">
            <thead><tr><th>Error</th><th>Cause</th><th>Resolution</th></tr></thead>
            <tbody>
              <tr><td><code>InvalidLabel()</code></td><td>Name too short/long or invalid chars</td><td>Use 3-32 chars, a-z, 0-9, hyphens</td></tr>
              <tr><td><code>NameNotAvailable()</code></td><td>Name registered, not past grace</td><td>Wait for expiry + 30 days</td></tr>
              <tr><td><code>NotLabelOwner()</code></td><td>Caller doesn&apos;t own the name</td><td>Connect correct wallet</td></tr>
              <tr><td><code>NameExpired()</code></td><td>Past expiry + grace period</td><td>Re-register instead of renew</td></tr>
              <tr><td><code>NameIsReserved()</code></td><td>Name is reserved</td><td>Choose a different name</td></tr>
              <tr><td><code>CommitmentMissing()</code></td><td>No prior commitment</td><td>Call submitCommitment first</td></tr>
              <tr><td><code>CommitmentExpired()</code></td><td>Commitment older than 1 day</td><td>Submit a new commitment</td></tr>
            </tbody>
          </table>

          <h3 className="mt-lg">Frontend Errors</h3>
          <table className="docs-table">
            <thead><tr><th>Symptom</th><th>Cause</th><th>Fix</th></tr></thead>
            <tbody>
              <tr><td>&quot;No wallet found&quot;</td><td>No MetaMask installed</td><td>Install MetaMask extension</td></tr>
              <tr><td>&quot;Wrong network&quot; badge</td><td>Not on Arc Testnet</td><td>Click &quot;Switch to Arc&quot;</td></tr>
              <tr><td>&quot;You need X USDC&quot;</td><td>Insufficient balance</td><td>Get testnet USDC from Circle faucet</td></tr>
              <tr><td>&quot;Transaction rejected&quot;</td><td>User clicked Reject</td><td>Try again, approve in wallet</td></tr>
              <tr><td>&quot;Network error&quot;</td><td>RPC/internet issue</td><td>Check connection, retry</td></tr>
            </tbody>
          </table>
        </section>

        {/* ═══════ SECURITY ═══════ */}
        <section id="security" className="docs-section">
          <h2>Security Model</h2>
          <div className="docs-grid-2">
            <div className="docs-cap-card">
              <h4>On-Chain Protections</h4>
              <ul>
                <li>ReentrancyGuard on all payment functions</li>
                <li>SafeERC20 for all token transfers</li>
                <li>Ownable2Step for ownership transfers</li>
                <li>Pausable emergency circuit breaker</li>
                <li>Commit-reveal prevents front-running</li>
                <li>Input normalization prevents duplicates</li>
              </ul>
            </div>
            <div className="docs-cap-card">
              <h4>Off-Chain Security</h4>
              <ul>
                <li>No private keys in frontend code</li>
                <li>API is read-only — cannot modify state</li>
                <li>Rate limiting: 100 req/min per IP</li>
                <li>NEXT_PUBLIC_ prefix for safe env vars</li>
                <li>Wallet events properly cleaned on unmount</li>
                <li>encodeURIComponent on all user input</li>
              </ul>
            </div>
          </div>
          <table className="docs-table mt-lg">
            <thead><tr><th>Entity</th><th>Trust Level</th><th>Powers</th></tr></thead>
            <tbody>
              <tr><td>Contract Owner</td><td>Fully trusted</td><td>Pause, set fees, reserve names, toggle commit-reveal</td></tr>
              <tr><td>Users</td><td>Untrusted</td><td>Only manage own names, must pay fees</td></tr>
              <tr><td>API Server</td><td>Read-only</td><td>Cannot modify on-chain state</td></tr>
              <tr><td>Frontend</td><td>Untrusted client</td><td>All writes require wallet signature</td></tr>
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
