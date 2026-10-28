# AuraHome — Smart Home Dashboard (web)

A premium, responsive control console for the ESP32 smart-home system. Built with
**Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase Realtime**.

The dashboard works in two modes:

| Mode | When | Behaviour |
| --- | --- | --- |
| **Live** | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set | Reads real data and subscribes to Supabase Realtime on 7 tables. |
| **Demo** | No credentials found | A local `DemoEngine` simulates the ESP32 + backend so every screen is fully usable. A banner says so at the top. |

You can develop the whole UI before buying/soldering anything, then flip to live
data by filling in `.env.local`.

---

## Quick start

```bash
cd web
npm install
cp .env.example .env.local     # optional — leave blank for demo mode
npm run dev                    # http://localhost:3000
```

Production check:

```bash
npm run typecheck
npm run build
npm start
```

---

## Environment variables

Everything is documented in `.env.example`. Short version:

**Public (browser-safe, protected by Row Level Security)**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the **anon/publishable** key, *not* the service-role key
- `NEXT_PUBLIC_DEFAULT_DEVICE_ID` — which ESP32 the dashboard talks to

**Server-only (used by API routes, never shipped to the browser)**

- `AI_API_KEY` — AI assistant provider key
- `AI_MODEL`, `AI_BASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — reserved for trusted jobs only; leave empty in this app

> ⚠️ No secret appears in `lib/supabase/client.ts` or the tracked ESP32 sketch. Put Wi-Fi credentials in the ignored `esp32/secrets.h` file (copy `secrets.h.example`).

---

## Pages

| Route | What it does |
| --- | --- |
| `/` | Dashboard — summary strip, quick controls, environment / safety / garden sensor grids, activity feed and latest alerts |
| `/controls` | Every actuator (light, fan, door, **Pump A**, **Pump B**, clothes rack), desired-vs-actual sync table and the live command queue |
| `/automations` | Enable/disable automations and edit every threshold, duration and cooldown |
| `/sensors` | Raw + derived values for all 9 sensors with sparklines and per-sensor calibration notes |
| `/alerts` | Filterable alert list with acknowledgement, plus an honest note on dashboard alerts vs. OS push |
| `/assistant` | Chat assistant. Answers come only from live data; control requests become real commands |
| `/settings` | Device identity, backend/security status, servo + sensor **calibration**, reporting intervals, and the full ESP32 pin map |

---

## Architecture (frontend side)

```
app/                     routes (App Router, client components where realtime is needed)
  api/assistant/route.ts server-side AI; key never reaches the browser
components/
  Shell.tsx              responsive shell: sidebar + top bar + mobile nav
  ControlTile.tsx        actuator card with toggle, AUTO/MANUAL switch, sync state
  SensorTile.tsx         sensor card with sparkline and status badge
  AutomationCard.tsx     generic automation/calibration editor
  ui/                    Card, StatusPill, Toggle, Sparkline
lib/
  types.ts               domain types — mirror the Supabase schema exactly
  config.ts              automation metadata + safe hardware defaults
  pins.ts                single-source ESP32 pin map (matches esp32/esp32.ino)
  demo.ts                DemoEngine: simulates the ESP32 for demo mode
  store.tsx              HomeProvider: initial load + Realtime subscriptions + actions
  assistant.ts           intent parsing, context-only answers, system prompt
  supabase/client.ts     browser client + config detection
```

### How real-time actually works

- On load, the store reads the current snapshot, then opens **one** Realtime
  channel subscribed to `device_states`, `sensor_readings`, `alerts`,
  `commands`, `automation_settings`, `devices` and `events`.
- Any change pushed from Supabase updates the UI. **There is no polling loop.**
- Pressing a control inserts a row into `commands`. The ESP32 applies it and
  writes the *actual* state back; the UI shows "syncing" until the reported
  state matches, so DESIRED and ACTUAL are never confused.

### Manual vs automatic

Every device has an `AUTO` / `MANUAL` switch. In `MANUAL` the ESP32 ignores the
matching automation, so turning the light off is not instantly undone by the LDR.

---

## Hardware model reflected in the UI

The board is an ESP32 NodeMCU 30-pin. Because the fan and **both pumps** run off
motor drivers, each needs **two** control pins (IN1/IN2). The ultrasonic sensor
needs TRIG + ECHO. That is 15 digital pins for 11 outputs + 4 inputs, against 13
"clean" pins — so exactly two loads use strapping pins, both wired to stay
boot-safe:

- `REED_PIN` → GPIO5 with `INPUT_PULLUP` (must be HIGH at boot; the pull-up holds it high)
- `PIR_PIN` → GPIO12 (must be LOW at boot; an HC-SR501 idles LOW)

All six analog sensors sit on ADC1 (GPIO 32–39) because **ADC2 stops working while
Wi-Fi is on**. GPIO 34–39 are input-only. GPIO 6–11 are wired to flash and never
usable. The full table, with reasons, is on `/settings`.

Pumps:

- **Pump A (`PUMP_SOIL`)** — flower-pot watering, driven by the soil-moisture automation
- **Pump B (`PUMP_WATER`)** — tank refill, driven by the water-level sensor automation

---

## Verification performed

- `npx tsc --noEmit` — clean
- `npx next build` — clean, all 7 routes prerendered
- Headless browser: dashboard renders live demo values; pressing Light ON created
  a `LIGHT=ON` command that was processed and reported back as `COMPLETED`
- Assistant API: queries return snapshot-derived answers and **no** command;
  "Turn on the light", "Refill the tank", "water the flower pot", "Stop the pump"
  each produce the correct distinct command

---

## Still to come (next phases)

1. Web Push notifications (service worker + Edge Function) — currently dashboard alerts only, and labelled as such
2. Backend setup on your own Supabase project — the schema and firmware already exist in this
   repo; what remains is running them against a real project. See
   [`../supabase/README.md`](../supabase/README.md).
