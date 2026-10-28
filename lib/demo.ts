import {
  type Alert,
  type AutomationName,
  type AutomationSetting,
  type Command,
  type Device,
  type DeviceEvent,
  type DeviceState,
  type HomeSnapshot,
  type SensorSnapshot,
} from "./types";
import { defaultSettings } from "./config";

export class DemoEngine {
  private device: Device;
  private state: DeviceState;
  private sensors: SensorSnapshot;
  private settings: AutomationSetting[];
  private alerts: Alert[] = [];
  private commands: Command[] = [];
  private events: DeviceEvent[] = [];
  private tickCount = 0;
  private pumpRunTicks = 0;
  private tankRunTicks = 0;

  constructor(deviceId: string, name: string, version: string) {
    const now = new Date().toISOString();
    this.device = {
      id: deviceId,
      name,
      device_type: "esp32_nodemcu_30pin",
      online: true,
      last_seen: now,
      firmware_version: version,
      ip_address: "192.168.43.120",
      rssi: -58,
    };
    this.state = {
      device_id: deviceId,
      light: false,
      fan: false,
      door: "closed",
      clothes_dryer: "retracted",
      pump_soil: false,
      pump_tank: false,
      buzzer: false,
      modes: {
        light: "auto",
        fan: "auto",
        door: "manual",
        clothes_dryer: "auto",
        watering: "auto",
        tank_level: "auto",
      },
      updated_at: now,
    };
    this.sensors = {
      ldr: { raw: 900, state: "bright" },
      gas: { raw: 420, level: "normal" },
      flame: { detected: false, raw: 0 },
      soil: { raw: 2150, percent: 55, state: "normal" },
      water_level: { raw: 1280, percent: 64, state: "ok" },
      rain: { detected: false, raw: 0 },
      dustbin: { distance_cm: 22, percent: 35, state: "normal" },
      dht: { temperature: 25.4, humidity: 58 },
      pir: { motion: false, last_motion_at: null },
      reed: { state: "closed", last_change_at: now, mismatch: false },
      freshness: {
        ldr: now,
        gas: now,
        flame: now,
        soil: now,
        water_level: now,
        rain: now,
        dustbin: now,
        dht: now,
        pir: now,
        reed: now,
      },
      updated_at: now,
    };
    this.settings = defaultSettings(deviceId);
  }

