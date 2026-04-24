import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { WalletProvider } from "./wallet-context";

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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <WalletProvider>
          <div className="container">
            <header className="nav">
              <div className="nav-brand">
                <span className="text-accent">.</span>arc
                <span className="badge badge-network"><span className="dot dot-green" /> Testnet</span>
              </div>
              <nav className="nav-links">
                <Link href="/">Home</Link>
                <Link href="/register">Register</Link>
                <Link href="/dashboard">Dashboard</Link>
              </nav>
            </header>
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
