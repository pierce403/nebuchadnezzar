import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "warn" | "danger" | "muted" | "info";

const toneStyles: Record<Tone, string> = {
  success: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  warn: "bg-amber-500/15 text-amber-100 border-amber-500/40",
  danger: "bg-rose-500/15 text-rose-100 border-rose-500/40",
  muted: "bg-slate-500/10 text-slate-200 border-slate-500/20",
  info: "bg-sky-500/15 text-sky-100 border-sky-500/40",
};

export function StatusPill({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
        toneStyles[tone],
        className,
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current/70" />
      {children}
    </span>
  );
}
