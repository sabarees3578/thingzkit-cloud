/**
 * EnthutechIoT.cpp
 * WebSocket client built from scratch — no external dependencies
 *
 * WebSocket protocol quick reference (RFC 6455):
 *  Handshake : HTTP GET with Upgrade: websocket headers
 *  Frame OUT : [0x81][0x80|len][mask×4][payload⊕mask]   (client→server, MUST mask)
 *  Frame IN  : [0x81][len][payload]                      (server→client, unmasked)
 *  Ping      : opcode 0x09, Pong: 0x0A
 *  Close     : opcode 0x08
 */

#include "EnthutechIoT.h"
#include <stdarg.h>
#if defined(ESP32) || defined(ESP8266)
  #include <WiFiClientSecure.h>
#endif

// ─────────────────────────────────────────────────────────────
//  Constructor
// ─────────────────────────────────────────────────────────────
EnthutechIoT::EnthutechIoT(const char* deviceId, const char* apiKey)
    : _deviceId(deviceId), _apiKey(apiKey) {}

// ─────────────────────────────────────────────────────────────
//  begin()
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::begin(const char* ssid, const char* password,
                          const char* serverHost, uint16_t serverPort) {
    _ssid     = ssid;
    _password = password;
    _host     = serverHost;
    _port     = serverPort;
    _httpMode = false;

    Serial.begin(115200);
    delay(100);

    _dbg("╔══════════════════════════════════╗");
    _dbg("║  EnthutechIoT v" + getVersion() + " (WebSocket) ║");
    _dbg("╚══════════════════════════════════╝");
    _dbgf("  Device ID : %s", _deviceId);
    _dbgf("  Server    : %s:%d", _host, _port);

    if (_ledPin >= 0) {
        pinMode(_ledPin, OUTPUT);
        digitalWrite(_ledPin, LOW);
    }

    _connectWiFi();
    _connectWebSocket();
}

// ───────────────────────────────────────────────────────────────
//  beginHTTP() — HTTP / HTTPS mode (no persistent WebSocket)
// ───────────────────────────────────────────────────────────────
void EnthutechIoT::beginHTTP(const char* ssid, const char* password,
                              const char* serverHost, uint16_t serverPort) {
    _ssid     = ssid;
    _password = password;
    _host     = serverHost;
    _port     = serverPort;
    _httpMode = true;

    Serial.begin(115200);
    delay(100);

    _dbg("╔══════════════════════════════════╗");
    _dbg("║  EnthutechIoT v" + getVersion() +
         (_secure ? " (HTTPS)  " : " (HTTP)   ") + "║");
    _dbg("╚══════════════════════════════════╝");
    _dbgf("  Device ID : %s", _deviceId);
    _dbgf("  Server    : %s:%d (%s)", _host, _port, _secure ? "HTTPS" : "HTTP");

    if (_ledPin >= 0) { pinMode(_ledPin, OUTPUT); digitalWrite(_ledPin, LOW); }

    _connectWiFi();
    _dbg("[HTTP] Ready — use sendPayload() to upload, pollCommands() to receive");
}

void EnthutechIoT::setSecure(bool secure) { _secure = secure; }


// ─────────────────────────────────────────────────────────────
//  loop()  — call every Arduino loop()
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::loop() {
    // ── WiFi watchdog ────────────────────────────────────────
    if (WiFi.status() != WL_CONNECTED) {
        if (_wsConnected) {
            _disconnect();
        }
        if (millis() - _lastReconnectAttempt > ET_RECONNECT_INTERVAL) {
            _lastReconnectAttempt = millis();
            _dbg("[WiFi] Lost connection — reconnecting...");
            _connectWiFi();
        }
        return;
    }

    // ── WebSocket watchdog ───────────────────────────────────
    if (!_wsConnected || !_client.connected()) {
        if (millis() - _lastReconnectAttempt > ET_RECONNECT_INTERVAL) {
            _lastReconnectAttempt = millis();
            _dbg("[WS] Not connected — reconnecting...");
            _connectWebSocket();
        }
        return;
    }

    // ── Poll incoming frames ─────────────────────────────────
    if (_client.available()) {
        _wsPollFrames();
    }

    // ── Keepalive ping every 20 s ────────────────────────────
    if (millis() - _lastPingSent > ET_WS_PING_INTERVAL) {
        _lastPingSent = millis();
        _wsSendPing();
    }
}

