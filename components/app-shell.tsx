'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropsWithChildren } from "react";
import { useSettings } from "./settings-context";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/router", label: "Router" },
  { href: "/providers", label: "Providers" },
  { href: "/health-log", label: "Health Log" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { settings } = useSettings();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500 text-lg font-black text-slate-950">
              N
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Nebuchadnezzar
              </p>
              <p className="text-xs text-slate-400">
                Local Morpheus / Lumerin node dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-slate-300 hover:text-slate-50",
                    active ? "font-semibold text-slate-50" : "",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            <StatusPill tone="info" className="hidden sm:inline-flex">
              {settings.baseUrl || "Set base URL"}
            </StatusPill>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
