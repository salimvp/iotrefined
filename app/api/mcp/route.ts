import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import * as svc from "@/lib/mcp/service";

/**
 * Remote MCP server for the smart-home dashboard, mounted as a normal Next.js
 * route so it deploys with the site (https://<project>.vercel.app/api/mcp).
 *
 * Transport is Streamable HTTP, which is what ChatGPT connectors and Claude
 * custom connectors speak. Vercel functions are stateless, so every request
 * builds its own Supabase client; nothing is cached between calls.
 *
 * NOTE: this endpoint is intentionally unauthenticated — anyone who learns the
 * URL can read the sensors and operate the relays. Keep the URL private, or add
 * a token check here before sharing it.
 */

export const runtime = "nodejs";
// Streamable HTTP may hold a response open while a tool runs; give it room.
export const maxDuration = 60;

const deviceIdArg = z
  .string()
  .min(1)
  .optional()
  .describe("Target device UUID. Defaults to NEXT_PUBLIC_DEFAULT_DEVICE_ID when omitted.");

/** Tools return JSON text: MCP clients that do not support structured output still get usable data. */
const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

/** Failures come back as tool errors (isError) instead of protocol errors, so the model can react. */
const fail = (err: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
  isError: true,
});

async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (err) {
    return fail(err);
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_home_status",
      {
        title: "Get home status",
        description:
          "Read the board's current state: whether the ESP32 is online (derived from last_seen, 2-minute window), " +
          "the reported actuator states (light, fan, door, clothes-dryer rack, soil pump, tank pump, buzzer), " +
          "each actuator's auto/manual control mode, and the home mode (HOME/AWAY/SLEEP/EMERGENCY). Start here.",
        inputSchema: z.object({ device_id: deviceIdArg }),
      },
      async ({ device_id }) => run(() => svc.getStatus(svc.resolveDeviceId(device_id))),
    );

    server.registerTool(
      "get_sensors",
      {
        title: "Get latest sensor readings",
        description:
          "Latest stored reading for every sensor: LDR ambient light (00 = bright), MQ-2 gas (raw + level), flame, " +
          "soil moisture %, tank water level %, rain, dustbin distance and fill %, DHT11 temperature (°C) and humidity (%), " +
          "PIR motion, and the door reed contact. Each entry carries age_seconds and a stale flag — a stale sensor means " +
          "the board stopped reporting, so the value must be treated as unknown, not as a live measurement.",
        inputSchema: z.object({ device_id: deviceIdArg }),
      },
      async ({ device_id }) => run(() => svc.getSensors(svc.resolveDeviceId(device_id))),
    );

    server.registerTool(
      "list_alerts",
      {
        title: "List alerts",
        description:
          "Recent alerts raised by the firmware or dashboard (flame, gas warning/danger, dustbin full, soil dry, " +
          "rain with clothes out, door mismatch, device online/offline), newest first.",
        inputSchema: z.object({
          device_id: deviceIdArg,
          limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of alerts to return."),
          unacknowledged_only: z.boolean().default(false).describe("Return only alerts that have not been acknowledged."),
        }),
      },
      async ({ device_id, limit, unacknowledged_only }) =>
        run(() => svc.listAlerts(svc.resolveDeviceId(device_id), { limit, unacknowledgedOnly: unacknowledged_only })),
    );

    server.registerTool(
      "list_recent_commands",
      {
        title: "List recent commands",
        description:
          "Recent commands sent to the board with their lifecycle status (pending → sent → received → completed, or " +
          "failed/expired). Use this to confirm whether an earlier command was actually picked up by the hardware.",
        inputSchema: z.object({
          device_id: deviceIdArg,
          limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of commands to return."),
        }),
      },
      async ({ device_id, limit }) => run(() => svc.listCommands(svc.resolveDeviceId(device_id), { limit })),
    );

    server.registerTool(
      "list_automation_settings",
      {
        title: "List automation settings",
        description:
          "Stored automation thresholds per device, plus the catalog of every configurable key with its title, group, " +
          "fields, units and the min/max range each value must stay inside, and the firmware defaults.",
        inputSchema: z.object({ device_id: deviceIdArg }),
      },
      async ({ device_id }) => run(() => svc.listAutomationSettings(svc.resolveDeviceId(device_id))),
    );

    server.registerTool(
      "send_device_command",
      {
        title: "Send a device command",
        description:
          "Queue a physical command for the ESP32. command_type/value pairs: " +
          "LIGHT ON|OFF, FAN ON|OFF, DOOR OPEN|CLOSE, CLOTHES_DRYER EXTEND|RETRACT, PUMP_SOIL ON|OFF, PUMP_TANK ON|OFF. " +
          "The command is queued, not executed synchronously: it completes only when the board polls (every ~15 s) and " +
          "reports the new state. These switch real mains/DC loads — confirm intent before calling.",
        inputSchema: z.object({
          device_id: deviceIdArg,
          command_type: z.string().describe("One of: LIGHT, FAN, DOOR, CLOTHES_DRYER, PUMP_SOIL, PUMP_TANK."),
          value: z.string().describe("ON/OFF for LIGHT, FAN and the pumps; OPEN/CLOSE for DOOR; EXTEND/RETRACT for CLOTHES_DRYER."),
        }),
      },
      async ({ device_id, command_type, value }) =>
        run(() => svc.sendCommand(svc.resolveDeviceId(device_id), command_type, value)),
    );

    server.registerTool(
      "set_control_mode",
      {
        title: "Set control mode",
        description:
          "Switch one actuator between 'auto' (the firmware's own threshold rules drive it) and 'manual' " +
          "(only explicit commands move it). Targets: light, fan, door, clothes_dryer, watering, tank_level.",
        inputSchema: z.object({
          device_id: deviceIdArg,
          target: z.string().describe("One of: light, fan, door, clothes_dryer, watering, tank_level."),
          mode: z.enum(["auto", "manual"]).describe("'auto' hands control to the firmware rules; 'manual' stops them."),
        }),
      },
      async ({ device_id, target, mode }) =>
        run(() => svc.setControlMode(svc.resolveDeviceId(device_id), target, mode)),
    );

    server.registerTool(
      "set_home_mode",
      {
        title: "Set home mode",
        description:
          "Set the whole-home mode: HOME, AWAY, SLEEP or EMERGENCY. This is the same switch the dashboard's mode " +
          "selector writes; the firmware decides how each mode behaves.",
        inputSchema: z.object({
          device_id: deviceIdArg,
          mode: z.enum(["HOME", "AWAY", "SLEEP", "EMERGENCY"]),
        }),
      },
      async ({ device_id, mode }) => run(() => svc.setHomeMode(svc.resolveDeviceId(device_id), mode)),
    );

    server.registerTool(
      "update_automation_setting",
      {
        title: "Update automation setting",
        description:
          "Change an automation's enabled flag, threshold, secondary_threshold or duration. Call list_automation_settings " +
          "first: every field has its own unit and min/max range, and out-of-range values are rejected here because a " +
          "wrong threshold makes the firmware act at the wrong physical condition (e.g. a fan threshold in °C).",
        inputSchema: z.object({
          device_id: deviceIdArg,
          automation_key: z
            .string()
            .describe("Setting key from the catalog, e.g. auto_light, auto_fan, auto_watering, auto_tank_fill, reporting."),
          enabled: z.boolean().optional().describe("Turn the automation on or off."),
          threshold: z.number().optional().describe("Primary threshold in the unit documented for this key."),
          secondary_threshold: z.number().optional().describe("Hysteresis / second threshold, where the key defines one."),
          duration: z.number().optional().describe("Duration field in seconds (or ms for the buzzer pulse)."),
        }),
      },
      async ({ device_id, automation_key, enabled, threshold, secondary_threshold, duration }) =>
        run(() =>
          svc.updateAutomationSetting(
            svc.resolveDeviceId(device_id),
            automation_key as Parameters<typeof svc.updateAutomationSetting>[1],
            { enabled, threshold, secondary_threshold, duration },
          ),
        ),
    );

    server.registerTool(
      "acknowledge_alerts",
      {
        title: "Acknowledge alerts",
        description:
          "Mark a single alert as acknowledged, or every unacknowledged alert on the device when alert_id is omitted.",
        inputSchema: z.object({
          device_id: deviceIdArg,
          alert_id: z.string().optional().describe("Specific alert UUID; omit to clear all unacknowledged alerts."),
        }),
      },
      async ({ device_id, alert_id }) => run(() => svc.acknowledgeAlerts(svc.resolveDeviceId(device_id), alert_id)),
    );
  },
  {
    serverInfo: { name: "iotrefined-smart-home", version: "1.0.0" },
    instructions:
      "Tools for an ESP32-based smart home: read status and sensor telemetry, operate relays and servos, and edit " +
      "automation thresholds. Actuator commands affect real hardware (a water pump, a door servo, a tank fill pump), so " +
      "confirm the user's intent before sending them. Sensor entries flagged stale are not live readings.",
    verboseLogs: false,
  },
);

// Streamable HTTP: POST carries JSON-RPC, GET opens the stream, DELETE ends a session.
export { handler as GET, handler as POST, handler as DELETE };