// ─────────────────────────────────────────────────────────────
//  send()  — single key/value
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::send(const char* key, float value) {
    String field = "\"" + String(key) + "\":" + _floatToStr(value, 2);
    String frame = _buildDataFrame(field);
    _wsSendText(frame);
    _blinkLED();
    _dbgf("[SEND] %s = %.2f", key, value);
}

void EnthutechIoT::send(const char* key, int value) {
    String field = "\"" + String(key) + "\":" + String(value);
    _wsSendText(_buildDataFrame(field));
    _blinkLED();
    _dbgf("[SEND] %s = %d", key, value);
}

void EnthutechIoT::send(const char* key, bool value) {
    String field = "\"" + String(key) + "\":" + (value ? "true" : "false");
    _wsSendText(_buildDataFrame(field));
    _blinkLED();
    _dbgf("[SEND] %s = %s", key, value ? "true" : "false");
}

void EnthutechIoT::send(const char* key, const char* value) {
    String field = "\"" + String(key) + "\":\"" + String(value) + "\"";
    _wsSendText(_buildDataFrame(field));
    _blinkLED();
    _dbgf("[SEND] %s = %s", key, value);
}

void EnthutechIoT::send(const char* key, String value) {
    send(key, value.c_str());
}

// ─────────────────────────────────────────────────────────────
//  Batch payload
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::beginPayload() {
    _batchPayload  = "";
    _batchStarted  = true;
    _fieldCount    = 0;
}

void _appendSep(String& p, int& cnt) {
    if (cnt++ > 0) p += ",";
}

void EnthutechIoT::addField(const char* key, float value, int decimals) {
    if (!_batchStarted) return;
    _appendSep(_batchPayload, _fieldCount);
    _batchPayload += "\"" + String(key) + "\":" + _floatToStr(value, decimals);
}
void EnthutechIoT::addField(const char* key, int value) {
    if (!_batchStarted) return;
    _appendSep(_batchPayload, _fieldCount);
    _batchPayload += "\"" + String(key) + "\":" + String(value);
}
void EnthutechIoT::addField(const char* key, bool value) {
    if (!_batchStarted) return;
    _appendSep(_batchPayload, _fieldCount);
    _batchPayload += "\"" + String(key) + "\":" + (value ? "true" : "false");
}
void EnthutechIoT::addField(const char* key, const char* value) {
    if (!_batchStarted) return;
    _appendSep(_batchPayload, _fieldCount);
    _batchPayload += "\"" + String(key) + "\":\"" + String(value) + "\"";
}
void EnthutechIoT::addField(const char* key, String value) {
    addField(key, value.c_str());
}

void EnthutechIoT::sendPayload() {
    if (!_batchStarted || _fieldCount == 0) return;
    _batchStarted = false;

    if (_httpMode) {
        // HTTP/HTTPS mode: POST to /ingest
        String body = "{" + _batchPayload + "}";
        _httpIngest(body);
        _blinkLED();
        _dbg("[HTTP] Payload sent: " + body);
    } else {
        // WebSocket mode
        _wsSendText(_buildDataFrame(_batchPayload));
        _blinkLED();
        _dbg("[SEND] Batch payload: {" + _batchPayload + "}");
    }
}