  public tick() {
    this.tickCount++;
    const now = new Date().toISOString();
    this.device.last_seen = now;
    this.sensors.updated_at = now;
    this.sensors.freshness = {
      ldr: now,
      gas: now,
      flame: now,
      soil: now,
      water_level: now,
      rain: now,
      dustbin: now,
      dht: now,
      pir: now,
      reed: now,
    };

    // 1. Temperature slight drift
    const tDrift = (Math.sin(this.tickCount * 0.1) * 0.4);
    this.sensors.dht.temperature = Math.round((26.0 + tDrift) * 10) / 10;
    this.sensors.dht.humidity = Math.round(58 + Math.cos(this.tickCount * 0.08) * 3);

    // 2. LDR drift (this module reads a HIGHER count in the dark)
    const ldrRaw = Math.round(900 + Math.sin(this.tickCount * 0.05) * 600);
    this.sensors.ldr.raw = ldrRaw;
    this.sensors.ldr.state = ldrRaw >= 1200 ? "dark" : "bright";

    // 3. Gas channel drift (analog AO reading, stays in the safe band)
    this.sensors.gas.raw = Math.round(400 + Math.sin(this.tickCount * 0.07) * 240);
    this.sensors.gas.level =
      this.sensors.gas.raw >= 2600 ? "danger" : this.sensors.gas.raw >= 1600 ? "warning" : "normal";

    // 4. Soil moisture decreases, water pump runs when low
    if (this.state.pump_soil) {
      this.pumpRunTicks++;
      this.sensors.soil.percent = Math.min(85, this.sensors.soil.percent + 8);
      if (this.pumpRunTicks >= 4) {
        this.state.pump_soil = false;
        this.pumpRunTicks = 0;
        this.addEvent("auto_watering", "Pump stopped after reaching safe watering target.");
      }
    } else {
      this.sensors.soil.percent = Math.max(15, this.sensors.soil.percent - 0.2);
    }
    this.sensors.soil.state = this.sensors.soil.percent < 30 ? "dry" : this.sensors.soil.percent > 70 ? "wet" : "normal";

    // 4b. Water tank: fills while the fill pump runs, drains slowly by usage
    if (this.state.pump_tank) {
      this.tankRunTicks++;
      this.sensors.water_level.percent = Math.min(100, this.sensors.water_level.percent + 6);
      if (this.sensors.water_level.percent >= 85) {
        this.state.pump_tank = false;
        this.tankRunTicks = 0;
        this.addEvent("auto_tank_fill", "Tank full; fill pump stopped.");
      }
    } else {
      this.sensors.water_level.percent = Math.max(5, this.sensors.water_level.percent - 0.4);
    }
    const tankPercent = this.sensors.water_level.percent;
    // Probe spans 0 (dry) - 2000 (fully submerged) counts.
    this.sensors.water_level.raw = Math.round((tankPercent / 100) * 2000);
    this.sensors.water_level.state =
      tankPercent <= 5 ? "empty" : tankPercent < 30 ? "low" : tankPercent >= 85 ? "full" : "ok";

    // 5. Local automations evaluation
    if (this.state.modes.light === "auto") {
      const shouldLightBeOn = this.sensors.ldr.raw >= 1200;
      if (this.state.light !== shouldLightBeOn) {
        this.state.light = shouldLightBeOn;
        this.addEvent("auto_light", shouldLightBeOn ? "Light turned ON by dark ambient condition." : "Light turned OFF by ambient sunlight.");
      }
    }

    if (this.state.modes.fan === "auto") {
      const shouldFanBeOn = this.sensors.dht.temperature >= 27.5;
      if (this.state.fan !== shouldFanBeOn) {
        this.state.fan = shouldFanBeOn;
        this.addEvent("auto_fan", shouldFanBeOn ? "Fan turned ON by high temperature threshold." : "Fan stopped as environment cooled down.");
      }
    }

    if (this.state.modes.watering === "auto" && this.sensors.soil.state === "dry" && !this.state.pump_soil) {
      this.state.pump_soil = true;
      this.pumpRunTicks = 0;
      this.addEvent("auto_watering", "Soil is dry; plant watering pump started automatically.");
    }

    if (this.state.modes.tank_level === "auto" && this.sensors.water_level.state === "low" && !this.state.pump_tank) {
      this.state.pump_tank = true;
      this.tankRunTicks = 0;
      this.addEvent("auto_tank_fill", "Tank level low; fill pump started automatically.");
    }

    // Process pending commands
    this.commands = this.commands.map((cmd) => {
      if (cmd.status === "pending") {
        return { ...cmd, status: "completed", processed_at: now };
      }
      return cmd;
    });
  }

  public issueCommand(type: string, val: string) {
    const now = new Date().toISOString();
    const cmd: Command = {
      id: `cmd-${Date.now()}`,
      device_id: this.device.id,
      command_type: type,
      value: val,
      created_at: now,
      processed_at: now,
      status: "completed",
    };
    this.commands.unshift(cmd);

    const upperVal = val.toUpperCase();
    if (type === "LIGHT") this.state.light = upperVal === "ON";
    else if (type === "FAN") this.state.fan = upperVal === "ON";
    else if (type === "DOOR") this.state.door = upperVal === "OPEN" ? "open" : "closed";
    else if (type === "CLOTHES_DRYER") this.state.clothes_dryer = upperVal === "EXTEND" ? "extended" : "retracted";
    else if (type === "PUMP_SOIL") this.state.pump_soil = upperVal === "ON";
    else if (type === "PUMP_TANK") this.state.pump_tank = upperVal === "ON";
    else if (type === "MODE") {
      const [t, m] = val.split(":");
      if (t in this.state.modes) {
        (this.state.modes as any)[t] = m;
      }
    }
  }

  public setSetting(name: AutomationName, patch: Partial<AutomationSetting>) {
    this.settings = this.settings.map((s) => (s.automation_name === name ? { ...s, ...patch } : s));
  }

  public ackAlert(id: string) {
    this.alerts = this.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
  }

  public ackAllAlerts() {
    this.alerts = this.alerts.map((a) => ({ ...a, acknowledged: true }));
  }

  private addEvent(event_type: string, message: string) {
    this.events.unshift({
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      device_id: this.device.id,
      event_type,
      message,
      created_at: new Date().toISOString(),
    });
    if (this.events.length > 50) this.events.pop();
  }

  public snapshot(): HomeSnapshot {
    return {
      device: { ...this.device },
      state: { ...this.state, modes: { ...this.state.modes } },
      sensors: { ...this.sensors },
      settings: [...this.settings],
      alerts: [...this.alerts],
      commands: [...this.commands],
      events: [...this.events],
      mode: "HOME",
    };
  }
}
