"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { Sparkline } from "@/components/ui/Sparkline";

export function SensorTile({
  title,
  icon,
  value,
  unit,
  tone,
  badge,
  series,
  color = "#818cf8",
  min,
  max,
  footer,
  raw,
}: {
  title: string;
  icon: ReactNode;
  value: ReactNode;
  unit?: string;
  tone: Tone;
  badge: string;
  series: number[];
  color?: string;
  min?: number;
  max?: number;
  footer?: ReactNode;
  raw?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
            {icon}
          </span>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        <StatusPill tone={tone} dot pulse={tone === "danger"}>
          {badge}
        </StatusPill>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-white">{value}</span>
            {unit ? <span className="text-sm font-medium text-slate-400">{unit}</span> : null}
          </div>
          {raw ? <p className="mt-0.5 text-[11px] text-slate-500">{raw}</p> : null}
        </div>
        <div className="w-28 shrink-0 opacity-90">
          <Sparkline values={series} min={min} max={max} stroke={color} height={40} />
        </div>
      </div>

      {footer ? <div className="text-[11px] text-slate-500">{footer}</div> : null}
    </Card>
  );
}