// ───────────────────────────────────────────────────────────────
//  pollCommands()  — HTTP/HTTPS downlink: fetch & execute queued commands
// ───────────────────────────────────────────────────────────────
void EnthutechIoT::pollCommands() {
    if (WiFi.status() != WL_CONNECTED) return;

    String resp = _httpPollCmds();
    if (resp.length() == 0) return;

    // Parse response: {"commands":[{"key":"led","value":"true","id":"..."}], "count":1}
    int countIdx = resp.indexOf("\"count\":");
    if (countIdx < 0) return;

    int count = resp.substring(countIdx + 8).toInt();
    if (count == 0) return;

    _dbgf("[POLL] %d command(s) received", count);

    // Walk through each command object in the array
    int pos = resp.indexOf('[');
    if (pos < 0) return;
    pos++;

    for (int i = 0; i < count; i++) {
        int objStart = resp.indexOf('{', pos);
        if (objStart < 0) break;
        int objEnd = resp.indexOf('}', objStart);
        if (objEnd < 0) break;

        String obj   = resp.substring(objStart, objEnd + 1);
        String key   = _jsonGet(obj, "key");
        String value = _jsonGet(obj, "value");
        String cmdId = _jsonGet(obj, "id");

        if (key.length() > 0) {
            _dbgf("[CMD] %s = %s", key.c_str(), value.c_str());
            if (_commandCb) _commandCb(key, value);
            // ACK back to server
            _ackHTTP(key, value, cmdId);
        }
        pos = objEnd + 1;
    }
}

// ───────────────────────────────────────────────────────────────
//  _sendHTTP()  — generic HTTP/HTTPS request helper
//
//  method   : "GET" | "POST"
//  path     : e.g. "/api/v1/devices/DEV-XX/ingest"
//  body     : JSON string (empty for GET)
//  respBody : populated with response body on success
//  Returns  : true on 2xx response
// ───────────────────────────────────────────────────────────────
bool EnthutechIoT::_sendHTTP(const char* method, const String& path,
                               const String& body, String& respBody) {
    respBody = "";

    // Decide which client type to use
#if defined(ESP32) || defined(ESP8266)
    WiFiClientSecure secureClient;
    WiFiClient       plainClient;
    if (_secure) {
        secureClient.setInsecure();  // skip cert verify (OK for IoT dev builds)
    }
    // Use the right client without reference binding issues
    bool ok = _secure ? secureClient.connect(_host, _port)
                      : plainClient.connect(_host, _port);
    if (!ok) {
        _dbgf("[HTTP] \xE2\x9C\x97 Can't connect to %s:%d", _host, _port);
        return false;
    }
    // Lambda to abstract send/read over whichever client
    #define _CLI_PRINT(x)    do { if (_secure) secureClient.print(x); else plainClient.print(x); } while(0)
    #define _CLI_AVAIL()     (_secure ? secureClient.available() : plainClient.available())
    #define _CLI_READ()      (_secure ? (char)secureClient.read() : (char)plainClient.read())
    #define _CLI_CONNECTED() (_secure ? secureClient.connected() : plainClient.connected())
    #define _CLI_STOP()      do { if (_secure) secureClient.stop(); else plainClient.stop(); } while(0)
#else
    WiFiClient plainClient;
    if (!plainClient.connect(_host, _port)) {
        _dbgf("[HTTP] \xE2\x9C\x97 Can't connect to %s:%d", _host, _port);
        return false;
    }
    #define _CLI_PRINT(x)    plainClient.print(x)
    #define _CLI_AVAIL()     plainClient.available()
    #define _CLI_READ()      (char)plainClient.read()
    #define _CLI_CONNECTED() plainClient.connected()
    #define _CLI_STOP()      plainClient.stop()
#endif

    // Build HTTP/1.1 request
    String req = String(method) + " " + path + " HTTP/1.1\r\n";
    req += "Host: "; req += _host; req += "\r\n";
    req += "x-api-key: "; req += _apiKey; req += "\r\n";
    req += "Connection: close\r\n";
    if (body.length() > 0) {
        req += "Content-Type: application/json\r\n";
        req += "Content-Length: "; req += body.length(); req += "\r\n";
    }
    req += "\r\n";
    if (body.length() > 0) req += body;

    _CLI_PRINT(req);

    // Read response with timeout
    unsigned long start = millis();
    bool headersDone = false;
    String line = "";
    int statusCode = 0;

    while (_CLI_CONNECTED() || _CLI_AVAIL()) {
        if (millis() - start > ET_HTTP_TIMEOUT) { _dbg("[HTTP] \xE2\x9C\x97 Timeout"); break; }

        while (_CLI_AVAIL()) {
            char c = _CLI_READ();
            if (!headersDone) {
                if (c == '\n') {
                    if (statusCode == 0 && line.startsWith("HTTP/")) {
                        int sp1 = line.indexOf(' ');
                        int sp2 = line.indexOf(' ', sp1 + 1);
                        if (sp1 > 0) statusCode = line.substring(sp1 + 1, sp2).toInt();
                    }
                    if (line.length() <= 1) headersDone = true;
                    line = "";
                } else if (c != '\r') {
                    line += c;
                }
            } else {
                respBody += c;
            }
        }
        delay(1);
    }
    _CLI_STOP();

    // Undefine local macros
    #undef _CLI_PRINT
    #undef _CLI_AVAIL
    #undef _CLI_READ
    #undef _CLI_CONNECTED
    #undef _CLI_STOP

    return (statusCode >= 200 && statusCode < 300);
}

