"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon = { width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const NAV = [
  {
    href: "/today",
    name: "Today",
    svg: (
      <svg viewBox="0 0 24 24" {...icon}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/ledger",
    name: "Ledger",
    svg: (
      <svg viewBox="0 0 24 24" {...icon}>
        <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
        <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
      </svg>
    ),
  },
  {
    href: "/setback",
    name: "Setback",
    svg: (
      <svg viewBox="0 0 24 24" {...icon}>
        <path d="M3 13l4-4 4 5 4-7 6 9" />
        <path d="M17 16h4v-4" />
      </svg>
    ),
  },
];

export default function NavRail() {
  const path = usePathname();
  return (
    <>
      {/* Desktop: thin left rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[76px] flex-col items-center border-r border-line bg-[#0d0c11]/90 py-6 backdrop-blur md:flex">
        <Link href="/today" className="mb-9 text-center font-display text-[19px] leading-[0.85] tracking-wide">
          STALL
          <br />
          <span className="text-[15px] text-muted">BREAKER</span>
        </Link>
        <nav className="flex flex-col gap-3">
          {NAV.map((n) => {
            const on = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                title={n.name}
                className={`grid h-11 w-11 place-items-center rounded-xl transition ${
                  on
                    ? "border border-accent/70 bg-accent/15 text-accent-hi shadow-[0_0_18px_rgba(139,92,246,0.35)]"
                    : "text-faint hover:text-muted"
                }`}
              >
                {n.svg}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-[#0d0c11]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((n) => {
          const on = path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                on ? "text-accent-hi" : "text-faint"
              }`}
            >
              {n.svg}
              {n.name}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
