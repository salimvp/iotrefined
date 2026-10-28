"use client";

import { ArrowRight, Cpu, Droplets, Fan, Lightbulb, DoorOpen, Shirt, Sprout, Zap, Bell, CheckCircle2 } from "lucide-react";
import { useHome } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/StatusPill";
import { ControlTile } from "@/components/ControlTile";

export default function ControlsPage() {
  const { snapshot, inFlight, sendCommand, setControlMode } = useHome();
  const { state, sensors, settings, commands } = snapshot;

  const doorAngles = settings.find((s) => s.automation_name === "door_servo");
  const dryerAngles = settings.find((s) => s.automation_name === "dryer_servo");

  const desired = {
    light: state.light ? "ON" : "OFF",
    fan: state.fan ? "ON" : "OFF",
    door: state.door === "open" ? "OPEN" : "CLOSE",
    dryer: state.clothes_dryer === "extended" ? "EXTEND" : "RETRACT",
    pump_soil: state.pump_soil ? "ON" : "OFF",
    pump_tank: state.pump_tank ? "ON" : "OFF",
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-brand-400" />
          Physical Actuator Controls
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Direct manual overrides and automation switches. All commands are validated and acknowledged by the ESP32.
        </p>
      </div>

      {/* Actuator Tiles Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Light */}
        <ControlTile
          title="Ambient Light"
          icon={<Lightbulb className="h-5 w-5" />}
          active={state.light}
          activeLabel="ON"
          inactiveLabel="OFF"
          tone={state.light ? "on" : "off"}
          pending={"LIGHT" in inFlight}
          mode={state.modes.light}
          onToggle={(v) => void sendCommand("LIGHT", v ? "ON" : "OFF")}
          onModeChange={(m) => void setControlMode("light", m)}
          footer={
            state.modes.light === "auto"
              ? "AUTO: LDR light automation regulates this · Driver IN1/IN2 (GPIO 13/33)"
              : "MANUAL: automation disabled · Driver IN1/IN2 (GPIO 13/33)"
          }
        />

        {/* Fan */}
        <ControlTile
          title="Ventilation Fan"
          icon={<Fan className="h-5 w-5" />}
          active={state.fan}
          activeLabel="RUNNING"
          inactiveLabel="STOPPED"
          tone={state.fan ? "on" : "off"}
          pending={"FAN" in inFlight}
          mode={state.modes.fan}
          onToggle={(v) => void sendCommand("FAN", v ? "ON" : "OFF")}
          onModeChange={(m) => void setControlMode("fan", m)}
          footer={`DHT11: ${sensors.dht.temperature.toFixed(1)}°C · Driver IN1/IN2 (GPIO 25/26)`}
        />

        {/* Door */}
        <ControlTile
          title="Front Door (Servo)"
          icon={<DoorOpen className="h-5 w-5" />}
          active={state.door === "open"}
          activeLabel="OPEN"
          inactiveLabel="CLOSED"
          tone={state.door === "open" ? "info" : "off"}
          pending={"DOOR" in inFlight}
          onToggle={(v) => void sendCommand("DOOR", v ? "OPEN" : "CLOSE")}
          footer={
            sensors.reed.mismatch ? (
              <span className="text-amber-300">
                ⚠ Mismatch: commanded “{state.door}” but reed switch reads “{sensors.reed.state}”
              </span>
            ) : (
              `Reed contact confirms “${sensors.reed.state}” · changed ${relativeTime(sensors.reed.last_change_at)}`
            )
          }
        />

        {/* Clothes Drying Rack */}
        <ControlTile
          title="Clothes-Drying Rack"
          icon={<Shirt className="h-5 w-5" />}
          active={state.clothes_dryer === "extended"}
          activeLabel="EXTENDED"
          inactiveLabel="RETRACTED"
          tone={state.clothes_dryer === "extended" ? "info" : "off"}
          pending={"CLOTHES_DRYER" in inFlight}
          mode={state.modes.clothes_dryer}
          onToggle={(v) => void sendCommand("CLOTHES_DRYER", v ? "EXTEND" : "RETRACT")}
          onModeChange={(m) => void setControlMode("clothes_dryer", m)}
          footer={sensors.rain.detected ? <span className="text-sky-300">Rain detected now</span> : "No rain detected"}
        />

        {/* Plant Watering Pump */}
        <ControlTile
          title="Plant Watering Pump"
          icon={<Sprout className="h-5 w-5" />}
          active={state.pump_soil}
          activeLabel="WATERING"
          inactiveLabel="IDLE"
          tone={state.pump_soil ? "on" : "off"}
          pending={"PUMP_SOIL" in inFlight}
          mode={state.modes.watering}
          onToggle={(v) => void sendCommand("PUMP_SOIL", v ? "ON" : "OFF")}
          onModeChange={(m) => void setControlMode("watering", m)}
          footer={`Soil moisture: ${Math.round(sensors.soil.percent)}% · auto runs are capped at 5s, manual runs at 2 min`}
        />

        {/* Water Tank Fill Pump */}
        <ControlTile
          title="Water Tank Fill Pump"
          icon={<Droplets className="h-5 w-5" />}
          active={state.pump_tank}
          activeLabel="FILLING"
          inactiveLabel="IDLE"
          tone={state.pump_tank ? "on" : "off"}
          pending={"PUMP_TANK" in inFlight}
          mode={state.modes.tank_level}
          onToggle={(v) => void sendCommand("PUMP_TANK", v ? "ON" : "OFF")}
          onModeChange={(m) => void setControlMode("tank_level", m)}
          footer={`Tank level: ${Math.round(sensors.water_level.percent)}% (${sensors.water_level.state}) · Driver IN1/IN2 (GPIO 16/2)`}
        />

        {/* Local Hardware Buzzer */}
        <ControlTile
          title="Emergency Buzzer"
          icon={<Bell className="h-5 w-5" />}
          active={state.buzzer}
          activeLabel="ALARM SOUNDING"
          inactiveLabel="SILENT"
          tone={state.buzzer ? "danger" : "off"}
          pending={false}
          mode="manual"
          onToggle={() => {}}
          onModeChange={() => {}}
          footer="Hardware buzzer operates autonomously on flame or gas detection"
        />
      </div>

      {/* Sync Status Table & Command Queue */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Desired vs Confirmed Physical State */}
        <Card>
          <CardHeader
            title="Desired vs Confirmed Physical State"
            subtitle="Comparing web requests against ESP32 controller confirmation"
            icon={<ArrowRight className="h-4 w-4" />}
          />
          <div className="space-y-2.5 p-2">
            {(
              [
                ["LIGHT", desired.light, state.light ? "ON" : "OFF"],
                ["FAN", desired.fan, state.fan ? "ON" : "OFF"],
                ["DOOR", desired.door, state.door === "open" ? "OPEN" : "CLOSE"],
                ["CLOTHES_DRYER", desired.dryer, state.clothes_dryer === "extended" ? "EXTEND" : "RETRACT"],
                ["PUMP_SOIL", desired.pump_soil, state.pump_soil ? "ON" : "OFF"],
                ["PUMP_TANK", desired.pump_tank, state.pump_tank ? "ON" : "OFF"],
              ] as const
            ).map(([key, want, actual]) => {
              const syncing = key in inFlight;
              const norm = (s: string) => (s === "CLOSE" ? "CLOSED" : s === "EXTEND" ? "EXTENDED" : s === "RETRACT" ? "RETRACTED" : s);
              const matches = norm(want) === norm(actual);
              return (
                <div key={key} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
                  <span className="text-xs font-semibold text-slate-300">{key}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{norm(want)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                    <span className="text-xs font-semibold text-slate-100">{norm(actual)}</span>
                    {syncing ? (
                      <StatusPill tone="warning">syncing</StatusPill>
                    ) : matches ? (
                      <StatusPill tone="on">in sync</StatusPill>
                    ) : (
                      <StatusPill tone="off">idle</StatusPill>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Live Command Queue */}
        <Card>
          <CardHeader
            title="Command Queue & Execution Status"
            subtitle="Recent database command records with execution timestamps"
            icon={<Cpu className="h-4 w-4" />}
          />
          <div className="overflow-hidden rounded-xl border border-white/5 m-2">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.03] text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Command</th>
                  <th className="px-3 py-2 font-semibold">Target Value</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {commands.slice(0, 7).map((c) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-medium text-slate-200">{c.command_type}</td>
                    <td className="px-3 py-2 text-slate-400 font-mono">{c.value}</td>
                    <td className="px-3 py-2">
                      <StatusPill tone={c.status === "completed" ? "on" : c.status === "failed" ? "danger" : "warning"}>
                        {c.status}
                      </StatusPill>
                      {c.error_message ? (
                        <p className="mt-1 max-w-xs text-[11px] leading-snug text-slate-500">
                          {c.error_code ? <span className="font-mono text-slate-400">{c.error_code}: </span> : null}
                          {c.error_message}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{relativeTime(c.created_at)}</td>
                  </tr>
                ))}
                {commands.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                      No commands issued yet. Use the controls above to test.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
