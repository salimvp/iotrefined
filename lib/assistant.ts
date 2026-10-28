import type { ControlMode, HomeSnapshot } from "./types";

/**
 * Assistant logic shared by the API route and the chat UI.
 *
 * Grounding rules:
 *  1. The assistant may ONLY answer from the real snapshot passed in.
 *  2. Control requests become a `commands` insert (an action), not a paragraph of prose.
 */

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantAction {
  command_type: string;
  value: string;
  label: string;
}

const ON = /\b(on|open|extend|start|run|enable|activate|fill|refill|turn on|switch on|power on)\b/i;
const OFF = /\b(off|close|shut|retract|stop|disable|deactivate|turn off|switch off|power off)\b/i;
const IMPERATIVE_ON = /\b(irrigate)\b|\bwater\s+(the|my|it|plants?)\b/i;
const COMMAND_VERB = /\b(turn|switch|set|put|open|close|shut|start|stop|run|extend|retract|irrigate|enable|disable|activate|deactivate)\b|\bwater\s+(the|my|it|plants?)\b/i;
const QUESTION = /^(how|what|is|are|was|why|where|when|do|does|did|which|who|can|could|would|tell|show|give|any)\b/i;

/**
 * Natural-language names people actually use for each actuator.
 *
 * Intent matching happens HERE and not in the LLM: the model may read telemetry
 * and give advice, but a physical command must come from this deterministic
 * matcher, so a hallucinated sentence can never switch real hardware.
 */
const TARGET_LIGHT = /\b(light|lights|lamp|lamps|bulb|bulbs)\b/i;
const TARGET_FAN = /\b(fan|fans|vent|vents|ventilation|exhaust)\b/i;
const TARGET_DOOR = /\b(door|doors|gate)\b/i;
const TARGET_DRYER = /\b(dryer|dryers|rack|racks|clothes|clothesline)\b/i;
const TARGET_TANK = /\b(tank|tanks|reservoir|fill|fills|filling|refill|refilling)\b|water\s*level/i;
const TARGET_SOIL_PUMP =
  /\b(pump|soil|plant|plants|irrigate|irrigation|watering|flower|flowers|pot|pots)\b|\bwater\s+(the|my|it|plants?)\b/i;

/** Actuator name as the MODE command expects it (matches the DeviceModes keys). */
type ControlTarget = "light" | "fan" | "door" | "clothes_dryer" | "watering" | "tank_level";

/**
 * Which actuator a phrase refers to. The tank is checked before the plant pump
 * so "fill the water tank" is never read as watering.
 */
function detectActuator(t: string): ControlTarget | null {
  if (TARGET_LIGHT.test(t)) return "light";
  if (TARGET_FAN.test(t)) return "fan";
  if (TARGET_DOOR.test(t)) return "door";
  if (TARGET_DRYER.test(t)) return "clothes_dryer";
  if (TARGET_TANK.test(t)) return "tank_level";
  if (TARGET_SOIL_PUMP.test(t)) return "watering";
  return null;
}

const CONTROL_COMMAND: Record<ControlTarget, { type: string; on: string; off: string; label: string }> = {
  light: { type: "LIGHT", on: "ON", off: "OFF", label: "Light" },
  fan: { type: "FAN", on: "ON", off: "OFF", label: "Fan" },
  door: { type: "DOOR", on: "OPEN", off: "CLOSE", label: "Door" },
  clothes_dryer: { type: "CLOTHES_DRYER", on: "EXTEND", off: "RETRACT", label: "Clothes Rack" },
  tank_level: { type: "PUMP_TANK", on: "ON", off: "OFF", label: "Water Tank Fill Pump" },
  watering: { type: "PUMP_SOIL", on: "ON", off: "OFF", label: "Plant Watering Pump" },
};

