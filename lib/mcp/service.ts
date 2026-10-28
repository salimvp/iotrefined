import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ALL_SETTINGS } from "@/lib/config";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { AutomationName, ControlMode, HomeMode } from "@/lib/types";

/**
 * Data access for the MCP endpoint.
 *
 * Every function here goes through the same publishable (anon) credentials and
 * the same RPC the browser dashboard uses, so an MCP client has exactly the
 * privileges of a logged-out visitor: Row Level Security still applies, and no
 * service-role key is ever needed or used.
 */

/** Matches DEVICE_ONLINE_WINDOW_MS in lib/store.tsx: the board publishes every 15 s. */
const ONLINE_WINDOW_MS = 120_000;

/** Matches SENSOR_STALE_MS in lib/store.tsx: older than a few batches means "not reporting". */
const STALE_MS = 90_000;

/** Command values the firmware understands, per command type. */
const COMMAND_VALUES: Record<string, readonly string[]> = {
  LIGHT: ["ON", "OFF"],
  FAN: ["ON", "OFF"],
  DOOR: ["OPEN", "CLOSE"],
  CLOTHES_DRYER: ["EXTEND", "RETRACT"],
  PUMP_SOIL: ["ON", "OFF"],
  PUMP_TANK: ["ON", "OFF"],
};

/** Targets accepted by the `MODE` command — the keys of DeviceState["modes"]. */
const CONTROL_TARGETS = ["light", "fan", "door", "clothes_dryer", "watering", "tank_level"] as const;

const HOME_MODES: readonly HomeMode[] = ["HOME", "AWAY", "SLEEP", "EMERGENCY"];

export const KNOWN_COMMAND_TYPES = Object.keys(COMMAND_VALUES);
export const KNOWN_CONTROL_TARGETS = CONTROL_TARGETS;
export const KNOWN_HOME_MODES = HOME_MODES;
export const KNOWN_AUTOMATION_KEYS = ALL_SETTINGS.map((s) => s.name);

