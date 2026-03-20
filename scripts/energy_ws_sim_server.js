/**
 * Energy Guardian WebSocket simulator (for integration testing).
 *
 * It hosts a WS server at /ws and streams JSON payloads that match
 * the dashboard's expected `SensorData` keys:
 *   current_a, voltage_v, power_w, energy_kwh, relay_status, event
 *
 * Scenario:
 * - relay starts ON at safe current
 * - after SAFE_DURATION_MS, current goes over limit
 * - after OVER_LIMIT_HOLD_MS, simulator emits OVER_CURRENT event and turns relay OFF
 */

const WebSocket = require("ws");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const WS_PATH = process.env.WS_PATH || "/ws";

const VOLTAGE_V = 230;
const SEND_INTERVAL_MS = 1000;

// Mirror the dashboard/firmware defaults (tuned for quick tests).
const CURRENT_LIMIT_A = 2.5;
const POWER_LIMIT_W = 600;
const OVER_LIMIT_HOLD_MS = 3000;

const SAFE_DURATION_MS = 5000;

let relayOn = true;
let energyKwh = 0;
let lastTs = Date.now();

let overLimitStartTs = null;
let eventToSend = "";

const wss = new WebSocket.Server({ port: PORT, path: WS_PATH });
console.log(`[ws-sim] Listening: ws://localhost:${PORT}${WS_PATH}`);

function currentAndEvent(nowMs) {
  if (!relayOn) return { currentA: 0, powerW: 0, event: "" };

  // Over-limit window starts at SAFE_DURATION_MS.
  const t = nowMs - startTs;
  let currentA;
  if (t < SAFE_DURATION_MS) {
    currentA = 1.2; // safe
  } else {
    currentA = 3.0; // unsafe (over both limits depending on limits)
  }

  const powerW = currentA * VOLTAGE_V;

  // Decide when to latch an event.
  const overNow = currentA > CURRENT_LIMIT_A || powerW > POWER_LIMIT_W;
  if (overNow) {
    if (overLimitStartTs == null) overLimitStartTs = nowMs;
    if (eventToSend === "" && nowMs - overLimitStartTs >= OVER_LIMIT_HOLD_MS) {
      eventToSend = "OVER_CURRENT";
    }
  } else {
    overLimitStartTs = null;
    eventToSend = "";
  }

  const outEvent = eventToSend;
  // Event is sent for a single message; firmware-like behavior.
  if (eventToSend) {
    // Turn off relay immediately after event is latched.
    relayOn = false;
    overLimitStartTs = null;
  }
  return { currentA, powerW, event: outEvent };
}

const startTs = Date.now();

setInterval(() => {
  const now = Date.now();
  const { currentA, powerW, event } = currentAndEvent(now);

  // Integrate energy (kWh) based on simulated power.
  const dtMs = now - lastTs;
  lastTs = now;
  const dtHours = dtMs / 3600000;
  energyKwh += (powerW * dtHours) / 1000;

  const payload = {
    current_a: Number(currentA.toFixed(3)),
    voltage_v: Number(VOLTAGE_V.toFixed(2)),
    power_w: Number(powerW.toFixed(2)),
    energy_kwh: Number(energyKwh.toFixed(4)),
    relay_status: relayOn ? "ON" : "OFF",
    event: event || "",
  };

  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}, SEND_INTERVAL_MS);

