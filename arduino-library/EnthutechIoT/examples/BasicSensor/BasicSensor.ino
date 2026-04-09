/**
 * ════════════════════════════════════════════════════════════
 *  EnthutechIoT Library — Example 1: Basic Sensor
 * ════════════════════════════════════════════════════════════
 *
 *  Sends temperature + humidity (simulated) to EnthutechIoT
 *  dashboard every 5 seconds.
 *
 *  Dashboard setup:
 *   1. Add device  → copy the Device ID and API Key
 *   2. Add Widget  → type: Value, variable: temperature
 *   3. Add Widget  → type: Gauge, variable: humidity
 *
 *  Hardware:
 *   • ESP32 (any board)
 *   • No extra hardware needed for simulation
 *   • Optional: DHT11/DHT22 sensor for real readings
 */

#include <EnthutechIoT.h>

// ── Your project credentials ────────────────────────────────
// Copy these from the Device card on the dashboard
const char* WIFI_SSID   = "IoT";
const char* WIFI_PASS   = "123456789";
const char* DEVICE_ID   = "DEV-21FED1CA";    // ← from dashboard
const char* API_KEY     = "ET-1654823D42AC25E2F9590AD8"; // ← from dashboard
const char* SERVER_IP   = "10.44.130.136";   // ← your PC's local IP

// ── Create IoT client ────────────────────────────────────────
EnthutechIoT iot(DEVICE_ID, API_KEY);

// ── Timing ───────────────────────────────────────────────────
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 5000;   // send every 5 s

void setup() {
    // Optional: blink the built-in LED when data is sent
    iot.setStatusLED(2);   // ESP32 built-in LED = GPIO 2

    // Connect to WiFi + server
    iot.begin(WIFI_SSID, WIFI_PASS, SERVER_IP);

    Serial.println("Ready! Sending data every 5 seconds...");
}

void loop() {
    iot.loop();   // ← must always be the first line in loop()

    if (millis() - lastSend >= SEND_INTERVAL_MS) {
        lastSend = millis();

        // ── Read sensors (simulated random values here) ──────
        float temperature = 20.0 + random(0, 150) / 10.0;  // 20–35°C
        float humidity    = 40.0 + random(0, 500) / 10.0;  // 40–90%
        int   rssi        = iot.getRSSI();

        // ── Option A: send one value at a time ───────────────
        iot.send("temperature", temperature);
        iot.send("humidity",    humidity);
        iot.send("rssi",        rssi);

        // ── Option B: send multiple values in one payload ────
        // iot.beginPayload();
        // iot.addField("temperature", temperature);
        // iot.addField("humidity",    humidity);
        // iot.addField("rssi",        rssi);
        // iot.sendPayload();

        // ── Print to Serial Monitor ──────────────────────────
        Serial.printf("Sent → temp: %.1f°C  humid: %.1f%%  rssi: %d dBm\n",
                       temperature, humidity, rssi);
    }
}
