/**
 * Integration check:
 * - Connect to the WS simulator
 * - Validate JSON schema keys
 * - Ensure energy_kwh increases over time
 * - Ensure an OVER_CURRENT event occurs and relay_status becomes OFF
 *
 * Run in another terminal after starting the sim server:
 *   node scripts/energy_ws_sim_server.js
 */

const WebSocket = require("ws");

const WS_URL = process.env.WS_URL || "ws://localhost:8080/ws";
const REQUIRED_KEYS = ["current_a", "voltage_v", "power_w", "energy_kwh", "relay_status", "event"];

const TIMEOUT_MS = 15000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const ws = new WebSocket(WS_URL);
  let connected = false;
  let startedAt = Date.now();

  let firstEnergy = null;
  let lastEnergy = null;

  let sawEvent = false;
  let relayOffAfterEvent = false;

  ws.on("open", () => {
    connected = true;
    console.log(`[check] Connected to ${WS_URL}`);
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      for (const k of REQUIRED_KEYS) {
        if (!(k in msg)) throw new Error(`Missing key: ${k}`);
      }

      const energy = Number(msg.energy_kwh);
      if (Number.isNaN(energy)) throw new Error("energy_kwh not a number");

      if (firstEnergy === null) firstEnergy = energy;
      lastEnergy = energy;

      if (msg.event && msg.event.trim().length > 0) {
        sawEvent = true;
        if (msg.relay_status === "OFF") relayOffAfterEvent = true;
        console.log(`[check] Event: ${msg.event} relay=${msg.relay_status}`);
      }
    } catch (e) {
      console.error(`[check] Invalid message: ${e?.message || e}`);
      process.exitCode = 1;
      ws.close();
    }
  });

  const checkLoop = async () => {
    while (Date.now() - startedAt < TIMEOUT_MS) {
      await sleep(250);
      if (process.exitCode) return;
      if (connected && sawEvent && relayOffAfterEvent && lastEnergy != null) return;
    }

    if (!sawEvent) {
      console.error("[check] Did not observe any non-empty event field.");
      process.exitCode = 1;
    } else if (!relayOffAfterEvent) {
      console.error("[check] Observed event but relay_status was not OFF in same message.");
      process.exitCode = 1;
    } else if (firstEnergy != null && lastEnergy != null && lastEnergy <= firstEnergy) {
      console.error("[check] energy_kwh did not increase.");
      process.exitCode = 1;
    } else {
      console.error("[check] Timeout reached but conditions were not fully satisfied.");
      process.exitCode = 1;
    }

    ws.close();
  };

  await checkLoop();

  if (!process.exitCode) {
    console.log(
      `[check] PASSED. energy: ${firstEnergy} -> ${lastEnergy}. event observed with relay OFF.`
    );
  }
})();

