"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Bot,
  Cpu,
  Flame,
  Home,
  LayoutDashboard,
  Menu,
  Moon,
  Power,
  Radio,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Sun,
  Thermometer,
  Wrench,
  Zap,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useHome } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/controls", label: "Devices & Control", icon: Power },
  { href: "/sensors", label: "Sensors & Telemetry", icon: Thermometer },
  { href: "/automations", label: "Automations", icon: Sliders },
  { href: "/alerts", label: "Security & Alerts", icon: ShieldAlert },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/diagnostics", label: "Diagnostics", icon: Activity },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { snapshot, mode } = useHome();
  const { device, alerts, sensors, state } = snapshot;
  const unackedAlerts = alerts.filter((a) => !a.acknowledged);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [currentHomeMode, setCurrentHomeMode] = React.useState<"HOME" | "AWAY" | "SLEEP" | "EMERGENCY">("HOME");

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased selection:bg-brand-500/30 selection:text-brand-200">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 flex-col border-r border-border/40 bg-card/60 backdrop-blur-xl shrink-0 sticky top-0 h-screen overflow-y-auto">
          {/* Logo / Brand */}
          <div className="p-5 flex items-center justify-between gap-3 border-b border-border/30">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-aqua-400 p-[1px] shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition">
                <div className="h-full w-full rounded-[11px] bg-background flex items-center justify-center">
                  <Zap className="h-5 w-5 text-brand-400 group-hover:scale-110 transition" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                  AIoT AuraHome
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    Pro
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">ESP32 Core · Real-time</span>
              </div>
            </Link>
          </div>

          {/* Quick Hardware Status Indicator */}
          <div className="p-3 mx-3 my-3 rounded-xl border border-border/40 bg-muted/30">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                ESP32 Controller
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                  device.online
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    device.online ? "bg-emerald-400 animate-pulse" : "bg-rose-400",
                  )}
                />
                {device.online ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>Mode: {mode === "live" ? "Supabase Live" : "Demo Sim"}</span>
              <span className="text-[10px] text-brand-400">FW v{device.firmware_version}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 space-y-1 py-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group",
                    active
                      ? "bg-brand-500/15 text-brand-300 border border-brand-500/30 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-transform group-hover:scale-110",
                        active ? "text-brand-400" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.href === "/alerts" && unackedAlerts.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                      {unackedAlerts.length}
                    </span>
                  )}
                  {item.href === "/controls" && (
                    <span className="text-[10px] font-mono text-muted-foreground group-hover:text-brand-300">
                      {[state.light ? "L" : "", state.fan ? "F" : "", state.door === "open" ? "D" : ""].filter(Boolean).join("·") || "idle"}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <Separator className="my-2 opacity-50" />

          {/* Safety Status Pill in Sidebar */}
          <div className="p-3 mx-3 mb-4 rounded-xl border border-border/40 bg-card/40 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                Safety Status
              </span>
              {sensors.flame.detected || sensors.gas.level === "danger" ? (
                <span className="text-[10px] text-rose-400 font-bold uppercase animate-pulse">CRITICAL</span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-bold uppercase">SECURE</span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Gas / Smoke</span>
                <span className={sensors.gas.level === "danger" ? "text-rose-400 font-bold" : "text-foreground"}>
                  {sensors.gas.level}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Flame Sensor</span>
                <span className={sensors.flame.detected ? "text-rose-400 font-bold" : "text-emerald-400"}>
                  {sensors.flame.detected ? "DETECTED!" : "Clear"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Buzzer Output</span>
                <span className={state.buzzer ? "text-rose-400 font-bold animate-pulse" : "text-muted-foreground"}>
                  {state.buzzer ? "ACTIVE" : "Silent"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Header / Sheet Navigation */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border/40 bg-card/80 backdrop-blur-md sticky top-0 z-40">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-600 to-aqua-400 p-[1px]">
              <div className="h-full w-full rounded-[7px] bg-background flex items-center justify-center">
                <Zap className="h-4 w-4 text-brand-400" />
              </div>
            </div>
            <span className="font-bold text-sm tracking-tight">AIoT AuraHome</span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                device.online ? "bg-emerald-400 animate-pulse" : "bg-rose-400",
              )}
            />
            {unackedAlerts.length > 0 && (
              <Link
                href="/alerts"
                className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30"
              >
                {unackedAlerts.length}
              </Link>
            )}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-border/50">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 flex flex-col bg-background/95 backdrop-blur-2xl">
                <SheetHeader className="p-5 border-b border-border/40 text-left">
                  <SheetTitle className="flex items-center gap-2 text-base font-bold">
                    <Zap className="h-5 w-5 text-brand-400" />
                    AIoT Smart Home
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex-1 p-3 space-y-1">
                  {navItems.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition",
                          active
                            ? "bg-brand-500/15 text-brand-300 border border-brand-500/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-brand-400" />
                          <span>{item.label}</span>
                        </div>
                        {item.href === "/alerts" && unackedAlerts.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                            {unackedAlerts.length}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-border/40 text-xs text-muted-foreground font-mono">
                  ESP32 FW: v{device.firmware_version} · No Auth Wall
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="hidden md:flex h-16 items-center justify-between px-8 border-b border-border/30 bg-card/30 backdrop-blur-md sticky top-0 z-30">
            {/* Breadcrumb / Status Summary */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-foreground font-semibold">Home Hub</span>
                <span>/</span>
                <span className="text-brand-300">
                  {navItems.find((n) => n.href === pathname)?.label || "Smart Home"}
                </span>
              </div>
            </div>

            {/* Mode Selector & Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Home Modes Toggle */}
              <div className="flex items-center p-1 rounded-xl bg-muted/40 border border-border/40 text-xs">
                {(["HOME", "AWAY", "SLEEP", "EMERGENCY"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setCurrentHomeMode(m)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-medium text-xs transition-all",
                      currentHomeMode === m
                        ? m === "EMERGENCY"
                          ? "bg-rose-500 text-white shadow-sm font-bold"
                          : "bg-brand-600 text-white shadow-sm font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Alerts shortcut */}
              <Link href="/alerts">
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "relative h-9 rounded-xl border-border/50 text-xs gap-1.5",
                    unackedAlerts.length > 0 && "border-rose-500/50 text-rose-300 bg-rose-500/10",
                  )}
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Alerts</span>
                  {unackedAlerts.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                      {unackedAlerts.length}
                    </span>
                  )}
                </Button>
              </Link>

              {/* AI Assistant shortcut */}
              <Link href="/assistant">
                <Button size="sm" className="h-9 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-glow gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  <span>AI Assistant</span>
                </Button>
              </Link>
            </div>
          </header>

          {/* Child Page Rendering */}
          <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AppShell;