String EnthutechIoT::_httpIngest(const String& jsonBody) {
    String path = "/api/v1/devices/";
    path += _deviceId;
    path += "/ingest";
    String resp;
    _sendHTTP("POST", path, jsonBody, resp);
    return resp;
}

String EnthutechIoT::_httpPollCmds() {
    String path = "/api/v1/devices/";
    path += _deviceId;
    path += "/commands";
    String resp;
    _sendHTTP("GET", path, "", resp);
    return resp;
}

void EnthutechIoT::_ackHTTP(const String& key, const String& value, const String& cmdId) {
    if (cmdId.length() == 0) return;
    String path = "/api/v1/devices/";
    path += _deviceId;
    path += "/commands/";
    path += cmdId;
    path += "/ack";
    String body = "{\"key\":\"" + key + "\",\"value\":\"" + value + "\"}";
    String resp;
    _sendHTTP("POST", path, body, resp);
}

// ─────────────────────────────────────────────────────────────
//  Command callback
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::onCommand(ETCommandCallback callback) {
    _commandCb = callback;
}

// ─────────────────────────────────────────────────────────────
//  Status
// ─────────────────────────────────────────────────────────────
bool   EnthutechIoT::isWiFiConnected()   { return WiFi.status() == WL_CONNECTED; }
bool   EnthutechIoT::isServerConnected() { return _wsConnected && _client.connected(); }
String EnthutechIoT::getDeviceId()       { return String(_deviceId); }
String EnthutechIoT::getVersion()        { return ENTHUTECH_IOT_VERSION; }
int    EnthutechIoT::getRSSI()           { return WiFi.RSSI(); }

void EnthutechIoT::setDebug(bool enable) { _debug = enable; }
void EnthutechIoT::setStatusLED(int pin) {
    _ledPin = pin;
    if (pin >= 0) pinMode(pin, OUTPUT);
}

// ═════════════════════════════════════════════════════════════
//  PRIVATE INTERNALS
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  WiFi connection
// ─────────────────────────────────────────────────────────────
bool EnthutechIoT::_connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return true;

    _dbgf("[WiFi] Connecting to %s ...", _ssid);
    WiFi.mode(WIFI_STA);
    WiFi.begin(_ssid, _password);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > ET_WIFI_TIMEOUT) {
            _dbg("[WiFi] ✗ Timed out");
            return false;
        }
        delay(300);
        Serial.print(".");
    }

    Serial.println();
    _dbgf("[WiFi] ✓ Connected! IP: %s  RSSI: %d dBm",
          WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
}

