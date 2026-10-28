"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { defaultSettings } from "./config";
import { DemoEngine } from "./demo";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";
import {
  type Alert,
  type AutomationName,
  type AutomationSetting,
  type Command,
  type ControlMode,
  type Device,
  type DeviceEvent,
  type DeviceState,
  type HomeMode,
  type HomeSnapshot,
  type SensorKey,
  type SensorSnapshot,
} from "./types";

/** Every sensor key the ESP32 can report. */
const SENSOR_KEYS: SensorKey[] = ["ldr", "gas", "flame", "soil", "water_level", "rain", "dustbin", "dht", "pir", "reed"];

/**
 * A reading older than this is no longer live: the firmware publishes a full
 * batch every 15 s, so anything older than a few batches means the sensor (or
 * the board) stopped reporting. Cards show "no data" instead of a stale value.
 */
export const SENSOR_STALE_MS = 90_000;

/** True when `key` has no reading, or its last reading is older than SENSOR_STALE_MS. */
export function isSensorStale(snapshot: HomeSnapshot, key: SensorKey): boolean {
  const seen = snapshot.sensors.freshness[key];
  if (!seen) return true;
  const age = Date.now() - new Date(seen).getTime();
  return !Number.isFinite(age) || age > SENSOR_STALE_MS;
}

export const DEFAULT_DEVICE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID || "00000000-0000-0000-0000-000000000002";

const FIRMWARE_VERSION = "1.0.0";

type Mode = "live" | "demo";

interface InFlight {
  value: string;
  at: number;
}

interface HomeContextValue {
  ready: boolean;
  mode: Mode;
  snapshot: HomeSnapshot;
  inFlight: Record<string, InFlight>;
  sendCommand: (command_type: string, value: string) => Promise<void>;
  setControlMode: (target: keyof DeviceState["modes"], mode: ControlMode) => Promise<void>;
  setHomeMode: (mode: HomeMode) => Promise<void>;
  updateSetting: (name: AutomationName, patch: Partial<AutomationSetting>) => Promise<void>;
  ackAlert: (id: string) => Promise<void>;
  ackAllAlerts: () => Promise<void>;
  refresh: () => Promise<void>;
}

const HomeContext = createContext<HomeContextValue | null>(null);

/** A `devices` row as it actually comes back from Postgres (no `online` column). */
type DeviceRow = {
  id: string;
  home_id?: string;
  name?: string;
  device_type?: string;
  firmware_version?: string;
  last_seen_at?: string | null;
  ip_address?: string | null;
  rssi?: number | null;
};

type StateRow = {
  device_id: string;
  reported_state?: Partial<DeviceState>;
  modes?: Partial<DeviceState["modes"]>;
  updated_at?: string;
};

type SettingRow = Omit<AutomationSetting, "automation_name" | "enabled"> & {
  automation_key: AutomationName;
  is_enabled: boolean;
};

type CommandRow = Omit<Command, "processed_at"> & { completed_at?: string | null };

// The firmware publishes telemetry every 15s (TELEMETRY_PUBLISH_INTERVAL_MS in esp32.ino)
// and `ingest-sensor-data` refreshes `devices.last_seen_at` on every upload. The table has
// no `online` column, so liveness is derived from that timestamp, using the same 2-minute
// window the command RPCs use to expire stale commands.
const DEVICE_ONLINE_WINDOW_MS = 120_000;

/** Re-derived on a timer too, so a board that stops reporting does not stay "online". */
function isDeviceOnline(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false;
  const age = Date.now() - new Date(lastSeen).getTime();
  return Number.isFinite(age) && age < DEVICE_ONLINE_WINDOW_MS;
}

function mapDevice(row: DeviceRow, fallback: Device): Device {
  const lastSeen = row.last_seen_at ?? null;
  return {
    ...fallback,
    id: row.id,
    name: row.name ?? fallback.name,
    device_type: row.device_type ?? fallback.device_type,
    firmware_version: row.firmware_version ?? fallback.firmware_version,
    ip_address: row.ip_address ?? null,
    rssi: row.rssi ?? null,
    last_seen: lastSeen,
    online: isDeviceOnline(lastSeen),
  };
}

