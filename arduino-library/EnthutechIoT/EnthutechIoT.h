/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║              EnthutechIoT Arduino Library               ║
 * ║         For ESP32 · ESP8266 · Arduino with WiFi         ║
 * ║                                                          ║
 * ║  Features:                                               ║
 * ║  • WebSocket client (built from scratch, no deps)        ║
 * ║  • Bidirectional: send data + receive commands           ║
 * ║  • Auto WiFi + WebSocket reconnect                       ║
 * ║  • Simple 3-function API                                 ║
 * ║  • HTTP POST fallback if WebSocket fails                 ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 *  BASIC USAGE:
 *  ─────────────────────────────────────────────────────────
 *  #include <EnthutechIoT.h>
 *
 *  EnthutechIoT iot("DEV-XXXXXXXX", "ET-APIKEY...");
 *
 *  void onCommand(String key, String value) {
 *    if (key == "led") digitalWrite(2, value == "true");
 *  }
 *
 *  void setup() {
 *    iot.begin("WiFi_SSID", "WiFi_Pass", "192.168.1.x");
 *    iot.onCommand(onCommand);
 *  }
 *
 *  void loop() {
 *    iot.loop();                      // ← always call this
 *    iot.send("temperature", 25.4f); // ← send a value
 *    delay(5000);
 *  }
 */

#ifndef ENTHUTECH_IOT_H
#define ENTHUTECH_IOT_H

#include <Arduino.h>
#include <WiFi.h>

// ── Callback type for incoming commands ──────────────────────
typedef void (*ETCommandCallback)(String key, String value);

// ── Library version ──────────────────────────────────────────
#define ENTHUTECH_IOT_VERSION "2.0.0"

// ── Timeouts & intervals (ms) ────────────────────────────────
#define ET_WIFI_TIMEOUT       15000
#define ET_WS_PING_INTERVAL   20000
#define ET_RECONNECT_INTERVAL  5000
#define ET_READ_TIMEOUT        2000
#define ET_HTTP_TIMEOUT        8000

class EnthutechIoT {
public:
    // ── Constructor ──────────────────────────────────────────
    EnthutechIoT(const char* deviceId, const char* apiKey);

    // ── Setup ────────────────────────────────────────────────
    /**
     * Connect to WiFi and the EnthutechIoT server.
     * @param ssid       WiFi SSID
     * @param password   WiFi password
     * @param serverHost Server IP or hostname (e.g. "10.44.130.136")
     * @param serverPort Server port (default: 4000)
     */
    void begin(const char* ssid, const char* password,
               const char* serverHost, uint16_t serverPort = 4000);

    /**
     * HTTP / HTTPS mode — no persistent WebSocket connection.
     * ESP32 POSTs sensor data and GETs pending commands periodically.
     * @param ssid        WiFi SSID
     * @param password    WiFi password
     * @param serverHost  Server hostname or IP
     * @param serverPort  Server port (default 4000; use 443 for HTTPS)
     */
    void beginHTTP(const char* ssid, const char* password,
                   const char* serverHost, uint16_t serverPort = 4000);

    /** Enable HTTPS (TLS). Must be called BEFORE beginHTTP(). */
    void setSecure(bool secure);   // default: false

    // ── Must be called every loop() ─────────────────────────
    /**
     * Handles: WebSocket polling, command parsing,
     *          auto-reconnect for WiFi + WS, keepalive pings.
     */
    void loop();

    // ── Send sensor data ─────────────────────────────────────
    void send(const char* key, float value);
    void send(const char* key, int value);
    void send(const char* key, bool value);
    void send(const char* key, const char* value);
    void send(const char* key, String value);

