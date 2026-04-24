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
      <section className="card fade-in" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <h1 style={{ fontSize: "2.25rem", marginBottom: "0.5rem" }}>
          Your identity on <span className="text-accent">Arc</span>
        </h1>
        <p className="text-secondary" style={{ maxWidth: 440, margin: "0 auto 2rem" }}>
          Claim a <strong className="text-accent">.arc</strong> name, link it to your wallet, and share a payment-ready profile with anyone.
        </p>
        <div className="grid grid-2" style={{ maxWidth: 380, margin: "0 auto" }}>
          <Link href="/register">
            <button type="button" className="btn-primary">Register a name</button>
          </Link>
          <Link href="/dashboard">
            <button type="button">My names</button>
          </Link>
        </div>
      </section>

      <div className="grid grid-2 mt-lg fade-in">
        <section className="card">
          <h3 className="mb">How it works</h3>
          <ol style={{ paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }} className="text-secondary text-sm">
            <li>Connect your wallet to Arc Testnet</li>
            <li>Pick a unique <strong>.arc</strong> name</li>
            <li>Pay the fee in USDC and register</li>
            <li>Share your profile or QR code</li>
          </ol>
        </section>

        <section className="card">
          <h3 className="mb">Service status</h3>
          {health ? (
            <div className="msg msg-success">
              <span className="dot dot-green" style={{ marginTop: 6, flexShrink: 0 }} />
              <span>API online &middot; Chain {health.chainId}</span>
            </div>
          ) : (
            <div className="msg msg-warn">
              <span className="dot dot-yellow" style={{ marginTop: 6, flexShrink: 0 }} />
              <span>API unreachable. Start the API server and check your config.</span>
            </div>
          )}
          <p className="text-xs text-secondary mt">
            USDC is the native gas token on Arc. No ETH needed.
          </p>
        </section>
      </div>
    </main>
  );
}
