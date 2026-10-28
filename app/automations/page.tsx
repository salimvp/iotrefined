"use client";

import { Info, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useHome } from "@/lib/store";
import { AUTOMATIONS } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { AutomationCard } from "@/components/AutomationCard";

export default function AutomationsPage() {
  const { snapshot, updateSetting } = useHome();
  const settings = snapshot.settings;

  return (
    <div className="space-y-5">
      <Card className="border-brand-400/20 bg-brand-500/[0.06]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-400/30 bg-brand-500/15 text-brand-200">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Automations run on the ESP32, not in the cloud</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              These toggles and thresholds are saved to the <code className="rounded bg-black/30 px-1">automation_settings</code>{" "}
              table. The ESP32 downloads them, caches them in memory, and keeps executing locally — so automatic watering,
              rain protection and the LDR light keep working when Wi-Fi or the internet goes down. Only changes made here
              while the device is offline are queued and applied on reconnect.
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-white/10">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-300">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Manual vs automatic priority</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Each device has an <strong className="text-slate-200">AUTO</strong> /{" "}
              <strong className="text-slate-200">MANUAL</strong> switch on the Controls page. In MANUAL the automation is
              ignored completely, so pressing “OFF” never gets instantly undone by the LDR. Switch back to AUTO to hand
              control back to the ESP32.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 xl:grid-cols-2">
        {AUTOMATIONS.map((meta) => (
          <AutomationCard
            key={meta.name}
            meta={meta}
            setting={settings.find((s) => s.automation_name === meta.name)}
            onUpdate={updateSetting}
          />
        ))}
      </div>

      <p className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
        <Info className="h-3.5 w-3.5" /> Analog thresholds (LDR, soil) use raw ADC counts you can calibrate on the Sensors page. The MQ-2 gas warning/danger levels are set in the firmware, and the flame and rain modules trip on their own potentiometer.
      </p>
    </div>
  );
}
