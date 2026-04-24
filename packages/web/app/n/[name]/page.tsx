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

  if (!profile) {
    return (
      <main className="fade-in">
        <section className="card text-center" style={{ padding: "3rem 1.5rem" }}>
          <div className="profile-avatar" style={{ margin: "0 auto 1rem" }}>?</div>
          <h1>{displayName}</h1>
          <p className="text-secondary mt-sm">This name hasn&apos;t been registered yet, or the API is unavailable.</p>
          <div style={{ marginTop: "1.5rem" }}>
            <a href="/register">
              <button type="button" className="btn-primary" style={{ maxWidth: 260 }}>Register this name</button>
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="fade-in">
      <section className="card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
        <div className="profile-avatar" style={{ margin: "0 auto" }}>{initial}</div>
        <h1>{profile.name}</h1>
        <p className="text-secondary text-sm mt-sm">Public profile on Arc Testnet</p>
      </section>

      <div className="grid grid-2 mt">
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
