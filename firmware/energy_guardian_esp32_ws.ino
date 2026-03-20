/*
Energy Guardian (Auto-Off) firmware for ESP32
------------------------------------------------
What it does:
- Hosts a WebSocket server (so your Next.js dashboard can connect)
- Reads:
  - current sensor on analog pin A0 (current_a)
  - voltage divider on analog pin A1 (voltage_v)
- Computes:
  - power_w = voltage_v * current_a
  - energy_kwh by integrating power over time
- Controls relay output with auto-off rules:
  - over-current / over-power (with hold time)
  - max ON time
- Sends JSON payload to all WS clients:
  {
    "current_a": <number>,
    "voltage_v": <number>,
    "power_w": <number>,
    "energy_kwh": <number>,
    "relay_status": "ON" | "OFF",
    "event": "OVER_CURRENT" | "TIME_LIMIT_REACHED" | ""
  }

Important:
- This sketch assumes you will connect it via a WebSocket URL like:
    ws://<ESP32_IP>/ws
  so set NEXT_PUBLIC_ESP32_WS_URL in your dashboard to match.
- Safety: test with a low-watt demo load. Keep mains wiring insulated.

Libraries required in Arduino IDE:
- ESPAsyncWebServer
- AsyncTCP (for ESP32)
*/

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>

// -------------------- WiFi --------------------
static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// -------------------- WebSocket --------------------
static const uint16_t WS_PORT = 80;
static const char* WS_PATH = "/ws";

AsyncWebServer server(WS_PORT);
AsyncWebSocket ws(WS_PATH);

// -------------------- Pins (edit to match your wiring) --------------------
static const int PIN_CURRENT_ADC = 34; // analog-capable pin
static const int PIN_VOLT_ADC = 35;    // analog-capable pin
static const int PIN_RELAY = 5;         // change if needed

static const bool RELAY_ACTIVE_LOW = true; // many relay modules are active-low

// -------------------- ADC + calibration constants --------------------
// ESP32 ADC details vary; calibrate Vzero and sensitivity using docs/scripts.
static const float ADC_VREF = 3.3f;
static const int ADC_MAX = 4095; // default 12-bit resolution

// Current sensor calibration:
// From calibration docs/script:
// current_a = (Vadc - Vzero) / sensitivity_V_per_A
static const float CURRENT_VZERO = 1.65f;            // voltage at 0A
static const float CURRENT_SENSITIVITY_V_PER_A = 0.066f; // Example for ACS712 5A (adjust)

// Voltage divider calibration:
// voltage_v = Vadc * VOLTAGE_DIVIDER_RATIO
static const float VOLTAGE_DIVIDER_RATIO = 5.0f; // adjust to your resistor network

// -------------------- Auto-off rules (edit for your demo) --------------------
static const float CURRENT_LIMIT_A = 2.5f;
static const float POWER_LIMIT_W = 600.0f;

static const uint32_t OVER_LIMIT_HOLD_MS = 3000; // must exceed for 3s
static const uint32_t MAX_ON_MINUTES = 5;         // demo-friendly default

static const uint32_t SEND_INTERVAL_MS = 2000;

// -------------------- State --------------------
static bool relayOn = false;
static uint32_t relayOnSinceMs = 0;

static uint32_t overLimitStartMs = 0; // when over-limit first detected
static bool overLimitLatched = false;

static float energyKwh = 0.0f;
static uint32_t lastSampleMs = 0;

static String lastEvent = "";

// -------------------- Helpers --------------------
static float readAdcVoltage(int pin) {
  int raw = analogRead(pin);
  if (raw < 0) raw = 0;
  float v = (raw * (ADC_VREF / (float)ADC_MAX));
  return v;
}

static float readCurrentA() {
  float vAdc = readAdcVoltage(PIN_CURRENT_ADC);
  float current = (vAdc - CURRENT_VZERO) / CURRENT_SENSITIVITY_V_PER_A;
  if (current < 0) current = 0; // no negative current for demo
  return current;
}

static float readVoltageV() {
  float vAdc = readAdcVoltage(PIN_VOLT_ADC);
  return vAdc * VOLTAGE_DIVIDER_RATIO;
}

