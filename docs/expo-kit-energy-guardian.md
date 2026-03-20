# Prakalp 2026 Expo Kit: Smart Energy Guardian (Auto-Off)

## 1) One-line Title
**Smart Energy Guardian (Auto-Off) using ESP32 + Current Sensing + Web Dashboard**

## 2) Problem Statement (real-world, simple)
In hostels and labs, appliances are often left ON for long durations. This causes:
- wasted electricity (higher bills),
- unsafe overheating risk,
- and increased fire hazard when devices stay powered unnecessarily.

## 3) Project Goal
Build a low-cost system that:
1. measures **Current, Voltage, Power, Energy** in real time,
2. displays readings on a **live dashboard**,
3. automatically switches the load **OFF** when limits are crossed,
4. sends alerts/events so judges can understand the outcome immediately.

## 4) System Architecture (Block Diagram)
Use this diagram in PPT/poster:

```mermaid
flowchart LR
  A[Current Sensor] --> B[ESP32]
  C[Voltage Divider] --> B
  B --> D[Relay Switch]
  B --> E[Auto-Off Logic]
  B -->|WebSocket JSON| F[Dashboard (Next.js)]
  F --> G[Live Charts + Gauges]
  F --> H[Toasts/Events]
```

## 5) Circuit / Wiring (What to show in poster)
### Connections (edit pins in firmware)
- `Current Sensor OUT (analog)` -> `ESP32 ADC pin (A0 / GPIO34)`.
- `Voltage Divider OUT (analog)` -> `ESP32 ADC pin (A1 / GPIO35)`.
- `Relay IN (digital)` -> `ESP32 digital pin (example GPIO5)`.
- `Relay NO/COM` -> demo load (e.g., LED bulb / small fan).

### Relay control reminder (safety)
- Use an insulated, low-watt demo load.
- Keep mains terminals away from people during operation.

## 6) Hardware + Software Components List
### Hardware
- ESP32
- Current sensor (ACS712 or equivalent analog current sensor)
- Voltage divider module/design (for ADC voltage measurement)
- Relay module
- Breadboard + jumper wires

### Software
- ESP32: auto-off + JSON broadcast over WebSocket
- Next.js: real-time dashboard (gauges + power chart + alerts)

## 7) Working (How it runs)
1. ESP32 reads `current_a` and `voltage_v` every few seconds.
2. Computes:
   - `power_w = voltage_v * current_a`
   - `energy_kwh` by integrating power over time
3. If:
   - current/power exceeds limits for a hold duration, OR
   - relay stays ON beyond `MAX_ON_MINUTES`
   -> ESP32 turns relay OFF and sends an event.
4. Dashboard receives JSON and updates:
   - **Current / Power / Energy** gauges
   - **Live Power** line chart
   - **Toast alerts** when events occur

## 8) Demo Script (5 minutes, judge-friendly)
### Scene A: Setup (30–45 sec)
1. Turn demo load ON through relay start (or wait for auto-on after boot).
2. On dashboard, show the Live Power chart rising.

### Scene B: Show real-time sensing (1–2 min)
1. Slightly change load condition (switch to a different load if available).
2. Point to:
   - increasing `Current (A)`
   - increasing `Power (W)`
   - increasing `Energy (kWh)`

### Scene C: Trigger auto-off (1–2 min)
1. Create an over-limit situation (use the bigger load until power/current crosses limits).
2. Wait for the dashboard toast:
   - event appears: `OVER_CURRENT` (or time limit)
3. Verify relay state changes to `OFF`.
4. Show that power drops to near-zero after auto-off.

### Scene D: Close (30–45 sec)
Explain the “move from measuring -> decision -> action” story:
**sensing + rule-based control + real-time transparency.**

## 9) Poster Content (copy-paste ready)
### Poster Headline
**Smart Energy Guardian (Auto-Off)**

### Poster Sections (short)
- Objective: Reduce wasted electricity & improve safety
- Sensors: Current + Voltage
- Computation: Power + Energy integration
- Control: Auto-off on over-limit / time-limit
- Output: Web dashboard + alerts

### Expected Outcomes
- Automatic switching OFF
- Real-time monitoring for transparency
- Better safety during unattended appliance usage

## 10) PPT Outline (8–10 slides)
1. Title + Team info
2. Problem statement (waste + safety)
3. Proposed solution (block diagram)
4. Hardware setup (wiring diagram + safety note)
5. Sensor-to-math (power/energy equations)
6. Auto-off logic (rules + hold time + max-on)
7. Dashboard UI (gauges + power chart + toasts)
8. Demo results (screenshots from your live run)
9. Cost + future improvements (optional)
10. Q&A

## 11) Short Video Script (30–60 seconds)
Suggested flow:
1. 0–8s: “Appliances left ON waste energy. We fix that.”
2. 8–20s: show dashboard live power increasing when relay turns ON.
3. 20–40s: “When current/power exceeds limit, the system automatically turns OFF.”
4. 40–55s: show relay OFF + toast event.
5. 55–60s: “Real-time sensing + safe automation.”

## 12) Where to find your code files
- Dashboard UI: `[app/page.tsx](/home/vikas/Desktop/magicode/prakalp26/app/page.tsx)`
- Sensor payload types: `[lib/types.ts](/home/vikas/Desktop/magicode/prakalp26/lib/types.ts)`
- ESP32 firmware: `[firmware/energy_guardian_esp32_ws.ino](/home/vikas/Desktop/magicode/prakalp26/firmware/energy_guardian_esp32_ws.ino)`
- Hardware calibration doc: `[docs/energy-guardian-hardware.md](/home/vikas/Desktop/magicode/prakalp26/docs/energy-guardian-hardware.md)`

