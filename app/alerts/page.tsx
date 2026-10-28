"use client";

import { useState } from "react";
import { BellOff, Check, CheckCheck, Flame, Info, ShieldAlert } from "lucide-react";
import { useHome } from "@/lib/store";
import { clockTime, relativeTime } from "@/lib/format";
import type { AlertSeverity } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";

const FILTERS = ["unacknowledged", "all", "critical"] as const;

export default function AlertsPage() {
  const { snapshot, ackAlert, ackAllAlerts } = useHome();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("unacknowledged");

  const alerts = snapshot.alerts.filter((a) => {
    if (filter === "unacknowledged") return !a.acknowledged;
    if (filter === "critical") return a.severity === "critical" || a.severity === "important";
    return true;
  });

  const unacked = snapshot.alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-rose-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Unacknowledged</p>
            <p className="text-lg font-bold text-white">{unacked}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-amber-300">
            <Flame className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Critical / Important</p>
            <p className="text-lg font-bold text-white">
              {snapshot.alerts.filter((a) => a.severity === "critical" || a.severity === "important").length}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
            <BellOff className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total stored</p>
            <p className="text-lg font-bold text-white">{snapshot.alerts.length}</p>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-4">
          <div className="inline-flex rounded-xl border border-white/10 bg-ink-900/60 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold capitalize transition ${
                  filter === f ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void ackAllAlerts()} className="btn-ghost ml-auto !py-1.5">
            <CheckCheck className="h-4 w-4" /> Acknowledge all
          </button>
        </div>

        <ul className="divide-y divide-white/5">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-start gap-3 p-4">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  a.severity === "critical"
                    ? "bg-rose-400"
                    : a.severity === "warning" || a.severity === "important"
                      ? "bg-amber-400"
                      : "bg-sky-400"
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-100">{a.message}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {a.alert_type} · {clockTime(a.created_at)} · {relativeTime(a.created_at)} ·{" "}
                  {a.acknowledged ? "acknowledged" : "open"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusPill tone={sevTone(a.severity)}>{a.severity}</StatusPill>
                {!a.acknowledged ? (
                  <button type="button" onClick={() => void ackAlert(a.id)} className="btn-ghost !px-2.5 !py-1.5 text-xs">
                    <Check className="h-3.5 w-3.5" /> Ack
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {alerts.length === 0 ? (
            <li className="p-8 text-center text-sm text-slate-500">Nothing here. All clear 🌤️</li>
          ) : null}
        </ul>
      </Card>

      <Card className="border-white/10">
        <CardHeader
          title="About phone notifications"
          subtitle="Dashboard alerts vs OS/browser push"
          icon={<Info className="h-4 w-4" />}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-emerald-300">✅ Dashboard alerts (works now)</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Every alert is a row in the <code className="rounded bg-black/30 px-1">alerts</code> table. Supabase Realtime
              pushes it to this page instantly, so an open dashboard shows a live warning.
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-amber-300">⚠ Browser push (requires setup)</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Real web push notifications use the service worker in <code className="rounded bg-black/30 px-1">/public/sw.js</code>{" "}
              and the Supabase Edge Function <code className="rounded bg-black/30 px-1">send-push-notification</code>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function sevTone(s: AlertSeverity): Tone {
  if (s === "critical") return "danger";
  if (s === "warning" || s === "important") return "warning";
  return "info";
}
