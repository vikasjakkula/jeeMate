# Energy Guardian ESP32 Firmware Notes

## 1) Install required Arduino libraries
- `ESPAsyncWebServer`
- `AsyncTCP` (ESP32)

## 2) Set WiFi credentials
Edit these in `energy_guardian_esp32_ws.ino`:
- `WIFI_SSID`
- `WIFI_PASS`

## 3) WebSocket URL to use in the dashboard
This firmware hosts a WebSocket server at:
- Path: `/ws`
- Scheme: `ws://`

So in your dashboard `.env.local` set:
`NEXT_PUBLIC_ESP32_WS_URL=ws://<ESP32_IP>/ws`

## 4) Sensor calibration
Before you trust values, calibrate:
- `CURRENT_VZERO` and `CURRENT_SENSITIVITY_V_PER_A`
- `VOLTAGE_DIVIDER_RATIO`

Use:
- `docs/energy-guardian-hardware.md`
- `scripts/energy_guardian_calibration.py`

## 5) Safety
Use a low-watt demonstrator load in expo. Keep relay + mains wiring insulated.