    // ── Batch / multi-field payload ──────────────────────────
    /**
     * Build a payload with multiple fields:
     *
     *   iot.beginPayload();
     *   iot.addField("temp",  25.4f);
     *   iot.addField("humid", 68.0f);
     *   iot.addField("led",   true);
     *   iot.sendPayload();
     */
    void beginPayload();
    void addField(const char* key, float value, int decimals = 2);
    void addField(const char* key, int value);
    void addField(const char* key, bool value);
    void addField(const char* key, const char* value);
    void addField(const char* key, String value);
    /**
     * In WebSocket mode: sends batch payload over WS.
     * In HTTP mode:      POSTs batch payload to /api/v1/devices/:id/ingest
     */
    void sendPayload();

    // ── Downlink polling (HTTP / HTTPS mode only) ────────────
    /**
     * Poll the server for pending commands and execute the callback.
     * Call every 3-5 seconds in loop().
     * In WebSocket mode, commands arrive automatically — no need to call this.
     */
    void pollCommands();

    // ── Command handler ──────────────────────────────────────
    /**
     * Register callback for commands sent from the dashboard.
     * key   = variable name (e.g. "led", "relay", "speed")
     * value = value as String ("true"/"false", "255", etc.)
     *
     * Example:
     *   void handleCmd(String key, String value) {
     *     if (key == "led") digitalWrite(2, value == "true");
     *   }
     *   iot.onCommand(handleCmd);
     */
    void onCommand(ETCommandCallback callback);

    // ── Status & info ────────────────────────────────────────
    bool    isWiFiConnected();
    bool    isServerConnected();
    String  getDeviceId();
    String  getVersion();
    int     getRSSI();

    // ── Debug output ─────────────────────────────────────────
    void setDebug(bool enable);   // default: true
    void setStatusLED(int pin);   // optional LED, blinks on data

private:
    // Config
    const char* _deviceId;
    const char* _apiKey;
    const char* _ssid;
    const char* _password;
    const char* _host;
    uint16_t    _port;

    // WiFi client (raw TCP → WebSocket)
    WiFiClient _client;
    bool       _wsConnected    = false;
    bool       _wsHandshakeDone = false;
    bool       _debug          = true;
    bool       _httpMode       = false;   // true = HTTP/HTTPS, no persistent WS
    bool       _secure         = false;   // true = HTTPS (WiFiClientSecure)
    int        _ledPin         = -1;

    // Callback
    ETCommandCallback _commandCb = nullptr;

    // Batch payload state
    String _batchPayload;
    bool   _batchStarted = false;
    int    _fieldCount   = 0;

    // Timing
    unsigned long _lastReconnectAttempt = 0;
    unsigned long _lastPingSent         = 0;
    unsigned long _lastDataSent         = 0;

    // ── Internal helpers ─────────────────────────────────────
    bool   _connectWiFi();
    bool   _connectWebSocket();
    bool   _doHandshake();
    void   _disconnect();

    // WebSocket frame I/O
    void   _wsSendText(const String& data);
    void   _wsSendPing();
    void   _wsPollFrames();
    bool   _wsReadFrame(String& outPayload, uint8_t& outOpcode);
    uint8_t _readByte(uint32_t timeoutMs = ET_READ_TIMEOUT);

    // HTTP helpers
    bool   _sendHTTP(const char* method, const String& path, const String& body, String& respBody);
    String _httpIngest(const String& jsonBody);   // POST to /ingest
    String _httpPollCmds();                        // GET  /commands

    // Protocol helpers
    String _buildDataFrame(const String& jsonFields);
    void   _handleIncoming(const String& msg);
    void   _sendCommandAck(const String& key, const String& value);
    void   _ackHTTP(const String& key, const String& value, const String& cmdId);

    // JSON mini-parser
    String _jsonGet(const String& json, const String& key);
    bool   _jsonGetBool(const String& json, const String& key);

    // Utility
    void   _dbg(const String& msg);
    void   _dbgf(const char* fmt, ...);
    void   _blinkLED();
    String _floatToStr(float v, int dec);
};

#endif // ENTHUTECH_IOT_H
