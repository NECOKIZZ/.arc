import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

async function getHealth() {
  try {
    const res = await fetch(`${API_BASE}/healthz`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as { ok: boolean; chainId: number; timestamp: string };
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const health = await getHealth();
  return (
    <main>
      {/* ───── HERO ───── */}
      <section className="hero fade-up">
        <div style={{ display: "flex", justifyContent: "center", gap: "0.6rem", marginBottom: "2rem", position: "relative", zIndex: 1 }}>
          <span className="pill"><span className="dot dot-blue" /> Live on Arc Testnet</span>
          <span className="pill">Gas in USDC</span>
        </div>

        <div className="hero-blob-1" />
        <div className="hero-blob-2" />
        <div className="hero-blob-3" />

        <h1>
          One{" "}
          <span className="rotating-words">
            <span className="rotating-words-inner">
              <span>identity</span>
              <span>name</span>
              <span>wallet</span>
              <span>.arc</span>
            </span>
          </span>
          <br />for the entire Arc Network
        </h1>

        <p className="hero-subtitle">
          Register <strong>.arc</strong> names for humans, AI agents, and payment apps.
          Send USDC to anyone, just by name. All on-chain.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <Link href="/register">
            <button type="button" className="btn-primary btn-lg" style={{ width: "auto", minWidth: 180 }}>
              Claim your .arc
            </button>
          </Link>
          <Link href="/send">
            <button type="button" className="btn-outline btn-lg" style={{ width: "auto", minWidth: 180 }}>
              Send USDC
            </button>
          </Link>
        </div>

        <div className="stat-row" style={{ position: "relative", zIndex: 1 }}>
          <div className="stat-item">
            <div className="stat-num">$5</div>
            <div className="stat-label">per year</div>
          </div>
          <div className="stat-item">
            <div className="stat-num" style={{ color: "var(--text)" }}>~</div>
            <div className="stat-label">instant registration</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">0</div>
            <div className="stat-label">ETH needed</div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ───── WHO IS IT FOR ───── */}
      <section className="fade-up-delay-1">
        <p className="section-header" style={{ textAlign: "center" }}>Built for everyone on Arc</p>
        <div className="grid grid-3">
          <div className="feature-card">
            <h3>Humans</h3>
            <p className="text-sm text-secondary mt-sm">
              Claim <strong>alice.arc</strong> as your on-chain identity. Share it with anyone to receive USDC instantly.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <span className="pill">yourname.arc</span>
            </div>
          </div>

          <div className="feature-card">
            <h3>AI Agents</h3>
            <p className="text-sm text-secondary mt-sm">
              Register via our API with the <code>-agent</code> suffix. Give your bot an identity on Arc.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <span className="badge badge-agent">name-agent.arc</span>
            </div>
          </div>

          <div className="feature-card">
            <h3>Payment Apps</h3>
            <p className="text-sm text-secondary mt-sm">
              Register with <code>-usdc</code> suffix for financial apps. Turn your app into a payment address.
            </p>
            <div style={{ marginTop: "1rem" }}>
              <span className="badge badge-usdc">name-usdc.arc</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ───── HOW IT WORKS + STATUS ───── */}
      <div className="grid grid-2 fade-up-delay-2">
        <div className="card card-glow">
          <h3 className="mb-lg">How it works</h3>
          <div style={{ display: "grid", gap: "1rem" }}>
            {[
              { num: "01", text: "Connect your wallet to Arc Testnet" },
              { num: "02", text: "Choose your name and type (human, agent, or payment)" },
              { num: "03", text: "Pay the fee in USDC and register" },
              { num: "04", text: "Share your profile, QR, or receive payments" },
            ].map((step) => (
              <div key={step.num} style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--accent)", minWidth: 28 }}>{step.num}</span>
                <span className="text-sm">{step.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-lg">Network</h3>
          {health ? (
            <div className="msg msg-success mb">
              <span className="dot dot-blue" style={{ marginTop: 6, flexShrink: 0 }} />
              <span>API online &middot; Chain {health.chainId}</span>
            </div>
          ) : (
            <div className="msg msg-warn mb">
              <span className="dot dot-yellow" style={{ marginTop: 6, flexShrink: 0 }} />
              <span>API unreachable &mdash; start the server</span>
            </div>
          )}
          <p className="text-sm text-secondary">
            USDC is the native gas token. No ETH required for any transaction on Arc.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <span className="pill">5 USDC/yr standard</span>
            <span className="pill">50 USDC/yr short names</span>
            <span className="pill">USDC gas</span>
          </div>
        </div>
      </div>

      <hr className="section-divider" />

      {/* ───── NAMING GUIDE ───── */}
      <section className="fade-up-delay-3" style={{ textAlign: "center" }}>
        <p className="section-header">Naming conventions</p>
        <div className="grid grid-3" style={{ maxWidth: 700, margin: "0 auto" }}>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>alice.arc</p>
            <p className="text-xs text-secondary mt-sm">Personal identity</p>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>bot-agent.arc</p>
            <p className="text-xs text-secondary mt-sm">AI Agent <span className="badge badge-agent">required</span></p>
          </div>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <p style={{ fontWeight: 700, fontSize: "1.1rem", fontFamily: "'SF Mono', 'Fira Code', monospace" }}>pay-usdc.arc</p>
            <p className="text-xs text-secondary mt-sm">Payment App <span className="badge badge-usdc">required</span></p>
          </div>
        </div>
      </section>
    </main>
  );
}
