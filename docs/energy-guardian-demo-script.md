# Demo Script (Judge Runbook)

## Goal
Show sensing + decision + action in under 5 minutes.

## Run
1. Turn relay ON (or wait for auto-on after ESP32 boot).
2. On dashboard, point to:
   - `Power (W)` increasing
   - `Current (A)` rising
   - `Energy (kWh)` starting to grow
3. Trigger over-limit (use a higher load until limits are crossed).
4. Watch dashboard toast:
   - `OVER_CURRENT` (or time-limit event)
5. Confirm physical action:
   - relay turns OFF
   - power falls close to zero on chart
6. Summarize:
   - “Auto-off reduces wasted energy and improves safety.”

