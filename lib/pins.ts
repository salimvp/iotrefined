/**
 * ESP32 NodeMCU 30-Pin Central Pin Map
 * Kept in 1:1 synchronization with the Central Pin Map section of `esp32/esp32.ino`.
 */

export interface PinRow {
  name: string;
  gpio: string;
  mode: string;
  level: "ok" | "caution" | "input-only";
  note?: string;
}

export const PIN_TABLE: PinRow[] = [
  // Outputs & Actuators
  { name: "Light Driver IN1", gpio: "13", mode: "Digital Output", level: "ok", note: "High-voltage lamp driver input #1 (HIGH + IN2 LOW = lamp ON)" },
  { name: "Light Driver IN2", gpio: "33", mode: "Digital Output", level: "ok", note: "High-voltage lamp driver input #2 (held LOW, both LOW = lamp OFF)" },
  { name: "Fan Driver IN1", gpio: "25", mode: "Digital Output", level: "ok", note: "Motor driver input #1 for DC fan" },
  { name: "Fan Driver IN2", gpio: "26", mode: "Digital Output", level: "ok", note: "Motor driver input #2 for DC fan" },
  { name: "Soil Pump IN1", gpio: "27", mode: "Digital Output", level: "ok", note: "Motor driver input #1 for plant watering pump" },
  { name: "Soil Pump IN2", gpio: "14", mode: "Digital Output", level: "ok", note: "Motor driver input #2 for plant watering pump" },
  { name: "Tank Pump IN1", gpio: "16", mode: "Digital Output", level: "ok", note: "Motor driver input #1 for the water-tank fill pump" },
  { name: "Tank Pump IN2", gpio: "2", mode: "Digital Output", level: "caution", note: "Motor driver input #2 for the tank fill pump (boot strap pin: driver input must stay LOW at boot)" },
  { name: "Door Servo Signal", gpio: "18", mode: "PWM (LEDC)", level: "ok", note: "SG90 servo for front door mechanism (External 5V supply)" },
  { name: "Clothes Servo Signal", gpio: "17", mode: "PWM (LEDC)", level: "ok", note: "SG90 servo for clothes-drying rack (External 5V supply)" },
  { name: "Buzzer Signal", gpio: "5", mode: "Digital Output", level: "caution", note: "Active buzzer for immediate local emergency alarms" },
  { name: "Ultrasonic Trigger", gpio: "15", mode: "Digital Output", level: "caution", note: "HC-SR04 10µs trigger pulse (boot strap pin, idle LOW)" },

  // Digital Inputs
  { name: "Ultrasonic Echo", gpio: "4", mode: "Digital Input", level: "caution", note: "Requires 5V to 3.3V voltage divider or level shifter!" },
  { name: "DHT11 Data", gpio: "23", mode: "Digital I/O", level: "ok", note: "Temperature & relative humidity data pin (10k pull-up to 3.3V)" },
  { name: "PIR Motion Sensor", gpio: "32", mode: "Digital Input", level: "ok", note: "HC-SR501 passive infrared motion sensor (Idles LOW)" },
  { name: "Flame Sensor", gpio: "22", mode: "Digital Input (Pullup)", level: "ok", note: "Optical flame sensor module (Active LOW)" },
  { name: "Reed Switch", gpio: "21", mode: "Digital Input (Pullup)", level: "ok", note: "Magnetic reed switch on front door (Closes to GND)" },
  { name: "Rain Sensor", gpio: "19", mode: "Digital Input (Pullup)", level: "ok", note: "Optical rain detection board" },

  // Analog Inputs (ADC1 only, 100% Wi-Fi Safe)
  { name: "LDR Light Sensor", gpio: "34", mode: "Analog In (ADC1_CH6)", level: "input-only", note: "Photoresistor ambient light reading (0-4095)" },
  { name: "Soil Moisture Sensor", gpio: "35", mode: "Analog In (ADC1_CH7)", level: "input-only", note: "Resistive or capacitive soil probe (0-4095)" },
  { name: "MQ-2 Gas Sensor", gpio: "36", mode: "Analog In (ADC1_CH0)", level: "input-only", note: "AO pin of the MQ-2 module (0-4095, averaged + smoothed on the board)" },
  { name: "Water Level Sensor", gpio: "39", mode: "Analog In (ADC1_CH3)", level: "input-only", note: "Water-tank level probe AO output (0-4095); drives the tank fill pump" },
];

export const SPARE_PINS: PinRow[] = [
  { name: "(Free)", gpio: "12", mode: "Digital I/O", level: "caution", note: "Must be LOW at boot (flash voltage select) — only use with a pull-down-safe circuit" },
  { name: "(Avoid)", gpio: "0 / 2", mode: "Boot Straps", level: "caution", note: "Reserved for flashing / boot mode selection" },
  { name: "(Avoid)", gpio: "1 / 3", mode: "UART0", level: "caution", note: "Reserved for USB-Serial console communication" },
  { name: "(Avoid)", gpio: "6–11", mode: "SPI Flash", level: "caution", note: "Internally connected to integrated SPI flash memory" },
];