static float computePowerW(float v, float i) {
  return v * i;
}

static void setRelay(bool on) {
  relayOn = on;
  // Many relay boards are active-low:
  // on  => LOW, off => HIGH
  digitalWrite(PIN_RELAY, (RELAY_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW)));

  if (relayOn) {
    relayOnSinceMs = millis();
  }
}

static String jsonPayload(float currentA, float voltageV, float powerW) {
  // Send event only when it is set; caller should clear after send.
  // JSON values:
  // - numeric: plain numbers
  // - strings: quoted
  String event = lastEvent;
  String relayStr = relayOn ? "ON" : "OFF";

  // Use fixed decimals for readability (dashboard parses as number).
  String payload = "{";
  payload += "\"current_a\":" + String(currentA, 3) + ",";
  payload += "\"voltage_v\":" + String(voltageV, 2) + ",";
  payload += "\"power_w\":" + String(powerW, 2) + ",";
  payload += "\"energy_kwh\":" + String(energyKwh, 4) + ",";
  payload += "\"relay_status\":\"" + relayStr + "\",";
  payload += "\"event\":\"" + event + "\"";
  payload += "}";
  return payload;
}

// -------------------- WebSocket events --------------------
static void onWsEvent(AsyncWebSocket* server, AsyncWebSocketClient* client, AwsEventType type, void* arg, uint8_t* data, size_t len) {
  (void)server;
  (void)client;
  (void)arg;
  (void)data;
  (void)len;

  if (type == WS_EVT_CONNECT) {
    // Nothing required for now; we push data in loop.
  }
}

// -------------------- Setup --------------------
void setup() {
  Serial.begin(115200);

  pinMode(PIN_RELAY, OUTPUT);
  setRelay(false);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  ws.onEvent(onWsEvent);
  server.addHandler(&ws);
  server.begin();

  // Start demo: turn relay ON shortly after boot so the expo can immediately observe changes.
  delay(3000);
  setRelay(true);

  lastSampleMs = millis();
}

// -------------------- Loop --------------------
void loop() {
  // Allow WS clients to process events.
  // (AsyncWebServer runs in background; loop only needs to update measurements and send.)

  const uint32_t now = millis();

  // Sample + integrate at SEND_INTERVAL_MS (simple for demo)
  if (now - lastSampleMs >= SEND_INTERVAL_MS) {
    const uint32_t dtMs = now - lastSampleMs;
    lastSampleMs = now;

    float currentA = readCurrentA();
    float voltageV = readVoltageV();
    float powerW = computePowerW(voltageV, currentA);

    // Integrate energy (kWh):
    // dtHours = dtMs / 3.6e6
    // energy_kwh += power_w * dtHours / 1000
    float dtHours = (float)dtMs / 3600000.0f;
    energyKwh += (powerW * dtHours) / 1000.0f;

    // Auto-off logic only when relay is ON.
    if (relayOn) {
      const bool overLimitNow = (currentA > CURRENT_LIMIT_A) || (powerW > POWER_LIMIT_W);

      if (overLimitNow) {
        if (overLimitStartMs == 0) overLimitStartMs = now;
        // Trigger after hold time
        if (!overLimitLatched && (now - overLimitStartMs) >= OVER_LIMIT_HOLD_MS) {
          lastEvent = "OVER_CURRENT";
          setRelay(false);
          overLimitLatched = true;
        }
      } else {
        // Reset over-limit detector when values return safe
        overLimitStartMs = 0;
        overLimitLatched = false;
      }

      // Max ON time rule
      if (relayOn) {
        const uint32_t onMinutes = (now - relayOnSinceMs) / 60000;
        if (onMinutes >= MAX_ON_MINUTES) {
          lastEvent = "TIME_LIMIT_REACHED";
          setRelay(false);
        }
      }
    }

    // Broadcast payload to all connected dashboards
    String payload = jsonPayload(currentA, voltageV, powerW);
    ws.textAll(payload);

    // Clear event after one message so toasts behave nicely.
    lastEvent = "";
  }

  delay(5);
}

