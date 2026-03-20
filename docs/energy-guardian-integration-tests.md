# Energy Guardian Integration Tests (WS -> Dashboard)

This section helps you validate the pipeline:
`(ESP32 WebSocket JSON) -> Next.js WebSocket client -> Dashboard UI (charts + toasts)`

Because you might not have ESP32 running during development, the repo includes a WS simulator.

## 1) Start the WebSocket simulator
In one terminal:

```bash
node scripts/energy_ws_sim_server.js
```

It streams JSON at `ws://localhost:8080/ws` with:
- `current_a`, `voltage_v`, `power_w`
- `energy_kwh` (increasing)
- `relay_status` and an `event` that becomes non-empty during an over-current scenario

## 2) Run the automated integration check
In a second terminal:

```bash
node scripts/run_energy_ws_integration_check.js
```

Expected:
- It prints a `PASSED` message.
- It verifies schema keys + that `energy_kwh` increases + that an event occurs with relay becoming `OFF`.

## 3) (Optional) Visual check in the dashboard UI
Set:
- `NEXT_PUBLIC_ESP32_WS_URL=ws://localhost:8080/ws`

Then start:
- `npm run dev`

Open the dashboard page in the browser.
You should see:
- Power chart rising while relay is ON
- A sudden event toast when over-limit happens
- Relay-related values switching after the event

## 4) Manual latency demo (for expo)
Once your real ESP32 is sending data:
1. Turn ON the relay with a safe load.
2. Increase load until over-limit triggers.
3. Measure time between:
   - the moment you change the load,
   - and the moment the dashboard toast appears.

Record this in your PPT.

