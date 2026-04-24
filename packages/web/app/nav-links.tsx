"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/register", label: "Register" },
  { href: "/send", label: "Send" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="nav-links">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "nav-active" : ""}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
