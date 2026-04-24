type ProfileData = {
  name: string;
  address: string | null;
  expiry: number | null;
  qrUrl: string;
  profileUrl: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";

async function getProfile(name: string): Promise<ProfileData | null> {
  try {
    const res = await fetch(`${API_BASE}/profile/${encodeURIComponent(name)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ProfileData;
  } catch {
    return null;
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const profile = await getProfile(name);
  const displayName = name.endsWith(".arc") ? name : `${name}.arc`;
  const initial = name.replace(/\.arc$/, "").charAt(0).toUpperCase();

  const isAgent = displayName.includes("-agent.");
  const isPayment = displayName.includes("-usdc.");

  if (!profile) {
    return (
      <main className="fade-in">
        <div className="container-narrow">
          <section className="card card-glow text-center" style={{ padding: "3.5rem 1.5rem" }}>
            <div className="profile-avatar" style={{ margin: "0 auto 1rem", opacity: 0.5 }}>?</div>
            <h1 style={{ fontSize: "1.75rem" }}>{displayName}</h1>
            <p className="text-secondary mt-sm">This name hasn&apos;t been registered yet, or the API is unavailable.</p>
            <div style={{ marginTop: "1.5rem" }}>
              <a href="/register">
                <button type="button" className="btn-primary btn-lg" style={{ width: "auto" }}>Claim this name</button>
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="fade-in">
      {/* Profile header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div className="profile-avatar" style={{ margin: "0 auto" }}>{initial}</div>
        <h1 style={{ fontSize: "2.5rem" }}>{profile.name}</h1>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
          {isAgent && <span className="badge badge-agent">Agent</span>}
          {isPayment && <span className="badge badge-usdc">Payment App</span>}
          {!isAgent && !isPayment && <span className="badge badge-network">Identity</span>}
          <span className="pill"><span className="dot dot-blue" /> Arc Testnet</span>
        </div>
      </div>

      <div className="grid grid-2 container-narrow" style={{ margin: "0 auto" }}>
        <section className="card">
          <div className="profile-field">
            <span className="profile-label">Resolved address</span>
            <span className="profile-value font-mono">{profile.address ?? "Not set"}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Expires</span>
            <span className="profile-value">
              {profile.expiry ? new Date(profile.expiry * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Unknown"}
            </span>
          </div>
        </section>

        <section className="card text-center">
          <p className="label">Payment QR</p>
          <div className="qr-wrap">
            <img src={profile.qrUrl} alt={`${profile.name} QR code`} width={200} height={200} style={{ display: "block" }} />
          </div>
          <p className="text-xs text-secondary mt-sm">Scan to pay {profile.name}</p>
        </section>
      </div>
    </main>
  );
}
