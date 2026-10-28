"use client";

import clsx from "clsx";
import type { ControlMode } from "@/lib/types";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition duration-300",
        checked ? "border-emerald-400/40 bg-emerald-500/25" : "border-white/10 bg-white/[0.06]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={clsx(
          "absolute h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
          checked ? "translate-x-[26px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

export function ModeSwitch({
  value,
  onChange,
  disabled,
}: {
  value: ControlMode;
  onChange: (m: ControlMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-ink-900/60 p-0.5">
      {(["manual", "auto"] as ControlMode[]).map((m) => (
        <button
          key={m}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m)}
          className={clsx(
            "rounded-[10px] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
            value === m ? (m === "auto" ? "bg-violet-500/25 text-violet-200" : "bg-white/10 text-slate-100") : "text-slate-400 hover:text-slate-200",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
