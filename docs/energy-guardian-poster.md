# Poster Text: Smart Energy Guardian (Auto-Off)

## Headline
**Smart Energy Guardian (Auto-Off)**

## One-line Idea
ESP32 measures current/power and automatically switches appliances OFF when limits are crossed.

## Problem
- Appliances left ON wastes electricity.
- Overheating increases fire risk during unattended usage.

## Solution
- Current sensor + voltage divider for real-time sensing
- Compute Power and Integrated Energy (kWh)
- Relay-based auto-off using rules (overcurrent/overpower + max ON time)
- Web dashboard shows live values + alerts

## How It Works (3 steps)
1. Sense: measure `current_a` and `voltage_v`
2. Compute: `power_w = voltage_v * current_a` and `energy_kwh` (integration)
3. Act: relay OFF + event toast (e.g., `OVER_CURRENT`)

## Expected Benefits
- Reduced wasted electricity
- Safer operation
- Transparent real-time monitoring

