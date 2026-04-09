/**
 * ════════════════════════════════════════════════════════════
 *  EnthutechIoT Library — Example 2: Full Bidirectional
 * ════════════════════════════════════════════════════════════
 *
 *  ✅ Sends sensor data    (ESP32 → Dashboard)
 *  ✅ Receives commands    (Dashboard → ESP32)
 *  ✅ Reports device state (LED/relay) back to dashboard
 *
 *  Dashboard setup:
 *   1. Add device  → copy Device ID and API Key below
 *   2. Add Widget: type=Value,  variable=temperature
 *   3. Add Widget: type=Gauge,  variable=humidity
 *   4. Add Widget: type=Toggle, variable=led        ← controls LED
 *   5. Add Widget: type=Toggle, variable=relay      ← controls relay
 *
 *  Wiring:
 *   • LED    → GPIO 2  (built-in on most ESP32 boards)
 *   • Relay  → GPIO 4  (active HIGH)
 *   • Buzzer → GPIO 5  (optional)
 */

#include <EnthutechIoT.h>

// ── Credentials ──────────────────────────────────────────────
const char* WIFI_SSID  = "IoT";
const char* WIFI_PASS  = "123456789";
const char* DEVICE_ID  = "DEV-21FED1CA";
const char* API_KEY    = "ET-1654823D42AC25E2F9590AD8";
const char* SERVER_IP  = "10.44.130.136";

// ── Pin definitions ──────────────────────────────────────────
#define LED_PIN    2
#define RELAY_PIN  4
#define BUZZER_PIN 5

// ── Device state (mirrors what dashboard shows) ───────────────
bool ledState   = false;
bool relayState = false;

// ── IoT client ───────────────────────────────────────────────
EnthutechIoT iot(DEVICE_ID, API_KEY);

// ════════════════════════════════════════════════════════════
//  onCommand() — called when Dashboard sends a command
//
//  key   = widget variable name (e.g. "led", "relay")
//  value = "true" / "false" / "128" / any String
// ════════════════════════════════════════════════════════════
void handleCommand(String key, String value) {
    Serial.printf("[CMD] Received: %s = %s\n", key.c_str(), value.c_str());

    if (key == "led") {
        ledState = (value == "true" || value == "1");
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
        Serial.printf("  LED is now %s\n", ledState ? "ON" : "OFF");
    }

    else if (key == "relay") {
        relayState = (value == "true" || value == "1");
        digitalWrite(RELAY_PIN, relayState ? HIGH : LOW);
        Serial.printf("  Relay is now %s\n", relayState ? "ON" : "OFF");
    }

    else if (key == "buzzer") {
        // value = frequency (e.g. "1000") or "0" to stop
        int freq = value.toInt();
        if (freq > 0)  tone(BUZZER_PIN, freq, 500);
        else           noTone(BUZZER_PIN);
    }

    else if (key == "blink") {
        // Blink the LED N times (value = count)
        int times = value.toInt();
        for (int i = 0; i < times; i++) {
            digitalWrite(LED_PIN, HIGH); delay(150);
            digitalWrite(LED_PIN, LOW);  delay(150);
        }
        ledState = false;
    }

    else if (key == "reset") {
        Serial.println("  Restarting ESP32 by command!");
        delay(500);
        ESP.restart();
    }

    // ── After any command, report current state back ──────────
    iot.beginPayload();
    iot.addField("led",   ledState);
    iot.addField("relay", relayState);
    iot.sendPayload();
}

// ════════════════════════════════════════════════════════════
void setup() {
    pinMode(LED_PIN,    OUTPUT);
    pinMode(RELAY_PIN,  OUTPUT);

    // Startup blink — shows the device is alive
    for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH); delay(100);
        digitalWrite(LED_PIN, LOW);  delay(100);
    }

    // Register command callback BEFORE begin()
    iot.onCommand(handleCommand);

    // Set status LED (blinks briefly every time data is sent)
    iot.setStatusLED(LED_PIN);

    // Connect to WiFi + EnthutechIoT server
    iot.begin(WIFI_SSID, WIFI_PASS, SERVER_IP);

    Serial.println("\n✅ EnthutechIoT ready!");
    Serial.println("  Toggle widgets on the dashboard to control this device.");
}

// ════════════════════════════════════════════════════════════
unsigned long lastSend = 0;

void loop() {
    // ── 1. Always call iot.loop() first ──────────────────────
    iot.loop();

    // ── 2. Send sensor + status data every 5 seconds ─────────
    if (millis() - lastSend >= 5000) {
        lastSend = millis();

        float temp  = 20.0 + random(0, 150) / 10.0;
        float humid = 40.0 + random(0, 500) / 10.0;

        iot.beginPayload();
        iot.addField("temperature", temp);
        iot.addField("humidity",    humid);
        iot.addField("led",         ledState);    // report current LED state
        iot.addField("relay",       relayState);  // report relay state
        iot.addField("uptime",      (int)(millis() / 1000));
        iot.addField("rssi",        iot.getRSSI());
        iot.sendPayload();

        Serial.printf("[DATA] temp=%.1f  humid=%.1f  led=%s  relay=%s\n",
                       temp, humid,
                       ledState   ? "ON" : "OFF",
                       relayState ? "ON" : "OFF");
    }
}
