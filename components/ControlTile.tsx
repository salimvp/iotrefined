"use client";

import clsx from "clsx";
import { Loader2, Power } from "lucide-react";
import type { ReactNode } from "react";
import type { ControlMode } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { ModeSwitch, Toggle } from "@/components/ui/Toggle";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

export function ControlTile({
  title,
  icon,
  active,
  activeLabel,
  inactiveLabel,
  tone,
  pending,
  mode,
  onToggle,
  onModeChange,
  disabled,
  footer,
}: {
  title: string;
  icon: ReactNode;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  tone: Tone;
  pending?: boolean;
  mode?: ControlMode;
  onToggle?: (next: boolean) => void;
  onModeChange?: (m: ControlMode) => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              "grid h-10 w-10 place-items-center rounded-xl border transition duration-300",
              active
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-white/[0.04] text-slate-400",
            )}
          >
            {icon}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            <p className="text-[11px] text-slate-500">
              {pending ? "syncing with device…" : "actual device state"}
            </p>
          </div>
        </div>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-300" />
        ) : (
          <StatusPill tone={tone} dot pulse={active}>
            {active ? activeLabel : inactiveLabel}
          </StatusPill>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {onToggle ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(!active)}
            className={clsx(
              "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.99]",
              active
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <Power className="h-4 w-4" />
            {active ? activeLabel : inactiveLabel}
          </button>
        ) : (
          <div className="flex-1 text-sm text-slate-300">{footer}</div>
        )}
        {onModeChange && mode ? <ModeSwitch value={mode} onChange={onModeChange} disabled={disabled} /> : null}
      </div>

      {onToggle && footer ? <div className="text-[11px] text-slate-500">{footer}</div> : null}
    </Card>
  );
}
