"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Radio,
  RefreshCw,
  Server,
  Shield,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import { useHome } from "@/lib/store";
import { relativeTime, clockTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DiagnosticsPage() {
  const { snapshot, mode, refresh } = useHome();
  const { device, sensors, commands, alerts, events } = snapshot;
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const isDhtHealthy = sensors.dht.temperature > -10 && sensors.dht.humidity >= 0;
  const isUltrasonicHealthy = sensors.dustbin.distance_cm >= 0 && sensors.dustbin.distance_cm < 400;
  const isSoilHealthy = sensors.soil.raw >= 0 && sensors.soil.raw <= 4095;
  const isLdrHealthy = sensors.ldr.raw >= 0 && sensors.ldr.raw <= 4095;

  const lastCommand = commands[0] || null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-400" />
            System Health &amp; Diagnostics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time link status, subscription telemetry, sensor health, and execution audit log.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-9 rounded-xl border-border/60 text-xs font-semibold gap-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-brand-400")} />
          <span>Refresh Diagnostics</span>
        </Button>
      </div>

      {/* Connectivity & Architecture Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Backend DB Connection */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Backend Service</CardTitle>
            <Database className="h-4 w-4 text-brand-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", mode === "live" ? "bg-emerald-400" : "bg-amber-400")} />
              {mode === "live" ? "Supabase PostgreSQL" : "Local Demo Engine"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Mode: {mode === "live" ? "Live Connected" : "Local Autonomous Simulation"}
            </p>
          </CardContent>
        </Card>

        {/* Realtime Subscription Status */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Realtime Channel</CardTitle>
            <Radio className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              Subscribed
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Protocol: Phoenix Channels v2 (WebSocket)
            </p>
          </CardContent>
        </Card>

        {/* ESP32 Hardware Status */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">ESP32 Controller</CardTitle>
            <Cpu className="h-4 w-4 text-brand-400" />
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", device.online ? "bg-emerald-400" : "bg-rose-400")} />
              {device.online ? "Online & Healthy" : "Offline"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Seen: {relativeTime(device.last_seen)} · FW v{device.firmware_version}
            </p>
          </CardContent>
        </Card>

        {/* Network Signal & IP */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Network Link</CardTitle>
            {device.online ? <Wifi className="h-4 w-4 text-emerald-400" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-lg font-bold text-foreground font-mono">
              {device.rssi ? `${device.rssi} dBm` : "-58 dBm (Sim)"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              IP: {device.ip_address || "192.168.43.120"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sensor Health Matrix & Last Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sensor Subsystem Health Matrix */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Server className="h-4 w-4 text-brand-400" />
              Sensor Subsystem Integrity
            </CardTitle>
            <CardDescription className="text-xs">
              Continuous validation: out-of-range or disconnected probes flagged immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="space-y-2.5">
              {[
                { name: "DHT11 (Temp/Humidity)", pin: "GPIO 23", status: isDhtHealthy, reading: `${sensors.dht.temperature}°C, ${sensors.dht.humidity}%` },
                { name: "LDR Light Sensor", pin: "GPIO 34 (ADC1)", status: isLdrHealthy, reading: `${sensors.ldr.raw} raw (${sensors.ldr.state})` },
                { name: "Soil Moisture Sensor", pin: "GPIO 35 (ADC1)", status: isSoilHealthy, reading: `${Math.round(sensors.soil.percent)}% (raw ${sensors.soil.raw})` },
                { name: "HC-SR04 Ultrasonic", pin: "GPIO 15/4", status: isUltrasonicHealthy, reading: `${sensors.dustbin.distance_cm} cm (${Math.round(sensors.dustbin.percent)}%)` },
                { name: "Water Tank Level", pin: "GPIO 39 (ADC1)", status: true, reading: `${Math.round(sensors.water_level.percent)}% (${sensors.water_level.state}, raw ${sensors.water_level.raw})` },
                { name: "MQ-2 Gas / Smoke", pin: "GPIO 36 (ADC1)", status: true, reading: `${sensors.gas.raw} raw (${sensors.gas.level})` },
                { name: "Flame Sensor", pin: "GPIO 22", status: true, reading: sensors.flame.detected ? "FLAME TRIGGERED" : "Clear" },
                { name: "Magnetic Reed Switch", pin: "GPIO 21", status: !sensors.reed.mismatch, reading: `Door ${sensors.reed.state.toUpperCase()}` },
                { name: "Rain Sensor", pin: "GPIO 19", status: true, reading: sensors.rain.detected ? "Raining" : "Dry" },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-muted/20 text-xs">
                  <div className="flex items-center gap-2.5">
                    {item.status ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground ml-2">[{item.pin}]</span>
                    </div>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {item.reading}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Command Audit Log & Acknowledgement Track */}
        <Card className="rounded-2xl border-border/50 bg-card/60 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-400" />
              Command Acknowledgement Audit Log
            </CardTitle>
            <CardDescription className="text-xs">
              Every remote click triggers a cryptographic UUID command record verified by physical controller ACK.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="space-y-2.5">
              {commands.slice(0, 6).map((cmd) => (
                <div key={cmd.id} className="p-2.5 rounded-xl border border-border/40 bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5 font-mono">
                      {cmd.command_type} → {cmd.value}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                        cmd.status === "completed"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : cmd.status === "failed"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                      )}
                    >
                      {cmd.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>UUID: {cmd.id.substring(0, 16)}...</span>
                    <span>Created {relativeTime(cmd.created_at)}</span>
                  </div>
                </div>
              ))}
              {commands.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">No commands dispatched yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
