# Energy Guardian (Auto-Off) Hardware Prototype

## What this prototype does
Your ESP32 continuously measures:
- `current_a` (Amps) using a current sensor
- `voltage_v` (Volts) using a voltage divider
- `power_w` (Watts) = `voltage_v * current_a`
- `energy_kwh` (kWh) by integrating power over time

Then it automatically switches the load **OFF** (via relay) if:
- over-current / over-power happens for more than a small hold time, and/or
- the load stays ON longer than `MAX_ON_MINUTES`.

It also sends JSON to the dashboard, which updates gauges/charts in real time.

## Safe expo demo setup (important)
Relay modules often switch **mains AC**. For safety:
- Use a **low-watt demonstrator load** (LED bulb / small fan) during demo.
- Keep wiring neat, insulated, and away from students.
- Do not touch live mains parts while powered.

## Recommended demo components (typical)
- `ESP32` (reads analog sensors + controls relay)
- `Relay module` (1-channel)
- Current sensor (choose one):
  - `ACS712` (analog output, easiest for this prototype)
  - or another analog current sensor with datasheet sensitivity
- Voltage divider for measuring mains (analog input):
  - resistor network (R1/R2) sized to match ESP32 ADC range
- Breadboard + jumper wires

## Wiring (block-level)
### Current sensing
- Current sensor `OUT` -> ESP32 analog input `A0`
- Current sensor `VCC` -> 5V/3.3V (as per module)
- Current sensor `GND` -> ESP32 GND

### Voltage sensing (voltage divider)
- Voltage divider output -> ESP32 analog input `A1`
- Divider resistors connect across the measured voltage according to your design

### Relay control
- Relay `IN` -> ESP32 digital output pin (example: `D5`)
- Relay `VCC` -> 5V (as required by module)
- Relay `GND` -> ESP32 GND

## Calibration: getting correct `current_a` and `voltage_v`

### Step 1: Calibrate ADC zero (no-load current)
1. Ensure the load is OFF (current = 0A).
2. Collect ADC readings from the current sensor output:
   - `adc_zero = average(ADC samples)`
3. Convert ADC -> volts in firmware:
   - `Vzero = adc_zero * (VREF / ADC_MAX)`

Notes:
- `ADC_MAX` = 4095 for ESP32 12-bit ADC (if you use default).
- Use many samples (e.g., 200–1000) to reduce noise.

### Step 2: Calibrate current sensor sensitivity (scale)
You need one known reference current `Iknown`:
- easiest reference: measure a known AC load using a multimeter/clamp meter
- example: 60W at 230V implies `I ≈ 60/230 ≈ 0.26A`

Then:
1. Apply the known load so current is `Iknown`.
2. Read `adc_known` (average).
3. Convert to volts:
   - `Vknown = adc_known * (VREF / ADC_MAX)`
4. Solve sensitivity:
   - `sensitivity_V_per_A = (Vknown - Vzero) / Iknown`

In firmware, current becomes:
- `current_a = (Vadc - Vzero) / sensitivity_V_per_A`

### Step 3: Calibrate voltage divider ratio (to get real volts)
If your voltage divider is designed using resistors `R1` (top) and `R2` (bottom):
- `divider_ratio = (R1 + R2) / R2`
- `voltage_v = Vadc * divider_ratio`

If you want higher accuracy:
1. Measure real mains voltage with a multimeter as `Vreal`
2. Read ADC voltage as `Vadc`
3. Compute:
   - `divider_ratio = Vreal / Vadc`

### Step 4: Validate `power_w`
With a known load:
- `power_w` should be close to `Vreal * Iknown`

### Step 5: Validate `energy_kwh`
Let the load run for a fixed demo duration (e.g., 1 minute).
Compare approximate energy with:
- `E_kWh ≈ Power_W * seconds / 3600 / 1000`

## Integration formula used in firmware
If firmware samples every `dt_ms` milliseconds:
- `dt_hours = dt_ms / 3_600_000`
- `energy_kwh += power_w * dt_hours / 1000`

## Relay auto-off behavior (demo-friendly)
Typical parameters to start with:
- `CURRENT_LIMIT_A` (e.g., 2.5A)
- `POWER_LIMIT_W` (e.g., 600W)
- `OVERCURRENT_HOLD_SEC` (e.g., 3–5 seconds to avoid noise triggers)
- `MAX_ON_MINUTES` (e.g., 2–10 minutes depending on your demo load)

Expo goal:
- Show values increasing when relay turns ON
- Trigger auto-off quickly and clearly
- Dashboard shows a toast/event and relay state flips

