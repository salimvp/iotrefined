"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Cpu,
  LayoutDashboard,
  RefreshCw,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  Wifi,
  WifiOff,
  Workflow,
} from "lucide-react";
import { useHome } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/controls", label: "Controls", icon: SlidersHorizontal },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/sensors", label: "Sensors", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { snapshot, mode, refresh } = useHome();
  const unacked = snapshot.alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1500px] gap-0 lg:gap-6 lg:p-6">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col lg:flex">
        <div className="glass flex h-full flex-col p-4">
          <Link href="/" className="mb-6 flex items-center gap-3 px-1">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient shadow-glow">
              <Cpu className="h-5 w-5 text-white" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-white">AuraHome</span>
              <span className="block text-[11px] text-slate-400">Smart Home Console</span>
            </span>
          </Link>

          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href} className={clsx("nav-link", active && "nav-link-active")}>
                  <Icon className="h-4 w-4" />
                  {label}
                  {label === "Alerts" && unacked > 0 ? (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-rose-500/25 px-1.5 text-[10px] font-bold text-rose-200 ring-1 ring-inset ring-rose-400/40">
                      {unacked}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-white/10 bg-ink-900/60 p-3">
            <div className="flex items-center justify-between">
              <span className="label">Device</span>
              <StatusPill tone={snapshot.device.online ? "on" : "off"} dot pulse={snapshot.device.online}>
                {snapshot.device.online ? "online" : "offline"}
              </StatusPill>
            </div>
            <p className="mt-2 truncate text-xs text-slate-300">{snapshot.device.name}</p>
            <p className="truncate text-[11px] text-slate-500">fw {snapshot.device.firmware_version}</p>
            <p className="mt-1 text-[11px] text-slate-500">seen {relativeTime(snapshot.device.last_seen)}</p>
          </div>
        </div>
      </aside>

      {/* ---------------- Main column ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/70 backdrop-blur-xl lg:static lg:rounded-2xl lg:border lg:bg-white/[0.03]">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient lg:hidden">
              <Cpu className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-white">
                {NAV.find((n) => n.href === pathname)?.label ?? "Dashboard"}
              </h1>
              <p className="truncate text-[11px] text-slate-400">
                {snapshot.device.id} · {snapshot.device.ip_address ?? "no IP"}
                {snapshot.device.rssi != null ? ` · ${snapshot.device.rssi} dBm` : ""}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <StatusPill tone={mode === "live" ? "info" : "warning"} className="hidden sm:inline-flex">
                {mode === "live" ? "realtime" : "demo mode"}
              </StatusPill>
              <StatusPill tone={snapshot.device.online ? "on" : "off"} dot pulse={snapshot.device.online}>
                {snapshot.device.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                <span className="hidden sm:inline">{snapshot.device.online ? "online" : "offline"}</span>
              </StatusPill>
              <button type="button" onClick={() => void refresh()} className="btn-ghost !px-2.5" aria-label="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-brand-400/40 bg-brand-500/20 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-400",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {label === "Alerts" && unacked > 0 ? (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-rose-500/30 px-1 text-[10px] text-rose-100">
                      {unacked}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </header>

        {mode === "demo" ? (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-[12px] text-amber-200/90 lg:mx-0">
            <span className="mt-0.5">●</span>
            <p>
              <strong className="font-semibold">Demo mode.</strong> No Supabase credentials found, so a local simulator is
              driving the dashboard. Add <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
              <code className="rounded bg-black/30 px-1">.env.local</code> to switch to live Realtime data.
            </p>
          </div>
        ) : null}

        <main className="min-h-0 flex-1 p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}