export function parseAction(text: string): AssistantAction | null {
  const t = text.toLowerCase().trim();

  if (QUESTION.test(t) && !COMMAND_VERB.test(t)) return null;

  const actuator = detectActuator(t);

  // Mode changes: "set the light to manual", "put watering in auto".
  // The door servo has no automation, so it is deliberately not a mode target.
  const mode = /\b(auto|automatic|manual)\b/.exec(t);
  if (mode && actuator && actuator !== "door" && /to |set |put |switch |mode/.test(t)) {
    const m: ControlMode = mode[1].startsWith("manual") ? "manual" : "auto";
    return { command_type: "MODE", value: `${actuator}:${m}`, label: `Set ${actuator.replace("_", " ")} to ${m.toUpperCase()}` };
  }

  const hasOn = ON.test(t) || IMPERATIVE_ON.test(t);
  const hasOff = OFF.test(t);
  if (!hasOn && !hasOff) return null;

  if (!actuator) return null;
  const on = hasOn && !hasOff;
  const { type, on: onValue, off: offValue, label } = CONTROL_COMMAND[actuator];
  return { command_type: type, value: on ? onValue : offValue, label: `${label} ${on ? onValue : offValue}` };
}

export function confirmAction(action: AssistantAction): string {
  return `${action.label} — command sent to ESP32. Waiting for physical controller acknowledgement.`;
}

export function localAnswer(text: string, ctx: HomeSnapshot): string {
  const t = text.toLowerCase();
  const s = ctx.sensors;
  const st = ctx.state;

  if (/motion|moving|anyone|presence/.test(t)) {
    return s.pir.motion
      ? `Yes — PIR motion sensor is detecting movement right now (last detected: ${s.pir.last_motion_at ?? "just now"}).`
      : `No — PIR sensor reports no motion currently. Last motion was ${s.pir.last_motion_at ?? "not recorded yet"}.`;
  }
  if (/soil|dry|plant.*(thirsty|water)|thirsty/.test(t)) {
    const thr = ctx.settings.find((x) => x.automation_name === "auto_watering")?.threshold ?? 30;
    return s.soil.percent < thr
      ? `Yes — soil moisture is ${s.soil.percent.toFixed(0)}%, which is dry and below your ${thr}% threshold.${
          st.pump_soil ? " Plant pump is running now." : " Plant pump is idle."
        }`
      : `No — soil moisture is ${s.soil.percent.toFixed(0)}% (${s.soil.state}), well above the ${thr}% threshold.`;
  }
  if (/tank|reservoir|water\s*level/.test(t)) {
    const thr = ctx.settings.find((x) => x.automation_name === "auto_tank_fill")?.threshold ?? 30;
    return `Water tank is ${s.water_level.percent.toFixed(0)}% full (${s.water_level.state})${
      s.water_level.percent < thr ? ", which is below your " + thr + "% refill threshold" : ""
    }. Fill pump is ${st.pump_tank ? "running" : "idle"} (${st.modes.tank_level} mode).`;
  }
  if (/gas|smoke/.test(t)) {
    return `The gas/smoke sensor reads ${s.gas.raw} raw (estimated status: ${s.gas.level}). Local buzzer alarms if it reaches danger threshold.`;
  }
  if (/flame|fire/.test(t)) {
    return s.flame.detected
      ? "⚠ CRITICAL: Flame is currently DETECTED by the optical sensor! Buzzer is sounding."
      : "No flame detected. Optical sensor reading is CLEAR.";
  }
  if (/temperature|temp\b|hot|cold/.test(t)) {
    return `Current temperature is ${s.dht.temperature.toFixed(1)}°C with relative humidity at ${s.dht.humidity.toFixed(0)}%.`;
  }
  if (/humid/.test(t)) return `Relative humidity is ${s.dht.humidity.toFixed(0)}%.`;
  if (/rain|weather/.test(t)) {
    return `Rain sensor status: ${s.rain.detected ? "RAIN DETECTED" : "DRY"}. Clothes rack is currently ${st.clothes_dryer.toUpperCase()}.`;
  }
  if (/dustbin|bin|trash|garbage/.test(t)) {
    return `The dustbin is estimated at ${s.dustbin.percent.toFixed(0)}% full (${s.dustbin.state}), measuring ${s.dustbin.distance_cm} cm to trash surface.`;
  }
  if (/door/.test(t)) {
    return s.reed.mismatch
      ? `⚠ Warning: Door position mismatch! Actuator is ${st.door} but magnetic reed switch detects ${s.reed.state}. Check physical door.`
      : `The door is ${s.reed.state.toUpperCase()} (reed contact sensor confirmed).`;
  }
  if (/buzzer|beep|why.*(sound|alarm|noise)/.test(t)) {
    const recent = ctx.alerts.slice(0, 3);
    if (recent.length === 0) return "The buzzer has not been triggered — all safety sensors are normal.";
    return `The buzzer triggers for safety emergencies. Recent alerts: ${recent
      .map((a) => `${a.message} (${new Date(a.created_at).toLocaleTimeString()})`)
      .join("; ")}.`;
  }
  if (/alert|warning|problem|wrong/.test(t)) {
    if (ctx.alerts.length === 0) return "There are no active alerts recorded. All systems green.";
    return `You have ${ctx.alerts.filter((a) => !a.acknowledged).length} unacknowledged alert(s). Latest: ${ctx.alerts[0].message}.`;
  }
  if (/light/.test(t)) {
    return `Light is ${st.light ? "ON" : "OFF"} (operating mode: ${st.modes.light}). Raw LDR value is ${s.ldr.raw} (${s.ldr.state}).`;
  }
  if (/fan/.test(t)) {
    return `Fan is ${st.fan ? "ON" : "OFF"} (operating mode: ${st.modes.fan}). Temperature is ${s.dht.temperature.toFixed(1)}°C.`;
  }
  if (/everything|status|summary|how.*(house|home|things)/.test(t)) {
    return [
      `Light: ${st.light ? "ON" : "OFF"}, Fan: ${st.fan ? "ON" : "OFF"}, Door: ${st.door.toUpperCase()}, Rack: ${st.clothes_dryer.toUpperCase()}.`,
      `DHT11: ${s.dht.temperature.toFixed(1)}°C, ${s.dht.humidity.toFixed(0)}% humidity.`,
      `Soil: ${s.soil.percent.toFixed(0)}%, Water tank: ${s.water_level.percent.toFixed(0)}% (${s.water_level.state}), Dustbin: ${s.dustbin.percent.toFixed(0)}%.`,
      `Gas: ${s.gas.level}, Flame: ${s.flame.detected ? "DETECTED!" : "Clear"}, Rain: ${s.rain.detected ? "Raining" : "Dry"}.`,
    ].join(" ");
  }

  return (
    "I am grounded in live ESP32 telemetry. You can ask me about temperature, humidity, door state, soil moisture, rain, flame, gas, or dustbin level — " +
    "or tell me to turn on/off the light, fan, door, clothes rack, or watering pump."
  );
}

