"use client";

import { CloudRain, DoorOpen, Flame, Gauge, Info, Lightbulb, Radar, Sprout, Thermometer, Trash2, Wind, Droplets } from "lucide-react";
import { isSensorStale, useHome } from "@/lib/store";
import type { SensorKey } from "@/lib/types";
import { useSeries } from "@/lib/hooks";
import { relativeTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill, type Tone } from "@/components/ui/StatusPill";
import { Sparkline } from "@/components/ui/Sparkline";

export default function SensorsPage() {
  const { snapshot } = useHome();
  const s = snapshot.sensors;
  // A sensor that stopped reporting keeps its last value in `sensor_latest`.
  // Show that as missing instead of pretending it is a live measurement.
  const stale = (key: SensorKey) => isSensorStale(snapshot, key);
  const show = (key: SensorKey, text: string) => (stale(key) ? "—" : text);

  const ldr = useSeries(s.ldr.raw);
  const gas = useSeries(s.gas.raw);
  const soil = useSeries(s.soil.percent);
  const tankLevel = useSeries(s.water_level.percent);
  const rain = useSeries(s.rain.raw);
  const dust = useSeries(s.dustbin.percent);
  const temp = useSeries(s.dht.temperature);
  const hum = useSeries(s.dht.humidity);
  const flame = useSeries(s.flame.detected ? 1 : 0);
  const motion = useSeries(s.pir.motion ? 1 : 0);
  const reed = useSeries(s.reed.state === "open" ? 1 : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Gauge className="h-5 w-5 text-brand-400" />
          Sensor Readings &amp; Live Telemetry
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Real-time values from all 10 physical hardware sensors with raw ADC counts (analog) or DO logic levels (digital), historical sparklines, and calibration tips.
        </p>
      </div>

      <Card className="border-brand-400/20 bg-brand-500/[0.06]">
        <div className="flex items-start gap-3 p-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-400/30 bg-brand-500/15 text-brand-200">
            <Info className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Raw Values Displayed For Exact Calibration</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Analog sensors (LDR, soil moisture, ultrasonic echo, MQ-2 gas) report 12-bit ADC counts (0–4095) that depend on your wiring and supply voltage; the MQ-2 value is averaged and smoothed on the board before thresholds are applied. Digital sensors (flame, rain, PIR, reed switch) are read from their <span className="font-semibold text-slate-200">DO</span> comparator pin, so they only report a logic level: <span className="font-semibold text-slate-200">1 = active, 0 = idle</span>. Analog counts can be calibrated on the Automations page; digital sensitivity is set with the potentiometer on the module itself.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* LDR */}
        <Detail
          title="LDR Light Sensor"
          stale={stale("ldr")}
          icon={<Lightbulb className="h-4 w-4" />}
          raw={s.ldr.raw}
          rawMax={4095}
          status={s.ldr.state}
          tone={s.ldr.state === "dark" ? "info" : "on"}
          series={ldr}
          color="#a78bfa"
          calc="Photoresistor module on ADC1 GPIO34. This rig's output rises with darkness: bright below 1200 raw, dark above 1800 raw."
          calibrate="Cover the sensor with your finger to read dark value, then shine a light to find bright limit."
        />

        {/* MQ-2 */}
        <Detail
          title="MQ-2 Gas / Smoke"
          stale={stale("gas")}
          icon={<Wind className="h-4 w-4" />}
          raw={s.gas.raw}
          rawMax={4095}
          status={s.gas.level}
          tone={s.gas.level === "danger" ? "danger" : s.gas.level === "warning" ? "warning" : "on"}
          series={gas}
          color={s.gas.level === "normal" ? "#34d399" : s.gas.level === "warning" ? "#fbbf24" : "#fb7185"}
          calc="Analog output (AO) on ADC1 GPIO36, sampled 8x and smoothed on the board. Warning at 1600 raw, buzzer alarm at 2600 raw, with 150-count hysteresis so noise cannot flap the alert."
          calibrate="Requires 2-minute pre-heat upon cold boot. Read the clean-air value here to pick your warning/danger thresholds."
        />

        {/* Flame */}
        <Detail
          title="Optical Flame Sensor"
          stale={stale("flame")}
          icon={<Flame className="h-4 w-4" />}
          raw={s.flame.raw}
          rawMax={1}
          rawUnit="DO"
          status={s.flame.detected ? "DETECTED" : "Clear"}
          tone={s.flame.detected ? "danger" : "on"}
          series={flame}
          color="#fb7185"
          calc="Photodiode IR flame module digital output (DO) on GPIO22. Reports 1 when a flame is detected and sounds the local buzzer immediately."
          calibrate="Active-LOW comparator board. Ensure sensor is pointed towards the exhibition hearth/burner area."
        />

        {/* Soil Moisture */}
        <Detail
          title="Soil Moisture"
          stale={stale("soil")}
          icon={<Sprout className="h-4 w-4" />}
          raw={s.soil.raw}
          rawMax={4095}
          status={`${Math.round(s.soil.percent)}% · ${s.soil.state}`}
          tone={s.soil.state === "dry" ? "warning" : s.soil.state === "wet" ? "info" : "on"}
          series={soil}
          color={s.soil.state === "dry" ? "#fbbf24" : "#34d399"}
          max={100}
          calc="Soil probe on ADC1 GPIO35. Percentage is mapped between dry air and saturated water baseline."
          calibrate="Measure probe raw in dry air (0%) and in a small glass of water (100%)."
        />

        {/* Water Tank Level */}
        <Detail
          title="Water Tank Level"
          stale={stale("water_level")}
          icon={<Droplets className="h-4 w-4" />}
          raw={s.water_level.percent}
          rawMax={100}
          rawUnit="%"
          status={`${Math.round(s.water_level.percent)}% · ${s.water_level.state}`}
          tone={s.water_level.state === "empty" || s.water_level.state === "low" ? "warning" : s.water_level.state === "full" ? "info" : "on"}
          series={tankLevel}
          color={s.water_level.state === "low" || s.water_level.state === "empty" ? "#fbbf24" : "#38bdf8"}
          max={100}
          calc="Water level probe on ADC1 GPIO39, spanning 0 (dry) to 2000 (fully submerged) counts (raw in the telemetry: see the table below). Drives the tank fill pump: starts below 30%, stops at 85%, one cycle capped at 30s."
          calibrate="Read the raw count with the probe dry (empty ≈ 0) and fully submerged (full ≈ 2000), then adjust the empty/full counts in the firmware or on the Settings page."
        />

        {/* Rain */}
        <Detail
          title="Optical Rain Sensor"
          stale={stale("rain")}
          icon={<CloudRain className="h-4 w-4" />}
          raw={s.rain.raw}
          rawMax={1}
          rawUnit="DO"
          status={s.rain.detected ? "Raining" : "Dry"}
          tone={s.rain.detected ? "warning" : "on"}
          series={rain}
          color="#22d3ee"
          calc="Raindrop contact board digital output (DO) on GPIO19. Reports 1 when water bridges the plate and retracts the clothes rack instantly."
          calibrate="Wipe the plate dry with a tissue and confirm the value returns to 0; adjust the module potentiometer if it stays triggered."
        />

        {/* Dustbin */}
        <Detail
          title="Dustbin Level (Ultrasonic)"
          stale={stale("dustbin")}
          icon={<Trash2 className="h-4 w-4" />}
          raw={s.dustbin.distance_cm}
          rawMax={40}
          rawUnit="cm"
          status={`${Math.round(s.dustbin.percent)}% · ${s.dustbin.state.replace("_", " ")}`}
          tone={s.dustbin.state === "full" ? "danger" : s.dustbin.state === "almost_full" ? "warning" : "on"}
          series={dust}
          color="#f59e0b"
          max={100}
          calc="HC-SR04 sonar on GPIO15 (Trig) / GPIO4 (Echo). Fill % calculated from distance to trash surface."
          calibrate="Calibrate empty distance (lid to empty bottom, e.g. 30 cm) and full distance (e.g. 5 cm) in Settings."
        />

        {/* DHT11 Temperature */}
        <Detail
          title="DHT11 — Temperature"
          stale={stale("dht")}
          icon={<Thermometer className="h-4 w-4" />}
          raw={s.dht.temperature}
          rawMax={45}
          rawUnit="°C"
          status={`${s.dht.temperature.toFixed(1)} °C`}
          tone="on"
          series={temp}
          color="#f59e0b"
          min={15}
          max={40}
          calc="Digital one-wire DHT11 on GPIO23. Controls ventilation fan above configured threshold."
          calibrate="Sampled every 2.5s to preserve sensor accuracy. Safe operating range 0–50 °C (±2 °C precision)."
        />

        {/* DHT11 Humidity */}
        <Detail
          title="DHT11 — Humidity"
          stale={stale("dht")}
          icon={<Droplets className="h-4 w-4" />}
          raw={s.dht.humidity}
          rawMax={100}
          rawUnit="%"
          status={`${Math.round(s.dht.humidity)} %`}
          tone="on"
          series={hum}
          color="#22d3ee"
          min={20}
          max={90}
          calc="Relative humidity measurement. Synced alongside temperature in each sensor cycle."
          calibrate="Capacitive relative humidity polymer sensor (20–90% RH with ±5% accuracy)."
        />

        {/* PIR Motion */}
        <Detail
          title="PIR Motion Detector"
          stale={stale("pir")}
          icon={<Radar className="h-4 w-4" />}
          raw={s.pir.motion ? 1 : 0}
          rawMax={1}
          status={s.pir.motion ? "Motion Detected" : "Clear"}
          tone={s.pir.motion ? "info" : "neutral"}
          series={motion}
          color="#38bdf8"
          calc={`Last motion detected: ${relativeTime(s.pir.last_motion_at)}. Reports on status change.`}
          calibrate="Adjust sensitivity potentiometer on HC-SR501 board. Sensor idles LOW and goes HIGH on motion."
        />

        {/* Magnetic Reed Switch */}
        <Detail
          title="Magnetic Reed Door Contact"
          stale={stale("reed")}
          icon={<DoorOpen className="h-4 w-4" />}
          raw={s.reed.state === "open" ? 1 : 0}
          rawMax={1}
          rawUnit="DO"
          status={s.reed.mismatch ? `${s.reed.state === "open" ? "Open" : "Closed"} · mismatch` : s.reed.state === "open" ? "Open" : "Closed"}
          tone={s.reed.mismatch ? "warning" : s.reed.state === "open" ? "info" : "on"}
          series={reed}
          color={s.reed.mismatch ? "#fbbf24" : s.reed.state === "open" ? "#38bdf8" : "#34d399"}
          calc={`Magnetic reed switch on the front door via GPIO 21 (pull-up). Reports OPEN when the magnet leaves the glass capsule and CLOSED when it holds the contact shut. Last change: ${relativeTime(s.reed.last_change_at)}.`}
          calibrate="Ensure the magnet sits within 5–10 mm of the reed capsule when the door is closed. Compare with the commanded servo position to clear a mismatch."
        />
      </div>

      {/* Raw Sensor Summary Table */}
      <Card>
        <CardHeader title="Raw Telemetry Snapshot Table" subtitle="Instantaneous register readings received from ESP32" icon={<Gauge className="h-4 w-4" />} />
        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[500px] text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-semibold">Sensor</th>
                <th className="px-3 py-2 font-semibold">GPIO Pin</th>
                <th className="px-3 py-2 font-semibold">Pin Reading</th>
                <th className="px-3 py-2 font-semibold">Derived Metric</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {[
                ["DHT11 Temperature", "GPIO 23", show("dht", `${s.dht.temperature.toFixed(1)} °C`), show("dht", `${s.dht.temperature.toFixed(1)} °C`), show("dht", "Normal")],
                ["DHT11 Humidity", "GPIO 23", show("dht", `${Math.round(s.dht.humidity)} %`), show("dht", `${Math.round(s.dht.humidity)} % RH`), show("dht", "Normal")],
                ["LDR Light Sensor", "GPIO 34 (ADC1)", show("ldr", String(s.ldr.raw)), show("ldr", s.ldr.state), show("ldr", s.ldr.state === "dark" ? "Low Light" : "Bright")],
                ["Soil Moisture", "GPIO 35 (ADC1)", show("soil", String(s.soil.raw)), show("soil", `${Math.round(s.soil.percent)}%`), show("soil", s.soil.state)],
                ["Water Tank Level", "GPIO 39 (ADC1)", show("water_level", String(s.water_level.raw)), show("water_level", `${Math.round(s.water_level.percent)}%`), show("water_level", s.water_level.state)],
                ["HC-SR04 Ultrasonic", "GPIO 15 / 4", show("dustbin", `${s.dustbin.distance_cm} cm`), show("dustbin", `${Math.round(s.dustbin.percent)}% Full`), show("dustbin", s.dustbin.state)],
                ["MQ-2 Gas / Smoke", "GPIO 36 (ADC1)", show("gas", String(s.gas.raw)), show("gas", s.gas.level), show("gas", s.gas.level === "danger" ? "ALARM" : "Secure")],
                ["Optical Flame", "GPIO 22", show("flame", String(s.flame.raw)), show("flame", s.flame.detected ? "FLAME TRIGGERED" : "Clear"), show("flame", s.flame.detected ? "CRITICAL" : "Secure")],
                ["Magnetic Reed Switch", "GPIO 21", show("reed", s.reed.state === "open" ? "1" : "0"), show("reed", s.reed.state.toUpperCase()), show("reed", s.reed.mismatch ? "MISMATCH" : "Normal")],
                ["Rain Sensor", "GPIO 19", show("rain", String(s.rain.raw)), show("rain", s.rain.detected ? "Raining" : "Dry"), show("rain", s.rain.detected ? "Wet" : "Clear")],
              ].map((row) => (
                <tr key={String(row[0])} className="border-b border-white/5">
                  <td className="px-3 py-2 font-semibold text-slate-200">{row[0]}</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{row[1]}</td>
                  <td className="px-3 py-2 font-mono">{row[2]}</td>
                  <td className="px-3 py-2 font-mono text-brand-300">{row[3]}</td>
                  <td className="px-3 py-2 font-medium">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Detail({
  title,
  icon,
  raw,
  rawMax,
  rawUnit = "raw",
  status,
  tone,
  series,
  color,
  calc,
  calibrate,
  min = 0,
  max,
  stale = false,
}: {
  title: string;
  icon: React.ReactNode;
  raw: number;
  rawMax: number;
  rawUnit?: string;
  status: string;
  tone: Tone;
  series: number[];
  color: string;
  calc: string;
  calibrate: string;
  min?: number;
  max?: number;
  /** True when no reading has arrived recently - the value on screen is not live. */
  stale?: boolean;
}) {
  return (
    <Card className="flex flex-col justify-between gap-3 p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
              {icon}
            </span>
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          </div>
          <StatusPill tone={stale ? "neutral" : tone} dot pulse={!stale && tone === "danger"}>
            {stale ? "No data" : status}
          </StatusPill>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xl font-bold text-white">
            {stale ? "—" : typeof raw === "number" ? Number(raw.toFixed(1)) : raw}
          </span>
          <span className="text-xs text-slate-500">{stale ? "no reading received" : rawUnit}</span>
        </div>
        {stale ? (
          <div className="grid h-[38px] place-items-center rounded-lg border border-dashed border-white/10 text-[11px] text-slate-500">
            Waiting for the ESP32 to report this sensor
          </div>
        ) : (
          <Sparkline values={series} min={min} max={max ?? rawMax} stroke={color} height={38} />
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-white/5">
        <p className="text-[11px] leading-relaxed text-slate-400">{calc}</p>
        <p className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-400">Calibration:</span> {calibrate}
        </p>
      </div>
    </Card>
  );
}
