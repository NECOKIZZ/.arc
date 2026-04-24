import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider } from "./wallet-context";
import NavLinks from "./nav-links";

export const metadata: Metadata = {
  title: "ARC Name Service",
  description: "Identity layer for Arc Testnet"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <WalletProvider>
          <header className="nav">
            <Link href="/" style={{ textDecoration: "none" }}>
              <div className="nav-brand">
                <span className="text-accent" style={{ fontSize: "2.2em", lineHeight: 1, display: "inline-flex", alignItems: "center", verticalAlign: "middle", marginRight: "-0.05em" }}>.</span>arc
                <span className="badge badge-network"><span className="dot dot-blue" /> Testnet</span>
              </div>
            </Link>
            <NavLinks />
          </header>
          <div className="container">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
