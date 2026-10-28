"use client";

import { Activity, BellRing, Cpu, KeyRound, Plug, Wrench } from "lucide-react";
import { useHome } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { CALIBRATIONS } from "@/lib/config";
import { PIN_TABLE, SPARE_PINS } from "@/lib/pins";
import { relativeTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/StatusPill";
import { AutomationCard } from "@/components/AutomationCard";

export default function SettingsPage() {
  const { snapshot, updateSetting, mode } = useHome();
  const { device, settings } = snapshot;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wrench className="h-5 w-5 text-brand-400" />
          Settings &amp; Hardware Calibration
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Device identity, network configuration, servo zero-points, and central GPIO pin mapping.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Device Identity" subtitle="Hardware controller and firmware version" icon={<Cpu className="h-4 w-4" />} />
          <dl className="grid grid-cols-2 gap-3 text-xs p-2">
            <Row label="Hardware ID" value="esp32-home-01" mono />
            <Row label="Board Model" value={device.device_type} />
            <Row label="Firmware" value={`v${device.firmware_version}`} />
            <Row label="Local IP" value={device.ip_address ?? "192.168.43.120"} mono />
            <Row label="Wi-Fi RSSI" value={device.rssi != null ? `${device.rssi} dBm` : "-58 dBm (Sim)"} />
            <Row label="Last Seen" value={relativeTime(device.last_seen)} />
            <Row label="Status" value={device.online ? "Online & Healthy" : "Offline"} />
            <Row label="Authentication" value="Pre-configured / Direct Hub" />
          </dl>
          <p className="p-2 text-[11px] leading-relaxed text-slate-500">
            Hardware identifier matches the ESP32 NodeMCU board identity. Commands and Realtime event streams are restricted to this device profile.
          </p>
        </Card>

        <Card>
          <CardHeader title="Backend & Security" subtitle="Database connection and client token isolation" icon={<KeyRound className="h-4 w-4" />} />
          <div className="space-y-3 text-xs p-2">
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <span className="text-slate-300">Supabase Realtime</span>
              <StatusPill tone={mode === "live" ? "on" : "warning"}>{mode === "live" ? "Live Connected" : "Demo Mode"}</StatusPill>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <span className="text-slate-300">Public Client Key</span>
              <StatusPill tone={isSupabaseConfigured ? "on" : "off"}>{isSupabaseConfigured ? "Configured" : "Unset"}</StatusPill>
            </div>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-slate-400">
              <li>
                • Browser and ESP32 only hold the anon publishable key with Row Level Security (RLS).
              </li>
              <li>
                • No service-role key or admin secrets are ever bundled in browser code or firmware.
              </li>
              <li>
                • Critical safety alarms (gas and flame buzzer) operate independently of network connectivity.
              </li>
            </ul>
          </div>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-brand-300" />
          <h2 className="text-base font-semibold text-white">Actuator &amp; Distance Calibration</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {CALIBRATIONS.map((meta) => (
            <AutomationCard
              key={meta.name}
              meta={meta}
              setting={settings.find((s) => s.automation_name === meta.name)}
              onUpdate={updateSetting}
            />
          ))}
        </div>
      </section>

      <Card padded={false}>
        <div className="border-b border-white/10 p-4">
          <CardHeader
            title="ESP32 Central Pin Map"
            subtitle="Configured in esp32/esp32.ino — validated for ESP32 NodeMCU 30-pin"
            icon={<Plug className="h-4 w-4" />}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="bg-white/[0.02] text-slate-400">
              <tr>
                <th className="px-4 py-2 font-semibold">Subsystem</th>
                <th className="px-4 py-2 font-semibold">GPIO Pin</th>
                <th className="px-4 py-2 font-semibold">Signal Mode</th>
                <th className="px-4 py-2 font-semibold">Hardware Notes</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {[...PIN_TABLE, ...SPARE_PINS].map((p) => (
                <tr key={`${p.name}-${p.gpio}`} className="border-t border-white/5">
                  <td className="px-4 py-2 font-mono text-slate-200">
                    {p.level === "caution" ? "⚠ " : p.level === "input-only" ? "◐ " : "● "}
                    {p.name}
                  </td>
                  <td className="px-4 py-2 font-mono font-semibold text-brand-300">{p.gpio}</td>
                  <td className="px-4 py-2 text-slate-400">{p.mode}</td>
                  <td className="px-4 py-2 text-slate-500">{p.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/10 p-4 text-[11px] leading-relaxed text-slate-500">
          <p className="flex items-center gap-2">
            <BellRing className="h-3.5 w-3.5 text-amber-400" />
            Motors, pumps, and servos must always be powered from an external 5V/power supply sharing a common ground with the ESP32. Never drive motors directly from 3.3V GPIOs.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-0.5 truncate text-slate-100 ${mono ? "font-mono text-[11px]" : ""}`}>{value}</dd>
    </div>
  );
}