/** A fresh, unauthenticated client per invocation: serverless functions must not share sockets. */
export function getDb(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured on this deployment. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the hosting environment (Vercel → Settings → " +
        "Environment Variables), then redeploy — NEXT_PUBLIC_* values are baked in at build time.",
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

export function resolveDeviceId(override?: string | null): string {
  const id = override?.trim() || process.env.NEXT_PUBLIC_DEFAULT_DEVICE_ID || "00000000-0000-0000-0000-000000000002";
  return id;
}

function ageSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.round(ms / 1000) : null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface HomeStatus {
  device: {
    id: string;
    name: string;
    online: boolean;
    last_seen_at: string | null;
    seconds_since_seen: number | null;
    firmware_version: string | null;
    ip_address: string | null;
    rssi: number | null;
  };
  home_mode: HomeMode | string | null;
  actuators: Record<string, boolean | string>;
  control_modes: Record<string, string>;
  state_updated_at: string | null;
}

export async function getStatus(deviceId: string): Promise<HomeStatus> {
  const sb = getDb();
  const [deviceRes, stateRes] = await Promise.all([
    sb
      .from("devices")
      .select("id, home_id, name, device_type, firmware_version, last_seen_at, ip_address, rssi")
      .eq("id", deviceId)
      .maybeSingle(),
    sb
      .from("device_states")
      .select("device_id, reported_state, modes, updated_at")
      .eq("device_id", deviceId)
      .maybeSingle(),
  ]);

  if (deviceRes.error) throw new Error(`devices query failed: ${deviceRes.error.message}`);
  if (!deviceRes.data) {
    throw new Error(
      `No device row with id ${deviceId}. This must be devices.id (a UUID), not the hardware_id string. ` +
        "Set NEXT_PUBLIC_DEFAULT_DEVICE_ID or pass device_id explicitly.",
    );
  }

  const row = deviceRes.data as Record<string, any>;
  const reported = (stateRes.data?.reported_state ?? {}) as Record<string, any>;
  const modes = (stateRes.data?.modes ?? {}) as Record<string, string>;
  const seen = (row.last_seen_at as string | null) ?? null;
  const seenAge = ageSeconds(seen);

  let homeMode: string | null = null;
  if (row.home_id) {
    const { data } = await sb.from("home_modes").select("current_mode").eq("home_id", row.home_id).maybeSingle();
    homeMode = (data?.current_mode as string) ?? null;
  }

  return {
    device: {
      id: row.id,
      name: row.name ?? null,
      // Derived, not stored: the table has no `online` column.
      online: seenAge !== null && seenAge * 1000 < ONLINE_WINDOW_MS,
      last_seen_at: seen,
      seconds_since_seen: seenAge,
      firmware_version: row.firmware_version ?? null,
      ip_address: row.ip_address ?? null,
      rssi: row.rssi ?? null,
    },
    home_mode: homeMode,
    actuators: {
      light: reported.light ?? null,
      fan: reported.fan ?? null,
      door: reported.door ?? null,
      clothes_dryer: reported.clothes_dryer ?? null,
      pump_soil: reported.pump_soil ?? null,
      pump_tank: reported.pump_tank ?? null,
      buzzer: reported.buzzer ?? null,
    },
    control_modes: modes,
    state_updated_at: (stateRes.data?.updated_at as string | undefined) ?? null,
  };
}

export async function getSensors(deviceId: string) {
  const sb = getDb();
  const { data, error } = await sb.from("sensor_latest").select("*").eq("device_id", deviceId);
  if (error) throw new Error(`sensor_latest query failed: ${error.message}`);

  const rows = (data ?? []) as Record<string, any>[];
  const sensors = rows
    .map((row) => {
      const updated = (row.updated_at ?? row.recorded_at ?? null) as string | null;
      const age = ageSeconds(updated);
      return {
        sensor: String(row.sensor_type ?? "unknown"),
        value: row.numeric_value ?? null,
        details: row.reading_json ?? null,
        updated_at: updated,
        age_seconds: age,
        stale: age === null || age * 1000 > STALE_MS,
      };
    })
    .sort((a, b) => a.sensor.localeCompare(b.sensor));

  return {
    device_id: deviceId,
    stale_threshold_seconds: Math.round(STALE_MS / 1000),
    sensors,
    note:
      sensors.length === 0
        ? "No sensor readings stored. The board has not published telemetry yet, so every reading is unknown — do not guess values."
        : undefined,
  };
}

export async function listAlerts(deviceId: string, opts: { limit: number; unacknowledgedOnly?: boolean }) {
  const sb = getDb();
  let query = sb.from("alerts").select("id, alert_type, severity, title, message, acknowledged, created_at").eq("device_id", deviceId);
  if (opts.unacknowledgedOnly) query = query.eq("acknowledged", false);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(opts.limit);
  if (error) throw new Error(`alerts query failed: ${error.message}`);
  return { device_id: deviceId, count: data?.length ?? 0, alerts: data ?? [] };
}

export async function listCommands(deviceId: string, opts: { limit: number }) {
  const sb = getDb();
  const { data, error } = await sb
    .from("commands")
    .select("id, command_type, value, status, created_at, completed_at, error_code, error_message")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(opts.limit);
  if (error) throw new Error(`commands query failed: ${error.message}`);
  return { device_id: deviceId, count: data?.length ?? 0, commands: data ?? [] };
}

export async function listAutomationSettings(deviceId: string) {
  const sb = getDb();
  const { data, error } = await sb
    .from("automation_settings")
    .select("automation_key, is_enabled, threshold, secondary_threshold, duration, updated_at")
    .eq("device_id", deviceId);
  if (error) throw new Error(`automation_settings query failed: ${error.message}`);

  const rows = (data ?? []) as Record<string, any>[];
  return {
    device_id: deviceId,
    // Rows are returned as stored. A key with no row is still configurable —
    // the firmware falls back to the defaults below.
    settings: rows.map((r) => ({
      automation_key: r.automation_key,
      enabled: r.is_enabled,
      threshold: r.threshold,
      secondary_threshold: r.secondary_threshold,
      duration: r.duration,
      updated_at: r.updated_at,
    })),
    catalog: ALL_SETTINGS.map((s) => ({
      automation_key: s.name,
      title: s.title,
      group: s.group,
      fields: s.fields.map((f) => ({ key: f.key, label: f.label, unit: f.unit, min: f.min, max: f.max })),
      defaults: s.defaults,
    })),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function sendCommand(deviceId: string, commandType: string, rawValue: string) {
  const type = commandType.trim().toUpperCase();
  const allowed = COMMAND_VALUES[type];
  if (!allowed) {
    throw new Error(`Unsupported command_type "${commandType}". Use one of: ${KNOWN_COMMAND_TYPES.join(", ")}.`);
  }
  const value = rawValue.trim().toUpperCase();
  if (!allowed.includes(value)) {
    throw new Error(`Invalid value "${rawValue}" for ${type}. Allowed: ${allowed.join(", ")}.`);
  }

  const sb = getDb();
  const { error } = await sb.rpc("submit_device_command", {
    p_device_id: deviceId,
    p_command_type: type,
    p_value: value,
    // Kept as "web" (the value the dashboard sends): the RPC's source column is
    // constrained and an unknown value would reject the command outright.
    p_source: "web",
  });
  if (error) throw new Error(`submit_device_command failed: ${error.message}`);

  return {
    queued: true,
    device_id: deviceId,
    command_type: type,
    value,
    note: "Queued for the board. It is confirmed only when reported_state changes (the board polls every ~15 s).",
  };
}

export async function setControlMode(deviceId: string, target: string, mode: ControlMode) {
  if (!CONTROL_TARGETS.includes(target as (typeof CONTROL_TARGETS)[number])) {
    throw new Error(`Invalid target "${target}". Allowed: ${CONTROL_TARGETS.join(", ")}.`);
  }
  return sendCommand(deviceId, "MODE", `${target}:${mode}`);
}

export async function setHomeMode(deviceId: string, mode: HomeMode) {
  if (!HOME_MODES.includes(mode)) throw new Error(`Invalid home mode "${mode}". Allowed: ${HOME_MODES.join(", ")}.`);

  const sb = getDb();
  const { data: device, error: deviceError } = await sb.from("devices").select("home_id").eq("id", deviceId).maybeSingle();
  if (deviceError) throw new Error(`devices query failed: ${deviceError.message}`);
  const homeId = (device?.home_id as string | undefined) ?? null;
  if (!homeId) throw new Error(`Device ${deviceId} has no home_id, so a home mode cannot be set.`);

  const { data, error } = await sb.from("home_modes").update({ current_mode: mode }).eq("home_id", homeId).select("home_id, current_mode").maybeSingle();
  if (error) throw new Error(`home_modes update failed: ${error.message}`);
  return { updated: true, home_id: homeId, current_mode: data?.current_mode ?? mode };
}

export async function acknowledgeAlerts(deviceId: string, alertId?: string) {
  const sb = getDb();
  const patch = { acknowledged: true, acknowledged_at: new Date().toISOString() };

  if (alertId) {
    const { data, error } = await sb.from("alerts").update(patch).eq("id", alertId).eq("device_id", deviceId).select("id").maybeSingle();
    if (error) throw new Error(`alerts update failed: ${error.message}`);
    if (!data) throw new Error(`No alert ${alertId} for device ${deviceId}.`);
    return { acknowledged: 1, alert_id: alertId };
  }

  const { data, error } = await sb.from("alerts").update(patch).eq("device_id", deviceId).eq("acknowledged", false).select("id");
  if (error) throw new Error(`alerts update failed: ${error.message}`);
  return { acknowledged: data?.length ?? 0 };
}

export interface SettingPatch {
  enabled?: boolean;
  threshold?: number | null;
  secondary_threshold?: number | null;
  duration?: number | null;
}

export async function updateAutomationSetting(deviceId: string, key: AutomationName, patch: SettingPatch) {
  const meta = ALL_SETTINGS.find((s) => s.name === key);
  if (!meta) throw new Error(`Unknown automation_key "${key}". Allowed: ${KNOWN_AUTOMATION_KEYS.join(", ")}.`);

  // Validate against the same min/max the dashboard's sliders enforce. This is a
  // physical-safety boundary, not cosmetics: a threshold outside range makes the
  // firmware automation fire (or never fire) at the wrong physical condition.
  for (const [field, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    if (field === "enabled") continue;
    const fieldMeta = meta.fields.find((f) => f.key === field);
    if (!fieldMeta) continue;
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`${field} for ${key} must be a number.`);
    }
    if (value < fieldMeta.min || value > fieldMeta.max) {
      throw new Error(`${field} for ${key} must be between ${fieldMeta.min} and ${fieldMeta.max} ${fieldMeta.unit}.`);
    }
  }
  if (Object.keys(patch).length === 0) throw new Error("No changes supplied.");

  const sb = getDb();
  const { data: device, error: deviceError } = await sb.from("devices").select("home_id").eq("id", deviceId).maybeSingle();
  if (deviceError) throw new Error(`devices query failed: ${deviceError.message}`);
  const homeId = (device?.home_id as string | undefined) ?? null;
  if (!homeId) throw new Error(`Device ${deviceId} has no home_id, so a setting cannot be stored.`);

  // Merge with the stored row so a partial patch cannot null out the columns the
  // caller did not mention (upsert only updates the columns it is given).
  const { data: existing } = await sb
    .from("automation_settings")
    .select("is_enabled, threshold, secondary_threshold, duration")
    .eq("device_id", deviceId)
    .eq("automation_key", key)
    .maybeSingle();

  const current = existing as Record<string, any> | null;
  const payload = {
    home_id: homeId,
    device_id: deviceId,
    automation_key: key,
    is_enabled: patch.enabled ?? current?.is_enabled ?? meta.defaults.enabled,
    threshold: patch.threshold !== undefined ? patch.threshold : (current?.threshold ?? meta.defaults.threshold),
    secondary_threshold:
      patch.secondary_threshold !== undefined ? patch.secondary_threshold : (current?.secondary_threshold ?? meta.defaults.secondary_threshold),
    duration: patch.duration !== undefined ? patch.duration : (current?.duration ?? meta.defaults.duration),
  };

  const { data, error } = await sb
    .from("automation_settings")
    .upsert(payload, { onConflict: "device_id,automation_key" })
    .select("automation_key, is_enabled, threshold, secondary_threshold, duration")
    .maybeSingle();
  if (error) throw new Error(`automation_settings upsert failed: ${error.message}`);

  return { updated: true, device_id: deviceId, setting: data };
}
