import clsx from "clsx";
import type { ReactNode } from "react";

export type Tone = "on" | "off" | "ok" | "warning" | "danger" | "info" | "neutral" | "auto" | "manual";

const TONES: Record<Tone, string> = {
  on: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
  ok: "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30",
  off: "bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/20",
  neutral: "bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/20",
  warning: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/30",
  danger: "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/30",
  info: "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30",
  auto: "bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-400/30",
  manual: "bg-slate-500/15 text-slate-300 ring-1 ring-inset ring-slate-400/20",
};

export function StatusPill({
  tone = "neutral",
  children,
  dot = false,
  pulse = false,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx("chip", TONES[tone], className)}>
      {dot ? (
        <span
          className={clsx(
            "h-1.5 w-1.5 rounded-full",
            tone === "danger" ? "bg-rose-400" : tone === "warning" ? "bg-amber-400" : tone === "off" || tone === "neutral" ? "bg-slate-400" : "bg-emerald-400",
            pulse && "animate-pulse-ring",
          )}
        />
      ) : null}
      {children}
    </span>
  );
}