// ─────────────────────────────────────────────────────────────
//  WebSocket connect + handshake
// ─────────────────────────────────────────────────────────────
bool EnthutechIoT::_connectWebSocket() {
    if (_wsConnected && _client.connected()) return true;

    _wsConnected     = false;
    _wsHandshakeDone = false;
    _client.stop();

    _dbgf("[WS] Connecting to %s:%d ...", _host, _port);

    if (!_client.connect(_host, _port)) {
        _dbg("[WS] ✗ TCP connect failed");
        return false;
    }

    if (!_doHandshake()) {
        _client.stop();
        return false;
    }

    _wsConnected = true;
    _dbg("[WS] ✓ Connected!");

    // ── Identify as ESP32 device ──────────────────────────────
    String hello = "{\"type\":\"hello\",\"deviceId\":\"";
    hello += _deviceId;
    hello += "\",\"apiKey\":\"";
    hello += _apiKey;
    hello += "\"}";
    _wsSendText(hello);
    _dbg("[WS] → hello sent");

    _lastPingSent = millis();
    return true;
}

// ─────────────────────────────────────────────────────────────
//  WebSocket HTTP handshake (RFC 6455 §4)
// ─────────────────────────────────────────────────────────────
bool EnthutechIoT::_doHandshake() {
    // We use a fixed base64 key; we trust our own server so
    // we don't verify the accept header.
    String req = "GET / HTTP/1.1\r\n";
    req += "Host: ";           req += _host; req += ":"; req += _port; req += "\r\n";
    req += "Upgrade: websocket\r\n";
    req += "Connection: Upgrade\r\n";
    req += "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n";
    req += "Sec-WebSocket-Version: 13\r\n";
    req += "X-Device-Id: "; req += _deviceId; req += "\r\n";
    req += "\r\n";

    _client.print(req);

    // Read server response until blank line
    String response = "";
    unsigned long start = millis();
    while (millis() - start < 5000) {
        while (_client.available()) {
            char c = (char)_client.read();
            response += c;
            if (response.endsWith("\r\n\r\n")) {
                // Check for 101 Switching Protocols
                if (response.indexOf("101") != -1) {
                    _dbg("[WS] ✓ Handshake OK");
                    return true;
                } else {
                    _dbg("[WS] ✗ Handshake rejected");
                    _dbg(response.substring(0, 100));
                    return false;
                }
            }
        }
        delay(1);
    }
    _dbg("[WS] ✗ Handshake timeout");
    return false;
}

void EnthutechIoT::_disconnect() {
    _wsConnected = false;
    _client.stop();
}

