"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  CloudRain,
  Cpu,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Gauge,
  Lightbulb,
  Power,
  Radio,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  Sliders,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Trash2,
  Wind,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { getSupabase } from "@/lib/supabase/client";
import { isSensorStale, useHome } from "@/lib/store";
import { relativeTime, clockTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type TelemetryPoint = { time: string; temperature: number; humidity: number };

const chartConfig = {
  temperature: {
    label: "Temperature (°C)",
    color: "#f59e0b",
  },
  humidity: {
    label: "Humidity (%)",
    color: "#06b6d4",
  },
} satisfies ChartConfig;

export function Dashboard() {
  const { snapshot, inFlight, sendCommand, setControlMode, refresh } = useHome();
  const { device, state, sensors, alerts, events, settings } = snapshot;
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const unackedAlerts = alerts.filter((a) => !a.acknowledged);
  // The DHT11 can stop reporting (loose wire, failing sensor) while its last
  // row stays in `sensor_latest` forever, so the card must not show it as live.
  const dhtStale = isSensorStale(snapshot, "dht");

  // DHT11 history straight from `sensor_readings`. The chart used to be
  // synthesised around the latest value, which showed a trend the board never
  // measured; now it only plots rows the ESP32 actually uploaded.
  const [telemetryData, setTelemetryData] = React.useState<TelemetryPoint[]>([]);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);

  React.useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setHistoryLoaded(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("sensor_readings")
        .select("recorded_at, reading_json")
        .eq("device_id", snapshot.device.id)
        .eq("sensor_type", "dht")
        .order("recorded_at", { ascending: false })
        .limit(30);
      if (cancelled) return;
      const points: TelemetryPoint[] = (data ?? [])
        .map((row) => {
          const json = (row.reading_json ?? {}) as { temperature?: number; humidity?: number };
          return {
            time: clockTime(row.recorded_at as string),
            temperature: Number(json.temperature),
            humidity: Number(json.humidity),
          };
        })
        .filter((point) => Number.isFinite(point.temperature) && Number.isFinite(point.humidity))
        .reverse();
      setTelemetryData(points);
      setHistoryLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot.device.id, sensors.freshness.dht]);

  return (
    <div className="space-y-6">
      {/* Hero Smart Home Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card via-card/70 to-brand-950/20 p-6 md:p-8 backdrop-blur-xl shadow-lg">
        {/* Subtle background ambient graphic */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 h-40 w-40 rounded-full bg-aqua-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/30">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              <span>Real-Time Autonomous Micro-Environment</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              A Home That Thinks, Protects &amp; Automates
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bi-directional control with autonomous local fail-safe execution. All sensor streams and device commands sync via Supabase Realtime without manual refreshing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-10 rounded-xl border-border/60 text-xs font-medium gap-2"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-brand-400")} />
              <span>Sync Status</span>
            </Button>
            <Link href="/assistant">
              <Button size="sm" className="h-10 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-glow gap-2">
                <Bot className="h-3.5 w-3.5" />
                <span>Ask AI Assistant</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Safety & Alert Banner if Critical */}
      {(sensors.flame.detected || sensors.gas.level === "danger" || unackedAlerts.length > 0) && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 backdrop-blur-md flex items-center justify-between gap-4 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Flame className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-300">
                {sensors.flame.detected
                  ? "CRITICAL: Flame Detected by Optical Sensor!"
                  : sensors.gas.level === "danger"
                  ? "CRITICAL: High Gas / Smoke Reading!"
                  : "Attention Required: Unacknowledged Security Alerts"}
              </h4>
              <p className="text-xs text-rose-200/80">
                Local hardware buzzer is {state.buzzer ? "ACTIVELY ALARMING" : "configured"}. Local safety logic runs independently of the network.
              </p>
            </div>
          </div>
          <Link href="/alerts">
            <Button size="sm" variant="destructive" className="h-9 rounded-xl text-xs font-semibold gap-1.5">
              <span>View Alerts ({unackedAlerts.length})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Temperature & Humidity */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md hover:border-brand-500/30 transition">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Temperature</CardTitle>
            <Thermometer className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {dhtStale ? "—" : `${sensors.dht.temperature.toFixed(1)}°C`}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Droplets className="h-3 w-3 text-cyan-400" />
              {dhtStale ? "No DHT11 reading received" : `Humidity: ${Math.round(sensors.dht.humidity)}%`}
            </p>
          </CardContent>
        </Card>

        {/* Soil Moisture */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md hover:border-brand-500/30 transition">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Soil Moisture</CardTitle>
            <Sprout className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {Math.round(sensors.soil.percent)}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Status:{" "}
              <span className={cn("font-medium capitalize", sensors.soil.state === "dry" ? "text-amber-400 font-bold" : "text-emerald-400")}>
                {sensors.soil.state}
              </span>{" "}
              · Pump: {state.pump_soil ? "ON" : "OFF"}
            </p>
          </CardContent>
        </Card>

        {/* Dustbin Fill Level */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md hover:border-brand-500/30 transition">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Dustbin Level</CardTitle>
            <Trash2 className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {Math.round(sensors.dustbin.percent)}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Distance: {sensors.dustbin.distance_cm} cm ·{" "}
              <span className={sensors.dustbin.state === "full" ? "text-rose-400 font-bold" : "text-muted-foreground"}>
                {sensors.dustbin.state.replace("_", " ")}
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Rain & Rack Status */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md hover:border-brand-500/30 transition">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Weather &amp; Rack</CardTitle>
            <CloudRain className="h-4 w-4 text-sky-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {sensors.rain.detected ? "Raining" : "Dry"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Rack: <span className="font-semibold text-brand-300 uppercase">{state.clothes_dryer}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Realtime Actuator Control Tiles & Environmental Telemetry Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Device Controls (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <Power className="h-4 w-4 text-brand-400" />
                Physical Actuators &amp; Confirmed State
              </h2>
              <p className="text-xs text-muted-foreground">
                State reflects the ESP32 controller confirmation, never mere DB inserts.
              </p>
            </div>
            <Link href="/controls" className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center gap-1">
              <span>All Controls</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Light Control */}
            <ActuatorCard
              title="Ambient Light"
              icon={Lightbulb}
              active={state.light}
              activeColor="text-amber-400"
              statusLabel={state.light ? "LIGHT ON" : "LIGHT OFF"}
              isPending={"LIGHT" in inFlight}
              mode={state.modes.light}
              sensorDetail={`LDR Level: ${sensors.ldr.raw} (${sensors.ldr.state})`}
              onToggle={() => void sendCommand("LIGHT", state.light ? "OFF" : "ON")}
              onToggleMode={() => void setControlMode("light", state.modes.light === "auto" ? "manual" : "auto")}
            />

            {/* Fan Control */}
            <ActuatorCard
              title="DC Ventilation Fan"
              icon={Fan}
              active={state.fan}
              activeColor="text-cyan-400"
              statusLabel={state.fan ? "FAN RUNNING" : "FAN STOPPED"}
              isPending={"FAN" in inFlight}
              mode={state.modes.fan}
              sensorDetail={
                dhtStale ? "DHT11: no reading received" : `DHT11: ${sensors.dht.temperature.toFixed(1)}°C (Auto threshold: 28°C)`
              }
              onToggle={() => void sendCommand("FAN", state.fan ? "OFF" : "ON")}
              onToggleMode={() => void setControlMode("fan", state.modes.fan === "auto" ? "manual" : "auto")}
            />

            {/* Door Servo + Reed Switch */}
            <ActuatorCard
              title="Security Door"
              icon={DoorOpen}
              active={state.door === "open"}
              activeColor="text-brand-400"
              statusLabel={state.door === "open" ? "DOOR OPEN" : "DOOR CLOSED"}
              isPending={"DOOR" in inFlight}
              sensorDetail={
                sensors.reed.mismatch
                  ? `⚠ REED MISMATCH: Sensor says ${sensors.reed.state}`
                  : `Reed sensor confirms: ${sensors.reed.state}`
              }
              onToggle={() => void sendCommand("DOOR", state.door === "open" ? "CLOSE" : "OPEN")}
            />

            {/* Plant Watering Pump */}
            <ActuatorCard
              title="Plant Watering Pump"
              icon={Sprout}
              active={state.pump_soil}
              activeColor="text-emerald-400"
              statusLabel={state.pump_soil ? "PUMP ACTIVE" : "PUMP IDLE"}
              isPending={"PUMP_SOIL" in inFlight}
              mode={state.modes.watering}
              sensorDetail={`Moisture: ${Math.round(sensors.soil.percent)}% (Auto runs when <30%)`}
              onToggle={() => void sendCommand("PUMP_SOIL", state.pump_soil ? "OFF" : "ON")}
              onToggleMode={() => void setControlMode("watering", state.modes.watering === "auto" ? "manual" : "auto")}
            />

            {/* Water Tank Fill Pump */}
            <ActuatorCard
              title="Water Tank Fill Pump"
              icon={Droplets}
              active={state.pump_tank}
              activeColor="text-sky-400"
              statusLabel={state.pump_tank ? "PUMP FILLING" : "PUMP IDLE"}
              isPending={"PUMP_TANK" in inFlight}
              mode={state.modes.tank_level}
              sensorDetail={`Tank level: ${Math.round(sensors.water_level.percent)}% (Auto fills when <30%)`}
              onToggle={() => void sendCommand("PUMP_TANK", state.pump_tank ? "OFF" : "ON")}
              onToggleMode={() => void setControlMode("tank_level", state.modes.tank_level === "auto" ? "manual" : "auto")}
            />

            {/* Clothes Rack */}
            <ActuatorCard
              title="Clothes-Drying Rack"
              icon={Shirt}
              active={state.clothes_dryer === "extended"}
              activeColor="text-sky-400"
              statusLabel={state.clothes_dryer === "extended" ? "EXTENDED" : "RETRACTED"}
              isPending={"CLOTHES_DRYER" in inFlight}
              mode={state.modes.clothes_dryer}
              sensorDetail={`Rain Sensor: ${sensors.rain.detected ? "Rain Detected!" : "Dry"}`}
              onToggle={() => void sendCommand("CLOTHES_DRYER", state.clothes_dryer === "extended" ? "RETRACT" : "EXTEND")}
              onToggleMode={() => void setControlMode("clothes_dryer", state.modes.clothes_dryer === "auto" ? "manual" : "auto")}
            />

            {/* Security PIR & Gas Monitor */}
            <Card className="rounded-2xl border-border/50 bg-card/50 p-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Radio className="h-4 w-4 text-brand-400" />
                    PIR &amp; Security Radar
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                    sensors.pir.motion ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-muted text-muted-foreground",
                  )}>
                    {sensors.pir.motion ? "MOTION DETECTED" : "CLEAR"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last motion: {relativeTime(sensors.pir.last_motion_at)}
                </p>
                <div className="pt-2 border-t border-border/30 text-[11px] text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Gas ADC Level:</span>
                    <span className="font-mono text-foreground">{sensors.gas.raw} / 4095</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Flame Photodiode:</span>
                    <span className={sensors.flame.detected ? "text-rose-400 font-bold" : "text-emerald-400"}>
                      {sensors.flame.detected ? "TRIGGERED" : "NORMAL"}
                    </span>
                  </div>
                </div>
              </div>
              <Link href="/sensors" className="pt-3">
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-brand-400 justify-between">
                  <span>View detailed sensor charts</span>
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>

        {/* Right Col: Environmental Telemetry Chart & Recent Activity */}
        <div className="space-y-6">
          {/* Realtime Environment Chart */}
          <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-400" />
                Live DHT11 Telemetry
              </CardTitle>
              <CardDescription className="text-xs">
                Temperature and relative humidity as uploaded by the ESP32
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {telemetryData.length < 2 ? (
                <div className="grid h-44 place-items-center rounded-xl border border-dashed border-border/50 px-4 text-center text-xs text-muted-foreground">
                  {historyLoaded
                    ? "No DHT11 history yet - the ESP32 has not uploaded temperature or humidity readings."
                    : "Loading DHT11 history..."}
                </div>
              ) : (
              <ChartContainer config={chartConfig} className="h-44 w-full">
                <AreaChart data={telemetryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={["dataMin - 2", "dataMax + 2"]} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#tempGradient)" />
                  <Area type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#humGradient)" />
                </AreaChart>
              </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Local System Activity
                </CardTitle>
                <CardDescription className="text-xs">Recent decisions &amp; state transitions</CardDescription>
              </div>
              <Link href="/diagnostics" className="text-xs text-brand-400 hover:text-brand-300">
                Logs →
              </Link>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-2.5">
                {events.slice(0, 4).map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2.5 p-2 rounded-xl bg-muted/30 border border-border/30 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">{evt.message}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {evt.event_type} · {clockTime(evt.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No events logged yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActuatorCard({
  title,
  icon: Icon,
  active,
  activeColor,
  statusLabel,
  isPending,
  mode,
  sensorDetail,
  onToggle,
  onToggleMode,
}: {
  title: string;
  icon: React.ElementType;
  active: boolean;
  activeColor: string;
  statusLabel: string;
  isPending: boolean;
  /** The door servo has no automation, so its card omits the mode switch. */
  mode?: "auto" | "manual";
  sensorDetail: string;
  onToggle: () => void;
  onToggleMode?: () => void;
}) {
  return (
    <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md p-4 flex flex-col justify-between hover:border-brand-500/30 transition">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center border", active ? "bg-card border-brand-500/40" : "bg-muted/50 border-border/40")}>
              <Icon className={cn("h-5 w-5 transition", active ? activeColor : "text-muted-foreground")} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">{title}</h3>
              <p className="text-[10px] font-mono text-muted-foreground">{sensorDetail}</p>
            </div>
          </div>

          {/* Mode Switcher pill */}
          {mode && onToggleMode ? (
            <button
              onClick={onToggleMode}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold transition uppercase tracking-wider border",
                mode === "auto"
                  ? "bg-brand-500/15 text-brand-300 border-brand-500/30 hover:bg-brand-500/25"
                  : "bg-muted/80 text-muted-foreground border-border/40 hover:text-foreground",
              )}
              title="Click to toggle AUTO / MANUAL mode"
            >
              {mode}
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span
            className={cn(
              "text-xs font-bold font-mono tracking-tight",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
          {isPending && (
            <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 animate-pulse">
              <RotateCw className="h-3 w-3 animate-spin" />
              Syncing...
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-border/30 mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {mode === undefined ? "Manual Control" : mode === "auto" ? "Managed by ESP32 Logic" : "Manual Override Active"}
        </span>
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          disabled={isPending}
          onClick={onToggle}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-semibold transition",
            active ? "bg-brand-600 hover:bg-brand-500 text-white shadow-sm" : "border-border/60 hover:bg-muted",
          )}
        >
          {active ? "Turn Off" : "Turn On"}
        </Button>
      </div>
    </Card>
  );
}

export default Dashboard;
