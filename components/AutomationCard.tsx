"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { AutomationMeta } from "@/lib/config";
import type { AutomationName, AutomationSetting } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Toggle } from "@/components/ui/Toggle";
import { StatusPill } from "@/components/ui/StatusPill";
import { IconByName } from "@/components/IconByName";

export function AutomationCard({
  meta,
  setting,
  onUpdate,
}: {
  meta: AutomationMeta;
  setting: AutomationSetting | undefined;
  onUpdate: (name: AutomationName, patch: Partial<AutomationSetting>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft({
      threshold: setting?.threshold ?? meta.defaults.threshold,
      secondary_threshold: setting?.secondary_threshold ?? meta.defaults.secondary_threshold,
      duration: setting?.duration ?? meta.defaults.duration,
    });
  }, [setting, meta]);

  const enabled = setting?.enabled ?? meta.defaults.enabled;

  async function commit(key: string, value: number) {
    setDraft((d) => ({ ...d, [key]: value }));
    await onUpdate(meta.name, { [key]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-brand-300">
          <IconByName name={meta.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{meta.title}</h3>
            {saved ? (
              <StatusPill tone="on">
                <Check className="h-3 w-3" /> saved
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{meta.description}</p>
        </div>
        <Toggle
          checked={enabled}
          label={meta.title}
          onChange={(v) => void onUpdate(meta.name, { enabled: v })}
        />
      </div>

      {meta.fields.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {meta.fields.map((f) => (
            <label key={f.key} className="block">
              <span className="label">{f.label}</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  className="field"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                  onBlur={(e) => commit(f.key, Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className="w-10 shrink-0 text-xs text-slate-500">{f.unit}</span>
              </div>
              {f.hint ? <span className="mt-1 block text-[11px] text-slate-500">{f.hint}</span> : null}
            </label>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