// ─────────────────────────────────────────────────────────────
//  Send WebSocket text frame (client→server, MASKED)
//
//  Frame format:
//   [0x81]  FIN=1, Opcode=1 (text)
//   [0x80 | len]  MASK bit + payload length
//   [m0][m1][m2][m3]  masking key (random)
//   [payload XOR masking key]
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_wsSendText(const String& data) {
    if (!_wsConnected || !_client.connected()) return;

    size_t len = data.length();

    // Random 4-byte masking key
    uint8_t mask[4];
    for (int i = 0; i < 4; i++) mask[i] = (uint8_t)random(256);

    // Header byte 0: FIN + text opcode
    _client.write((uint8_t)0x81);

    // Header byte 1 (+2): length with MASK bit
    if (len < 126) {
        _client.write((uint8_t)(0x80 | len));
    } else if (len < 65536) {
        _client.write((uint8_t)0xFE);                       // 126
        _client.write((uint8_t)((len >> 8) & 0xFF));
        _client.write((uint8_t)(len & 0xFF));
    } else {
        // > 64KB: not expected in IoT; reject silently
        return;
    }

    // Masking key
    _client.write(mask, 4);

    // Masked payload (sent in one buffer for efficiency)
    static uint8_t txBuf[512];
    if (len <= sizeof(txBuf)) {
        for (size_t i = 0; i < len; i++) txBuf[i] = (uint8_t)(data[i]) ^ mask[i % 4];
        _client.write(txBuf, len);
    } else {
        for (size_t i = 0; i < len; i++) {
            _client.write((uint8_t)((data[i]) ^ mask[i % 4]));
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Send WebSocket ping frame (opcode 0x09)
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_wsSendPing() {
    if (!_wsConnected || !_client.connected()) return;
    _client.write((uint8_t)0x89);  // FIN + Ping opcode
    _client.write((uint8_t)0x80);  // MASK + 0 length
    uint8_t mask[4] = {0x11, 0x22, 0x33, 0x44};
    _client.write(mask, 4);
}

// ─────────────────────────────────────────────────────────────
//  Poll and dispatch incoming frames
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_wsPollFrames() {
    String payload;
    uint8_t opcode;

    while (_client.available()) {
        if (!_wsReadFrame(payload, opcode)) {
            _dbg("[WS] Frame read error — disconnecting");
            _wsConnected = false;
            _client.stop();
            return;
        }

        switch (opcode) {
            case 0x01:  // Text frame → parse JSON
                _dbgf("[RECV] %s", payload.c_str());
                _handleIncoming(payload);
                break;

            case 0x09:  // Ping → respond with Pong
                _client.write((uint8_t)0x8A);  // FIN + Pong
                _client.write((uint8_t)0x80);  // MASK + 0 length
                { uint8_t m[4]={0};  _client.write(m,4); }
                break;

            case 0x0A:  // Pong → ignore
                break;

            case 0x08:  // Close
                _dbg("[WS] Server sent close frame");
                _wsConnected = false;
                _client.stop();
                return;

            default:
                break;
        }
    }
}

// ─────────────────────────────────────────────────────────────
//  Read one WebSocket frame from the stream
//
//  Server→Client frames are UNMASKED.
//  Returns false on error.
// ─────────────────────────────────────────────────────────────
bool EnthutechIoT::_wsReadFrame(String& outPayload, uint8_t& outOpcode) {
    outPayload = "";

    uint8_t b0 = _readByte();
    if (b0 == 0xFF) return false;   // timeout / error

    uint8_t b1 = _readByte();
    if (b1 == 0xFF) return false;

    outOpcode       = b0 & 0x0F;
    bool   masked   = (b1 & 0x80) != 0;
    size_t payLen   = b1 & 0x7F;

    if (payLen == 126) {
        uint8_t hi = _readByte(), lo = _readByte();
        if (hi == 0xFF || lo == 0xFF) return false;
        payLen = ((uint16_t)hi << 8) | lo;
    } else if (payLen == 127) {
        // 8-byte length — extremely rare for IoT; skip 8 bytes
        for (int i = 0; i < 8; i++) _readByte();
        return false;
    }

    uint8_t mask[4] = {0};
    if (masked) {
        for (int i = 0; i < 4; i++) {
            mask[i] = _readByte();
            if (mask[i] == 0xFF && !mask[0]) return false;
        }
    }

    outPayload.reserve(payLen);
    for (size_t i = 0; i < payLen; i++) {
        uint8_t b = _readByte();
        if (b == 0xFF && payLen > 0 && i == 0 && outPayload.length() == 0) return false;
        outPayload += (char)(masked ? (b ^ mask[i % 4]) : b);
    }

    return true;
}

// ─────────────────────────────────────────────────────────────
//  Read a single byte with timeout
// ─────────────────────────────────────────────────────────────
uint8_t EnthutechIoT::_readByte(uint32_t timeoutMs) {
    uint32_t start = millis();
    while (!_client.available()) {
        if (millis() - start > timeoutMs) return 0xFF; // sentinel = error
        delay(1);
    }
    return (uint8_t)_client.read();
}

// ─────────────────────────────────────────────────────────────
//  Handle incoming WebSocket message from server
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_handleIncoming(const String& msg) {
    String type = _jsonGet(msg, "type");

    if (type == "hello_ack") {
        _dbg("[WS] ✓ Server acknowledged — bidirectional ready!");
        return;
    }

    if (type == "command") {
        String key   = _jsonGet(msg, "key");
        String value = _jsonGet(msg, "value");

        if (key.length() == 0) return;

        _dbgf("[CMD] %s = %s", key.c_str(), value.c_str());

        // Fire user callback
        if (_commandCb) {
            _commandCb(key, value);
        }

        // Auto-send ACK back to server/dashboard
        _sendCommandAck(key, value);
        return;
    }

    if (type == "snapshot") {
        _dbg("[WS] Snapshot received from server");
        return;
    }
}

// ─────────────────────────────────────────────────────────────
//  Send command acknowledgement to server
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_sendCommandAck(const String& key, const String& value) {
    String ack = "{\"type\":\"command_ack\",\"key\":\"";
    ack += key;
    ack += "\",\"value\":";
    // value is already the raw JSON value (true/false or quoted string)
    bool isQuoted = (value.length() == 0 ||
                     (value[0] != 't' && value[0] != 'f' &&
                      (value[0] < '0' || value[0] > '9') &&
                      value[0] != '-'));
    if (isQuoted) ack += "\"";
    ack += value;
    if (isQuoted) ack += "\"";
    ack += "}";
    _wsSendText(ack);
}

// ─────────────────────────────────────────────────────────────
//  Build the data envelope JSON
//
//  Result: {"type":"data","data":{...fields...}}
// ─────────────────────────────────────────────────────────────
String EnthutechIoT::_buildDataFrame(const String& jsonFields) {
    String frame = "{\"type\":\"data\",\"data\":{";
    frame += jsonFields;
    frame += "}}";
    return frame;
}

// ─────────────────────────────────────────────────────────────
//  Minimal JSON value extractor
//  Handles string, number, boolean values.
//  Does NOT handle nested objects or arrays.
// ─────────────────────────────────────────────────────────────
String EnthutechIoT::_jsonGet(const String& json, const String& key) {
    String needle = "\"" + key + "\":";
    int idx = json.indexOf(needle);
    if (idx < 0) return "";

    idx += needle.length();
    // Skip spaces
    while (idx < (int)json.length() && json[idx] == ' ') idx++;

    if (idx >= (int)json.length()) return "";

    char first = json[idx];

    if (first == '"') {
        // String value
        idx++;
        int end = json.indexOf('"', idx);
        if (end < 0) return "";
        return json.substring(idx, end);
    } else {
        // Bool / number
        int end = idx;
        while (end < (int)json.length() &&
               json[end] != ',' && json[end] != '}' && json[end] != ' ')
            end++;
        return json.substring(idx, end);
    }
}

// ─────────────────────────────────────────────────────────────
//  Float → String with fixed decimal places
// ─────────────────────────────────────────────────────────────
String EnthutechIoT::_floatToStr(float v, int dec) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%.*f", dec, v);
    return String(buf);
}

// ─────────────────────────────────────────────────────────────
//  Debug output
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_dbg(const String& msg) {
    if (_debug) Serial.println("[ET] " + msg);
}

void EnthutechIoT::_dbgf(const char* fmt, ...) {
    if (!_debug) return;
    char buf[256];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    Serial.print("[ET] ");
    Serial.println(buf);
}

// ─────────────────────────────────────────────────────────────
//  Optional status LED blink
// ─────────────────────────────────────────────────────────────
void EnthutechIoT::_blinkLED() {
    if (_ledPin < 0) return;
    digitalWrite(_ledPin, HIGH);
    delay(30);
    digitalWrite(_ledPin, LOW);
}

