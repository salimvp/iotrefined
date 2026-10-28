import type { AutomationName, AutomationSetting, DeviceId } from "./types";

export const HARDWARE_DEFAULTS = {
  door_open_angle: 90,
  door_closed_angle: 0,
  dryer_extended_angle: 90,
  dryer_retracted_angle: 0,
  empty_distance_cm: 30,
  full_distance_cm: 5,
};

export interface AutomationField {
  key: "threshold" | "secondary_threshold" | "duration";
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

export interface AutomationMeta {
  name: AutomationName;
  title: string;
  description: string;
  icon: string;
  group: "automation" | "calibration";
  fields: AutomationField[];
  defaults: Omit<AutomationSetting, "device_id" | "automation_name" | "updated_at">;
}

export const AUTOMATIONS: AutomationMeta[] = [
  {
    name: "auto_light",
    title: "Automatic Lighting (LDR)",
    description: "Turns the light ON when ambient light falls below the dark threshold, and OFF when light rises above the bright threshold with hysteresis.",
    icon: "SunMoon",
    group: "automation",
    fields: [
      { key: "threshold", label: "Dark threshold", unit: "raw", min: 0, max: 4095, step: 1, hint: "Turns ON above this LDR reading (this module reads higher in the dark)" },
      { key: "secondary_threshold", label: "Bright threshold", unit: "raw", min: 0, max: 4095, step: 1, hint: "Turns OFF below this reading" },
    ],
    defaults: { enabled: true, threshold: 1800, secondary_threshold: 1200, duration: null },
  },
  {
    name: "auto_fan",
    title: "Automatic Fan (DHT11 Temperature)",
    description: "Turns the DC fan ON when temperature reaches the high threshold, and OFF when it cools below the low threshold with hysteresis.",
    icon: "Fan",
    group: "automation",
    fields: [
      { key: "threshold", label: "High temperature", unit: "°C", min: 10, max: 50, step: 0.5, hint: "Fan turns ON at or above this temperature" },
      { key: "secondary_threshold", label: "Low temperature", unit: "°C", min: 10, max: 50, step: 0.5, hint: "Fan turns OFF at or below this temperature" },
      { key: "duration", label: "Min runtime", unit: "s", min: 5, max: 300, step: 5, hint: "Minimum continuous run duration" },
    ],
    defaults: { enabled: true, threshold: 28, secondary_threshold: 25, duration: 30 },
  },
  {
    name: "auto_watering",
    title: "Automatic Plant Watering",
    description: "Runs the DC water pump when soil moisture drops below threshold. Enforces a maximum run duration and cooldown to prevent overwatering.",
    icon: "Sprout",
    group: "automation",
    fields: [
      { key: "threshold", label: "Dry threshold", unit: "%", min: 0, max: 100, step: 1, hint: "Waters when moisture drops below this %" },
      { key: "duration", label: "Max pump runtime", unit: "s", min: 1, max: 30, step: 1, hint: "Safety cutoff runtime per watering cycle" },
    ],
    defaults: { enabled: true, threshold: 30, secondary_threshold: null, duration: 5 },
  },
  {
    name: "auto_tank_fill",
    title: "Automatic Water-Tank Filling",
    description: "Starts the tank pump when the water level drops below the low threshold and stops it once the tank is full. A fill cycle is capped by the maximum runtime and a cooldown keeps the pump from short-cycling.",
    icon: "Droplets",
    group: "automation",
    fields: [
      { key: "threshold", label: "Low level (start)", unit: "%", min: 0, max: 100, step: 1, hint: "Pump starts below this level" },
      { key: "secondary_threshold", label: "Full level (stop)", unit: "%", min: 0, max: 100, step: 1, hint: "Pump stops at or above this level" },
      { key: "duration", label: "Max fill runtime", unit: "s", min: 5, max: 120, step: 5, hint: "Safety cutoff per fill cycle" },
    ],
    defaults: { enabled: true, threshold: 30, secondary_threshold: 85, duration: 30 },
  },
  {
    name: "rain_protection",
    title: "Rain-Responsive Clothes Rack",
    description: "Retracts the drying rack immediately when rain is detected. Re-extends rack only after the dry-weather delay.",
    icon: "CloudRain",
    group: "automation",
    fields: [
      { key: "duration", label: "Dry delay", unit: "s", min: 5, max: 1800, step: 5, hint: "Wait this long after rain stops before re-extending" },
    ],
    defaults: { enabled: true, threshold: null, secondary_threshold: null, duration: 10 },
  },
  {
    name: "gas_monitor",
    title: "Gas / Smoke Monitoring",
    description: "Triggers local buzzer and generates alerts when MQ-2 sensor crosses threshold.",
    icon: "Wind",
    group: "automation",
    fields: [
      { key: "threshold", label: "Warning level", unit: "raw", min: 0, max: 4095, step: 1 },
      { key: "secondary_threshold", label: "Danger level", unit: "raw", min: 0, max: 4095, step: 1 },
      { key: "duration", label: "Alert cooldown", unit: "s", min: 5, max: 600, step: 5 },
    ],
    defaults: { enabled: true, threshold: 1600, secondary_threshold: 2600, duration: 120 },
  },
  {
    name: "flame_monitor",
    title: "Flame Emergency Alert",
    description: "Immediate hardware buzzer alarm and critical alert broadcast upon optical flame detection.",
    icon: "Flame",
    group: "automation",
    fields: [{ key: "duration", label: "Cooldown", unit: "s", min: 5, max: 300, step: 5 }],
    defaults: { enabled: true, threshold: null, secondary_threshold: null, duration: 60 },
  },
  {
    name: "dustbin_monitor",
    title: "Dustbin Fill Alert",
    description: "Generates a reminder alert when the ultrasonic sensor detects the bin is almost full.",
    icon: "Trash2",
    group: "automation",
    fields: [
      { key: "threshold", label: "Alert at fill", unit: "%", min: 50, max: 100, step: 1 },
      { key: "duration", label: "Reminder cooldown", unit: "s", min: 60, max: 86400, step: 60 },
    ],
    defaults: { enabled: true, threshold: 85, secondary_threshold: null, duration: 3600 },
  },
  {
    name: "door_monitor",
    title: "Door Status & Mismatch",
    description: "Warns if the servo position and magnetic reed switch disagree, indicating physical obstruction.",
    icon: "DoorOpen",
    group: "automation",
    fields: [{ key: "duration", label: "Warning cooldown", unit: "s", min: 5, max: 300, step: 5 }],
    defaults: { enabled: true, threshold: null, secondary_threshold: null, duration: 60 },
  },
  {
    name: "buzzer",
    title: "Local Hardware Buzzer",
    description: "Audible alarm sounded directly by the ESP32 independently of internet or cloud status.",
    icon: "BellRing",
    group: "automation",
    fields: [{ key: "duration", label: "Pulse duration", unit: "ms", min: 100, max: 2000, step: 50 }],
    defaults: { enabled: true, threshold: null, secondary_threshold: null, duration: 600 },
  },
  {
    name: "reporting",
    title: "Telemetry Sync Intervals",
    description: "Intervals at which the ESP32 reports sensor updates to the backend.",
    icon: "Activity",
    group: "automation",
    fields: [
      { key: "threshold", label: "Telemetry period", unit: "s", min: 5, max: 120, step: 5 },
      { key: "secondary_threshold", label: "Heartbeat period", unit: "s", min: 10, max: 300, step: 10 },
    ],
    defaults: { enabled: true, threshold: 15, secondary_threshold: 30, duration: null },
  },
];

export const CALIBRATIONS: AutomationMeta[] = [
  {
    name: "door_servo",
    title: "Door Servo Angles",
    description: "Calibrate the open and closed angles for the SG90 front door servo.",
    icon: "DoorOpen",
    group: "calibration",
    fields: [
      { key: "threshold", label: "Open angle", unit: "°", min: 0, max: 180, step: 1 },
      { key: "secondary_threshold", label: "Closed angle", unit: "°", min: 0, max: 180, step: 1 },
    ],
    defaults: { enabled: true, threshold: HARDWARE_DEFAULTS.door_open_angle, secondary_threshold: HARDWARE_DEFAULTS.door_closed_angle, duration: null },
  },
  {
    name: "dryer_servo",
    title: "Clothes-Rack Servo Angles",
    description: "Calibrate the extended and retracted angles for the drying rack servo.",
    icon: "Shirt",
    group: "calibration",
    fields: [
      { key: "threshold", label: "Extended angle", unit: "°", min: 0, max: 180, step: 1 },
      { key: "secondary_threshold", label: "Retracted angle", unit: "°", min: 0, max: 180, step: 1 },
    ],
    defaults: { enabled: true, threshold: HARDWARE_DEFAULTS.dryer_extended_angle, secondary_threshold: HARDWARE_DEFAULTS.dryer_retracted_angle, duration: null },
  },
  {
    name: "tank_level_calibration",
    title: "Water Level Calibration",
    description: "Set the water level probe's empty (dry) and full (submerged) ADC counts so the dashboard percentage matches the physical tank. This probe spans 0 (dry) to 2000 (fully submerged) counts.",
    icon: "Droplets",
    group: "calibration",
    fields: [
      { key: "threshold", label: "Empty raw count", unit: "raw", min: 0, max: 4095, step: 1, hint: "Reading with the probe dry / tank empty" },
      { key: "secondary_threshold", label: "Full raw count", unit: "raw", min: 0, max: 4095, step: 1, hint: "Reading with the probe fully submerged" },
    ],
    defaults: { enabled: true, threshold: 0, secondary_threshold: 2000, duration: null },
  },
  {
    name: "dustbin_calibration",
    title: "Dustbin Distance Calibration",
    description: "Measure the ultrasonic distance with the bin empty (e.g. 30cm) and full (e.g. 5cm).",
    icon: "Trash2",
    group: "calibration",
    fields: [
      { key: "threshold", label: "Empty distance", unit: "cm", min: 2, max: 200, step: 1 },
      { key: "secondary_threshold", label: "Full distance", unit: "cm", min: 2, max: 200, step: 1 },
    ],
    defaults: { enabled: true, threshold: HARDWARE_DEFAULTS.empty_distance_cm, secondary_threshold: HARDWARE_DEFAULTS.full_distance_cm, duration: null },
  },
];

export const ALL_SETTINGS: AutomationMeta[] = [...AUTOMATIONS, ...CALIBRATIONS];

export function defaultSettings(deviceId: DeviceId): AutomationSetting[] {
  const now = new Date().toISOString();
  return ALL_SETTINGS.map((a) => ({
    device_id: deviceId,
    automation_name: a.name,
    ...a.defaults,
    updated_at: now,
  }));
}