function mapState(row: StateRow, fallback: DeviceState): DeviceState {
  const reported = row.reported_state ?? {};
  return {
    ...fallback,
    ...reported,
    device_id: row.device_id ?? fallback.device_id,
    modes: { ...fallback.modes, ...(row.modes ?? {}) },
    updated_at: row.updated_at ?? fallback.updated_at,
  };
}

function mapSetting(row: SettingRow): AutomationSetting {
  return {
    device_id: row.device_id,
    automation_name: row.automation_key,
    enabled: row.is_enabled,
    threshold: row.threshold,
    secondary_threshold: row.secondary_threshold,
    duration: row.duration,
    updated_at: row.updated_at,
  };
}

function mapCommand(row: CommandRow): Command {
  return { ...row, processed_at: row.completed_at ?? null };
}

function isHomeMode(value: unknown): value is HomeMode {
  return value === "HOME" || value === "AWAY" || value === "SLEEP" || value === "EMERGENCY";
}

function emptySnapshot(deviceId: string): HomeSnapshot {
  const now = new Date().toISOString();
  // Placeholder only: `online` stays false and `last_seen` null until the
  // `devices` row is actually read, so a failed fetch cannot look like a
  // healthy board.
  const device: Device = {
    id: deviceId,
    name: "ESP32 Smart Home",
    device_type: "esp32_nodemcu_30pin",
    online: false,
    last_seen: null,
    firmware_version: FIRMWARE_VERSION,
  };
  const state: DeviceState = {
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
  const sensors: SensorSnapshot = {
    ldr: { raw: 900, state: "bright" },
    gas: { raw: 420, level: "normal" },
    flame: { detected: false, raw: 0 },
    soil: { raw: 2150, percent: 55, state: "normal" },
    water_level: { raw: 0, percent: 0, state: "empty" },
    rain: { detected: false, raw: 0 },
    dustbin: { distance_cm: 22, percent: 35, state: "normal" },
    dht: { temperature: 25.4, humidity: 58 },
    pir: { motion: false, last_motion_at: null },
    reed: { state: "closed", last_change_at: now, mismatch: false },
    freshness: {},
    updated_at: now,
  };
  return {
    device,
    state,
    sensors,
    settings: defaultSettings(deviceId),
    alerts: [],
    commands: [],
    events: [],
    mode: "HOME",
  };
}

export function HomeProvider({
  children,
  deviceId = DEFAULT_DEVICE_ID,
}: {
  children: ReactNode;
  deviceId?: string;
}) {
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<HomeSnapshot>(() => emptySnapshot(deviceId));
  const [inFlight, setInFlight] = useState<Record<string, InFlight>>({});
  const mode: Mode = isSupabaseConfigured ? "live" : "demo";

  const demoRef = useRef<DemoEngine | null>(null);
  const homeIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------
  // DEMO MODE — Local Engine
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "demo") return;
    const engine = new DemoEngine(deviceId, "ESP32 Smart Home", FIRMWARE_VERSION);
    demoRef.current = engine;
    setSnapshot(engine.snapshot());
    setReady(true);
    const t = setInterval(() => {
      engine.tick();
      setSnapshot(engine.snapshot());
      setInFlight((prev) => reconcile(prev, engine.snapshot().state));
    }, 1000);
    return () => clearInterval(t);
  }, [mode, deviceId]);

  // ---------------------------------------------------------------------
  // LIVE MODE — Supabase Realtime
  // ---------------------------------------------------------------------
  const loadAll = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [deviceRes, stateRes, settingsRes, alertsRes, commandsRes, readingsRes] =
      await Promise.all([
        supabase.from("devices").select("*").eq("id", deviceId).maybeSingle(),
        supabase.from("device_states").select("device_id, reported_state, modes, updated_at").eq("device_id", deviceId).maybeSingle(),
        supabase.from("automation_settings").select("*").eq("device_id", deviceId),
        supabase.from("alerts").select("*").eq("device_id", deviceId).order("created_at", { ascending: false }).limit(100),
        supabase.from("commands").select("id, device_id, command_type, value, created_at, completed_at, status, error_code, error_message").eq("device_id", deviceId).order("created_at", { ascending: false }).limit(40),
        supabase.from("sensor_latest").select("*").eq("device_id", deviceId),
      ]);

    const base = emptySnapshot(deviceId);
    const next: HomeSnapshot = { ...base };

    if (deviceRes.data) {
      const device = deviceRes.data as DeviceRow;
      homeIdRef.current = device.home_id ?? null;
      next.device = mapDevice(device, base.device);
      if (homeIdRef.current) {
        const { data: homeMode } = await supabase
          .from("home_modes")
          .select("current_mode")
          .eq("home_id", homeIdRef.current)
          .maybeSingle();
        if (homeMode && isHomeMode(homeMode.current_mode)) next.mode = homeMode.current_mode;
      }
    }
    if (stateRes.data) {
      next.state = mapState(stateRes.data as StateRow, base.state);
    }
    if (settingsRes.data?.length) {
      const loaded = (settingsRes.data as SettingRow[]).map(mapSetting);
      next.settings = base.settings.map((fallback) => loaded.find((setting) => setting.automation_name === fallback.automation_name) ?? fallback);
    }
    if (alertsRes.data) next.alerts = alertsRes.data as Alert[];
    if (commandsRes.data) next.commands = (commandsRes.data as CommandRow[]).map(mapCommand);
    if (readingsRes.data?.length) next.sensors = mapLatestReadings(readingsRes.data, next);

    setSnapshot(next);
  }, [deviceId]);

  useEffect(() => {
    if (mode !== "live") return;
    const supabase = getSupabase();
    if (!supabase) return;
    loadAll().finally(() => setReady(true));

    const channel = supabase
      .channel(`smart-home:${deviceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "device_states", filter: `device_id=eq.${deviceId}` }, (p) => {
        const row = p.new as StateRow;
        const state = mapState(row, emptySnapshot(deviceId).state);
        setSnapshot((prev) => ({ ...prev, state: mapState(row, prev.state) }));
        setInFlight((prev) => reconcile(prev, state));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sensor_latest", filter: `device_id=eq.${deviceId}` }, (p) => {
        setSnapshot((prev) => ({ ...prev, sensors: applyLatestReading(prev.sensors, p.new as Record<string, unknown>) }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `device_id=eq.${deviceId}` }, (p) => {
        setSnapshot((prev) => mergeAlert(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "commands", filter: `device_id=eq.${deviceId}` }, (p) => {
        setSnapshot((prev) => mergeCommand(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_settings", filter: `device_id=eq.${deviceId}` }, (p) => {
        setSnapshot((prev) => mergeSetting(prev, p));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `id=eq.${deviceId}` }, (p) => {
        setSnapshot((prev) => ({ ...prev, device: mapDevice(p.new as DeviceRow, prev.device) }));
      })
      .subscribe();

    // `devices` only pushes a row when a column changes, so re-check liveness on a timer:
    // otherwise a board that dies keeps showing its last known "online" state forever.
    const livenessTimer = setInterval(() => {
      setSnapshot((prev) => {
        const online = isDeviceOnline(prev.device.last_seen);
        if (online === prev.device.online) return prev;
        return { ...prev, device: { ...prev.device, online } };
      });
    }, 15_000);

    return () => {
      clearInterval(livenessTimer);
      void supabase.removeChannel(channel);
    };
  }, [mode, deviceId, loadAll]);

  // ---------------------------------------------------------------------
  // User Actions
  // ---------------------------------------------------------------------
  const sendCommand = useCallback(
    async (command_type: string, value: string) => {
      setInFlight((prev) => ({ ...prev, [command_type]: { value, at: Date.now() } }));
      if (mode === "demo") {
        demoRef.current?.issueCommand(command_type, value);
        return;
      }
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.rpc("submit_device_command", {
        p_device_id: deviceId,
        p_command_type: command_type,
        p_value: value,
        p_source: "web",
      });
      if (error) throw new Error(error.message);
    },
    [mode, deviceId],
  );

  const setControlMode = useCallback(
    async (target: keyof DeviceState["modes"], value: ControlMode) => {
      if (mode === "demo") {
        demoRef.current?.issueCommand("MODE", `${target}:${value}`);
        return;
      }
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.rpc("submit_device_command", {
        p_device_id: deviceId,
        p_command_type: "MODE",
        p_value: `${target}:${value}`,
        p_source: "web",
      });
      if (error) throw new Error(error.message);
    },
    [mode, deviceId],
  );

  const setHomeMode = useCallback(
    async (m: HomeMode) => {
      setSnapshot((prev) => ({ ...prev, mode: m }));
      if (mode === "demo") return;
      const supabase = getSupabase();
      if (!supabase) return;
      if (!homeIdRef.current) throw new Error("Home information has not loaded yet");
      const { error } = await supabase.from("home_modes").update({ current_mode: m }).eq("home_id", homeIdRef.current);
      if (error) throw new Error(error.message);
    },
    [mode],
  );

  const updateSetting = useCallback(
    async (name: AutomationName, patch: Partial<AutomationSetting>) => {
      if (mode === "demo") {
        demoRef.current?.setSetting(name, patch);
        setSnapshot((prev) => ({ ...prev, settings: prev.settings.map((s) => (s.automation_name === name ? { ...s, ...patch } : s)) }));
        return;
      }
      const supabase = getSupabase();
      if (!supabase) return;
      if (!homeIdRef.current) throw new Error("Home information has not loaded yet");
      const { error } = await supabase
        .from("automation_settings")
        .upsert(
          {
            home_id: homeIdRef.current,
            device_id: deviceId,
            automation_key: name,
            is_enabled: patch.enabled,
            threshold: patch.threshold,
            secondary_threshold: patch.secondary_threshold,
            duration: patch.duration,
          },
          { onConflict: "device_id,automation_key" },
        );
      if (error) throw new Error(error.message);
    },
    [mode, deviceId],
  );

  const ackAlert = useCallback(
    async (id: string) => {
      if (mode === "demo") {
        demoRef.current?.ackAlert(id);
        setSnapshot((prev) => ({ ...prev, alerts: prev.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) }));
        return;
      }
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.from("alerts").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    [mode],
  );

  const ackAllAlerts = useCallback(async () => {
    if (mode === "demo") {
      demoRef.current?.ackAllAlerts();
      setSnapshot((prev) => ({ ...prev, alerts: prev.alerts.map((a) => ({ ...a, acknowledged: true })) }));
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.from("alerts").update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq("device_id", deviceId).eq("acknowledged", false);
    if (error) throw new Error(error.message);
  }, [mode, deviceId]);

  const refresh = useCallback(async () => {
    if (mode === "demo") {
      if (demoRef.current) setSnapshot(demoRef.current.snapshot());
      return;
    }
    await loadAll();
  }, [mode, loadAll]);

  const value = useMemo<HomeContextValue>(
    () => ({ ready, mode, snapshot, inFlight, sendCommand, setControlMode, setHomeMode, updateSetting, ackAlert, ackAllAlerts, refresh }),
    [ready, mode, snapshot, inFlight, sendCommand, setControlMode, setHomeMode, updateSetting, ackAlert, ackAllAlerts, refresh],
  );

  return <HomeContext.Provider value={value}>{children}</HomeContext.Provider>;
}

export function useHome() {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHome must be used inside <HomeProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reconcile(inFlight: Record<string, InFlight>, state: DeviceState): Record<string, InFlight> {
  const next: Record<string, InFlight> = {};
  const expected: Record<string, string> = {
    LIGHT: state.light ? "ON" : "OFF",
    FAN: state.fan ? "ON" : "OFF",
    DOOR: state.door === "open" ? "OPEN" : "CLOSE",
    CLOTHES_DRYER: state.clothes_dryer === "extended" ? "EXTEND" : "RETRACT",
    PUMP_SOIL: state.pump_soil ? "ON" : "OFF",
    PUMP_TANK: state.pump_tank ? "ON" : "OFF",
  };
  for (const [key, val] of Object.entries(inFlight)) {
    const want = expected[key];
    const expired = Date.now() - val.at > 15_000;
    const satisfied = want && (val.value.toUpperCase() === want || want.startsWith(val.value.toUpperCase()));
    if (!expired && !satisfied) next[key] = val;
  }
  return next;
}

function mapLatestReadings(rows: Record<string, unknown>[], snapshot: HomeSnapshot): SensorSnapshot {
  let sensors = { ...snapshot.sensors };
  for (const row of rows) {
    sensors = applyLatestReading(sensors, row);
  }
  return sensors;
}

function applyLatestReading(sensors: SensorSnapshot, row: Record<string, unknown>): SensorSnapshot {
  const type = String(row.sensor_type ?? "");
  const value = Number(row.numeric_value ?? 0);
  const json = (row.reading_json as Record<string, any>) ?? {};
  const created = String(row.updated_at ?? row.recorded_at ?? new Date().toISOString());
  const next: SensorSnapshot = {
    ...sensors,
    updated_at: created,
    freshness: SENSOR_KEYS.includes(type as SensorKey)
      ? { ...sensors.freshness, [type]: created }
      : sensors.freshness,
  };

  switch (type) {
    case "ldr":
      // This rig's LDR module outputs a HIGHER count in the dark, so the
      // dark/bright label is the reverse of a typical divider: bright below
      // 1200 raw, dark above it.
      next.ldr = { raw: value, state: value >= 1200 ? "dark" : "bright" };
      break;
    case "gas": {
      // The MQ-2 is sampled from its digital DO pin, so numeric_value is 1/0 and
      // must not be compared against the raw ADC thresholds. Trust the level the
      // firmware reports and only derive it from raw counts for analog wiring.
      const raw = Number(json.raw ?? value);
      const reported = json.level;
      const level =
        reported === "warning" || reported === "danger" || reported === "normal"
          ? reported
          : raw >= 2600
            ? "danger"
            : raw >= 1600
              ? "warning"
              : "normal";
      next.gas = { raw, level };
      break;
    }
    case "flame":
      next.flame = { detected: value > 0 || json.detected === true, raw: json.raw ?? value };
      break;
    case "soil":
      next.soil = { raw: json.raw ?? value, percent: value, state: value < 30 ? "dry" : value > 70 ? "wet" : "normal" };
      break;
    case "water_level": {
      // Trust the firmware's derived state (it knows the calibrated empty/full
      // counts and whether the probe reading is plausible) and fall back to the
      // percentage bands only when it is missing.
      const reported = json.state;
      const state =
        reported === "empty" || reported === "low" || reported === "ok" || reported === "full"
          ? reported
          : value <= 5
            ? "empty"
            : value < 30
              ? "low"
              : value >= 85
                ? "full"
                : "ok";
      next.water_level = { raw: Number(json.raw ?? value), percent: value, state };
      break;
    }
    case "rain":
      next.rain = { detected: value > 0 || json.detected === true, raw: json.raw ?? value };
      break;
    case "dustbin":
      next.dustbin = {
        distance_cm: json.distance_cm ?? 20,
        percent: value,
        state: value >= 90 ? "full" : value >= 75 ? "almost_full" : "normal",
      };
      break;
    case "dht":
      next.dht = { temperature: json.temperature ?? value, humidity: json.humidity ?? 50 };
      break;
    case "pir":
      next.pir = { motion: value > 0, last_motion_at: value > 0 ? created : sensors.pir.last_motion_at };
      break;
    case "reed":
      next.reed = {
        state: value > 0 ? "open" : "closed",
        last_change_at: created,
        mismatch: sensors.reed.mismatch,
      };
      break;
    default:
      break;
  }
  return next;
}

function mergeAlert(prev: HomeSnapshot, payload: { new: unknown }): HomeSnapshot {
  const row = payload.new as Alert | undefined;
  if (!row) return prev;
  const existing = prev.alerts.findIndex((a) => a.id === row.id);
  if (existing >= 0) {
    const alerts = [...prev.alerts];
    alerts[existing] = row;
    return { ...prev, alerts };
  }
  return { ...prev, alerts: [row, ...prev.alerts].slice(0, 100) };
}

function mergeCommand(prev: HomeSnapshot, payload: { new: unknown }): HomeSnapshot {
  const source = payload.new as CommandRow | undefined;
  const row = source ? mapCommand(source) : undefined;
  if (!row) return prev;
  const idx = prev.commands.findIndex((c) => c.id === row.id);
  const commands = idx >= 0 ? prev.commands.map((c) => (c.id === row.id ? row : c)) : [row, ...prev.commands];
  return { ...prev, commands: commands.slice(0, 40) };
}

function mergeSetting(prev: HomeSnapshot, payload: { new: unknown }): HomeSnapshot {
  const source = payload.new as SettingRow | undefined;
  const row = source ? mapSetting(source) : undefined;
  if (!row) return prev;
  const idx = prev.settings.findIndex((s) => s.automation_name === row.automation_name);
  const settings =
    idx >= 0 ? prev.settings.map((s) => (s.automation_name === row.automation_name ? row : s)) : [...prev.settings, row];
  return { ...prev, settings };
}