export function buildSystemPrompt(ctx: HomeSnapshot): string {
  return [
    "You are the assistant inside the AIoT Smart Home dashboard for an ESP32 microcontroller.",
    "You do two things:",
    "1. Answer questions about the home from the LIVE TELEMETRY SNAPSHOT below. The snapshot is the",
    "   only source of truth for sensor readings and device state: never invent, estimate, assume or",
    "   guess a reading, and if the snapshot does not contain it, say so plainly instead of answering.",
    "2. Be a genuinely helpful assistant for everything else: general questions, explanations, advice",
    "   and reasoning are all welcome. Use your own knowledge, but never present general knowledge",
    "   (or any made-up value) as a live sensor reading.",
    "",
    "Style: keep answers concise, direct and factual; when you compare several readings, use markdown",
    "lists; quote live values exactly as they appear in the snapshot; when you give advice that goes",
    "beyond the snapshot, make clear it is general guidance rather than a live measurement.",
    "",
    "LIVE TELEMETRY SNAPSHOT (JSON):",
    JSON.stringify(
      {
        device: ctx.device,
        state: ctx.state,
        sensors: ctx.sensors,
        settings: ctx.settings,
        recent_alerts: ctx.alerts.slice(0, 5),
        recent_events: ctx.events.slice(0, 8),
      },
      null,
      1,
    ),
  ].join("\n");
}
