/**
 * Shared types for the AIoT Smart Home dashboard.
 * Mirrors the Supabase schema and ESP32 firmware types.
 */

export type DeviceId = string;

/**
 * Physical actuators controlled by the ESP32:
 * - light: High-voltage lamp on a 2-pin motor-driver channel (IN1/IN2)
 * - fan: DC Ventilation Fan (Motor driver IN1/IN2)
 * - door: Front door servo (SG90, 0-90 deg)
 * - clothes_dryer: Retractable drying rack servo (SG90)
 * - pump_soil: Plant watering pump (Driver IN1/IN2)
 * - pump_tank: Water-tank fill pump (Driver IN1/IN2, level controlled)
 */
export type ActuatorKey = "light" | "fan" | "door" | "clothes_dryer" | "pump_soil" | "pump_tank";

export type BuzzerKey = "buzzer";

/**
 * Physical sensors reported by the ESP32:
 * - ldr: Ambient light photoresistor (ADC1)
 * - gas: MQ-2 smoke/combustible gas sensor
 * - flame: Optical flame detector
 * - soil: Soil moisture sensor (ADC1)
 * - water_level: Water-tank level probe (ADC1)
 * - rain: Optical rain sensor
 * - dustbin: HC-SR04 ultrasonic distance sensor
 * - dht: DHT11 temperature and relative humidity
 * - pir: HC-SR501 passive infrared motion sensor
 * - reed: Magnetic reed door contact sensor
 */
export type SensorKey =
  | "ldr"
  | "gas"
  | "flame"
  | "soil"
  | "water_level"
  | "rain"
  | "dustbin"
  | "dht"
  | "pir"
  | "reed";

export type ControlMode = "manual" | "auto";
export type HomeMode = "HOME" | "AWAY" | "SLEEP" | "EMERGENCY";

export type DoorState = "open" | "closed";
export type DryerState = "extended" | "retracted";

export interface DeviceFlags {
  light: boolean;
  fan: boolean;
  pump_soil: boolean;
  pump_tank: boolean;
  buzzer: boolean;
  door: DoorState;
  clothes_dryer: DryerState;
}

export interface DeviceModes {
  light: ControlMode;
  fan: ControlMode;
  door: ControlMode;
  clothes_dryer: ControlMode;
  watering: ControlMode;
  tank_level: ControlMode;
}

export interface Device {
  id: DeviceId;
  name: string;
  device_type: string;
  online: boolean;
  last_seen: string | null;
  firmware_version: string;
  ip_address?: string | null;
  rssi?: number | null;
}

/** Desired (requested) vs Reported (confirmed physical) state */
export interface DeviceState {
  device_id: DeviceId;
  light: boolean;
  fan: boolean;
  door: DoorState;
  clothes_dryer: DryerState;
  pump_soil: boolean;
  pump_tank: boolean;
  buzzer: boolean;
  modes: DeviceModes;
  updated_at: string;
}

export interface DesiredState {
  light: boolean;
  fan: boolean;
  door: DoorState;
  clothes_dryer: DryerState;
  pump_soil: boolean;
  pump_tank: boolean;
}

export interface LdrReading {
  raw: number;
  state: "dark" | "bright";
}

export interface GasReading {
  raw: number;
  level: "normal" | "warning" | "danger";
}

export interface FlameReading {
  detected: boolean;
  raw: number;
}

export interface SoilReading {
  raw: number;
  percent: number;
  state: "dry" | "normal" | "wet";
}

export interface WaterLevelReading {
  raw: number;
  percent: number;
  state: "empty" | "low" | "ok" | "full";
}

export interface RainReading {
  detected: boolean;
  raw: number;
}

export interface DustbinReading {
  distance_cm: number;
  percent: number;
  state: "empty" | "normal" | "almost_full" | "full";
}

export interface DhtReading {
  temperature: number;
  humidity: number;
}

export interface PirReading {
  motion: boolean;
  last_motion_at: string | null;
}

export interface ReedReading {
  state: DoorState;
  last_change_at: string | null;
  mismatch: boolean;
}

/**
 * ISO timestamp of the last reading actually received from the device, per
 * sensor. A sensor that is missing from this map has never reported, so its
 * fallback value must never be presented as a live measurement.
 */
export type SensorFreshness = Partial<Record<SensorKey, string>>;

export interface SensorSnapshot {
  ldr: LdrReading;
  gas: GasReading;
  flame: FlameReading;
  soil: SoilReading;
  water_level: WaterLevelReading;
  rain: RainReading;
  dustbin: DustbinReading;
  dht: DhtReading;
  pir: PirReading;
  reed: ReedReading;
  freshness: SensorFreshness;
  updated_at: string;
}

export type AlertSeverity = "info" | "warning" | "important" | "critical";

export type AlertType =
  | "flame"
  | "gas_warning"
  | "gas_danger"
  | "dustbin_full"
  | "soil_dry"
  | "rain_clothes_out"
  | "door_mismatch"
  | "device_offline"
  | "device_online"
  | "test";

export interface Alert {
  id: string;
  device_id: DeviceId;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export type CommandStatus = "pending" | "sent" | "received" | "completed" | "failed" | "expired" | "cancelled";

export interface Command {
  id: string;
  device_id: DeviceId;
  command_type: string;
  value: string | null;
  created_at: string;
  processed_at: string | null;
  status: CommandStatus;
  error_code?: string | null;
  error_message?: string | null;
}

export interface DeviceEvent {
  id: string;
  device_id: DeviceId;
  event_type: string;
  message: string;
  created_at: string;
}

export type AutomationName =
  | "auto_light"
  | "auto_fan"
  | "auto_watering"
  | "auto_tank_fill"
  | "rain_protection"
  | "gas_monitor"
  | "flame_monitor"
  | "dustbin_monitor"
  | "door_monitor"
  | "buzzer"
  | "door_servo"
  | "dryer_servo"
  | "tank_level_calibration"
  | "dustbin_calibration"
  | "reporting";

export interface AutomationSetting {
  device_id: DeviceId;
  automation_name: AutomationName;
  enabled: boolean;
  threshold: number | null;
  secondary_threshold: number | null;
  duration: number | null;
  updated_at: string;
}

export interface HomeSnapshot {
  device: Device;
  state: DeviceState;
  sensors: SensorSnapshot;
  settings: AutomationSetting[];
  alerts: Alert[];
  commands: Command[];
  events: DeviceEvent[];
  mode: HomeMode;
}
