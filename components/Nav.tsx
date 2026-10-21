"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Today" },
  { href: "/inbox", label: "Research Inbox" },
  { href: "/discover", label: "Discover" },
  { href: "/products", label: "Products" },
  { href: "/content", label: "Content Studio" },
  { href: "/collages", label: "Collages" },
  { href: "/images", label: "Product Images" },
  { href: "/approvals", label: "Approval Queue" },
  { href: "/calendar", label: "Calendar" },
  { href: "/storefronts", label: "Storefronts" },
  { href: "/analytics", label: "Analytics" },
  { href: "/experiments", label: "Experiments" },
  { href: "/automations", label: "Automations" },
  { href: "/integrations", label: "Integrations" },
  { href: "/compliance", label: "Compliance" },
  { href: "/settings", label: "Settings" }
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {NAV_ITEMS.map((i) => {
        const active = i.href === "/" ? path === "/" : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
