import { useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { SERVER_HOST, SERVER_PORT, SERVER_HTTP, SERVER_WS } from '../../context/AppContext.jsx'
import styles from './AddDeviceWizard.module.css'

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const STEPS = [
    { id: 'info', num: 1, label: 'Device Info', icon: '📋' },
    { id: 'protocol', num: 2, label: 'Protocol', icon: '📡' },
    { id: 'variables', num: 3, label: 'Variables', icon: '⚙️' },
    { id: 'direction', num: 4, label: 'Data Flow', icon: '↕️' },
    { id: 'credentials', num: 5, label: 'Credentials', icon: '🔑' },
    { id: 'code', num: 6, label: 'Boilerplate', icon: '</>' },
]

const DEVICE_TYPES = [
    { id: 'esp32', label: 'ESP32', icon: '🟦', board: 'esp32:esp32:esp32' },
    { id: 'esp8266', label: 'ESP8266 / NodeMCU', icon: '🟨', board: 'esp8266:esp8266:nodemcuv2' },
    { id: 'arduino_wifi', label: 'Arduino + WiFi', icon: '🔵', board: 'arduino:avr:uno' },
    { id: 'raspberry_pi', label: 'Raspberry Pi', icon: '🍓', board: null },
]

// ── Wireless transport ───────────────────────────────────────
const WIRELESS = [
    { id: 'wifi', label: 'WiFi', icon: '📶', desc: 'Connect over your local WiFi network', badge: 'RECOMMENDED', disabled: false },
    { id: 'lora', label: 'LoRa', icon: '📻', desc: 'Long-range, low-power radio (LPWAN)', badge: 'COMING SOON', disabled: true },
    { id: 'bluetooth', label: 'Bluetooth', icon: '🔵', desc: 'Short-range wireless via BLE classic', badge: 'COMING SOON', disabled: true },
]

// ── WiFi sub-protocols ───────────────────────────────────────
const WIFI_PROTOS = [
    { id: 'http', label: 'HTTP', icon: '🌐', desc: 'One-way upload every few seconds. Simple sensor devices.', badge: 'SIMPLE', badgeClass: 'badgeBlue', disabled: false },
    { id: 'https', label: 'HTTPS', icon: '🔒', desc: 'Encrypted HTTP. For secure / cloud deployments.', badge: 'SECURE', badgeClass: 'badgePurple', disabled: false },
    { id: 'ws', label: 'WebSocket', icon: '⚡', desc: 'Bidirectional, real-time. Best for control + monitoring.', badge: 'COMING SOON', badgeClass: 'badgeGray', disabled: true },
]

const VAR_TYPES = ['float', 'int', 'bool', 'String']
const VAR_DIRS = [
    { id: 'uplink', label: '⬆ Uplink', desc: 'ESP32 → Dashboard  (sensor reading)' },
    { id: 'downlink', label: '⬇ Downlink', desc: 'Dashboard → ESP32  (control command)' },
]

// ─────────────────────────────────────────────────────────────
//  BOILERPLATE CODE GENERATOR
// ─────────────────────────────────────────────────────────────
function generateCode(device) {
    const { name = 'MyDevice', type = 'esp32', wireless = 'wifi', protocol = 'http', variables = [], id: deviceId = '---', apiKey = '---', wifiSsid = '', wifiPass = '', ota = false } = device
    const uplinks = variables.filter(v => v.dir === 'uplink')
    const downlinks = variables.filter(v => v.dir === 'downlink')
    const ip = SERVER_HOST
    const port = SERVER_PORT
    const nl = '\n'

    const ssidValue = wifiSsid.trim() || 'YourWiFiName'
    const passValue = wifiPass.trim() || 'YourWiFiPassword'

    // ── File header ───────────────────────────────────────────────
    const makeHeader = (protoLabel, libs) => [
        `/*`,
        ` * ════════════════════════════════════════════════`,
        ` *  Device   : ${name}`,
        ` *  Board    : ${DEVICE_TYPES.find(t => t.id === type)?.label || type}`,
        ` *  Protocol : ${protoLabel}`,
        ` *  Generated: EnthutechIoT Dashboard`,
        ` * ════════════════════════════════════════════════`,
        ` *`,
        ` *  Required Libraries (install via Arduino Library Manager):`,
        ...libs.map(l => ` *    ➜ ${l}`),
        ` *`,
        ` *  UPLINK  (ESP32 → Dashboard):`,
        ...(uplinks.length ? uplinks.map(v => ` *    ${v.name} [${v.type}]${v.unit ? ' (' + v.unit + ')' : ''}`) : [' *    (none)']),
        ` *  DOWNLINK (Dashboard → ESP32):`,
        ...(downlinks.length ? downlinks.map(v => ` *    ${v.name} [${v.type}]`) : [' *    (none)']),
        ` */`,
    ]

    // ── Shared credentials block ──────────────────────────────────
    const credsBlock = [
        `// ── WiFi credentials ─────────────────────────────`,
        `const char* WIFI_SSID  = "${ssidValue}";`,
        `const char* WIFI_PASS  = "${passValue}";`,
        ``,
        `// ── Server ───────────────────────────────────────`,
        `const char* SERVER_IP  = "${ip}";`,
        `const int   SERVER_PORT = ${port};`,
        ``,
        `// ── Device credentials (auto-generated) ─────────`,
        `const char* DEVICE_ID  = "${deviceId}";`,
        `const char* API_KEY    = "${apiKey}";`,
    ]

    // ── Pin defines for bool downlinks ────────────────────────────
    const pinLines = downlinks
        .filter(v => v.type === 'bool')
        .map(v => `#define ${v.name.toUpperCase()}_PIN  2   // ← change to your GPIO pin`)

    // ── handleCommand() body ──────────────────────────────────────
    const cmdBody = downlinks.length === 0 && !ota
        ? ['    // No DOWNLINK variables defined']
        : [
            ...(ota ? [
                `    if (key == "__update_ota__") {`,
                `        Serial.println("[OTA] Starting firmware update from: " + value);`,
                `        // OTA update is handled in loop/global to avoid breaking the current HTTP Request`,
                `        otaUrl = value;`,
                `        return;`,
                `    }`
            ] : []),
            ...downlinks.flatMap(v => {
                if (v.type === 'bool') return [
                    `    if (key == "${v.name}") {`,
                    `        bool state = (value == "true" || value == "1");`,
                    `        Serial.printf("[CMD] ${v.name} -> %s\\n", state ? "ON" : "OFF");`,
                    `        // digitalWrite(${v.name.toUpperCase()}_PIN, state ? HIGH : LOW);`,
                    `    }`,
                ]
                if (v.type === 'String') return [
                    `    if (key == "${v.name}") {`,
                    `        Serial.println("[CMD] ${v.name} -> " + value);`,
                    `        // TODO: use value`,
                    `    }`,
                ]
                // Number
                return [
                    `    if (key == "${v.name}") {`,
                    `        float val = value.toFloat();`,
                    `        Serial.printf("[CMD] ${v.name} -> %.2f\\n", val);`,
                    `        // TODO: use val`,
                    `    }`,
                ]
            })
        ]

    // ── JSON uplink fields ────────────────────────────────────────
    const uplinkFields = uplinks.length === 0
        ? ['    // No UPLINK variables — add your sensor reads here',
            '    // data["temperature"] = 25.4;']
        : uplinks.flatMap(v => {
            const sample = v.type === 'bool' ? 'false' : v.type === 'String' ? '"hello"' : '0.0'
            const unit = v.unit ? `  // ${v.unit}` : ''
            return [
                `    ${v.type} ${v.name} = ${sample};${unit}  // TODO: real read`,
                `    data["${v.name}"] = ${v.name};`,
            ]
        })

    // ════════════════════════════════════════════════════════════
    //  WebSocket sketch — uses WebSocketsClient + ArduinoJson
    // ════════════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════════════
    //  WebSocket sketch — uses Raw TCP (WiFiClient) + ArduinoJson
    // ════════════════════════════════════════════════════════════
    if (wireless === 'wifi' && protocol === 'ws') return [
        ...makeHeader('WiFi + WebSocket (Raw)', [
            'ArduinoJson by Benoit Blanchon (search: "ArduinoJson")',
        ]),
        ``,
        `#include <WiFi.h>`,
        `#include <ArduinoJson.h>`,
        ``,
        ...credsBlock,
        ...(pinLines.length ? ['', ...pinLines] : []),
        ``,
        `WiFiClient client;`,
        ``,
        `// ── Handle incoming DOWNLINK commands from Dashboard ──────`,
        `void handleCommand(String key, String value) {`,
        ...cmdBody,
        `}`,
        ``,
        `// ── WebSocket event handler ───────────────────────────────`,
        ``,
        `// ── Core WebSocket Send Frame ─────────────────────`,
        `void wsSend(String json) {`,
        `    if (!client.connected()) return;`,
        `    client.write(129);  // WebSocket format: OP_CODE for TXT`,
        `    client.write(json.length());`,
        `    client.print(json);`,
        `}`,
        ``,
        `void setup() {`,
        `    Serial.begin(115200);`,
        ...(pinLines.length ? [...downlinks.filter(v => v.type === 'bool').map(v => `    pinMode(${v.name.toUpperCase()}_PIN, OUTPUT);`)] : []),
        `    WiFi.begin(WIFI_SSID, WIFI_PASS);`,
        `    while (WiFi.status() != WL_CONNECTED) delay(500);`,
        `}`,
        ``,
        `unsigned long _last = 0;`,
        `void loop() {`,
        `    if (!client.connected()) {`,
        `        // ── RAW TCP Handshake ──`,
        `        if (client.connect(SERVER_IP, SERVER_PORT)) {`,
        `            client.println("GET / HTTP/1.1");`,
        `            client.println("Upgrade: websocket");`,
        `            client.println("Connection: Upgrade");`,
        `            client.println("Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==");`,
        `            client.println("Sec-WebSocket-Version: 13");`,
        `            client.println();`,
        `            delay(100);`,
        `            wsSend("{\\"type\\":\\"hello\\",\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\"}");`,
        `        }`,
        `    } else if (millis() - _last >= 5000) {`,
        `        _last = millis();`,
        `        JsonDocument doc; doc["type"] = "data";`,
        `        JsonObject data = doc["data"].to<JsonObject>();`,
        ...uplinkFields.map(l => `    ${l}`),
        `        String out; serializeJson(doc, out);`,
        `        wsSend(out);`,
        `    }`,
        `}`,
    ].join(nl)

    // ════════════════════════════════════════════════════════════
    //  HTTP sketch — uses HTTPClient + ArduinoJson
    // ════════════════════════════════════════════════════════════
    if (wireless === 'wifi' && protocol === 'http') return [
        ...makeHeader('WiFi + HTTP (Uplink + Downlink)', [
            'ArduinoJson by Benoit Blanchon (search: "ArduinoJson")',
            '(HTTPClient and WiFi are built into ESP32 Arduino core)',
        ]),
        ``,
        `#include <WiFi.h>`,
        `#include <HTTPClient.h>`,
        ...(ota ? [`#include <HTTPUpdate.h>`] : []),
        `#include <ArduinoJson.h>`,
        ``,
        ...credsBlock,
        ...(pinLines.length ? ['', ...pinLines] : []),
        ``,
        `String serverBase = String("http://") + SERVER_IP + ":" + SERVER_PORT;`,
        ...(ota ? [`String otaUrl = "";`] : []),
        ``,
        `void handleCommand(String key, String value) {`,
        ...cmdBody,
        `}`,
        ``,
        `void setup() {`,
        `    Serial.begin(115200);`,
        ...(pinLines.length ? [...downlinks.filter(v => v.type === 'bool').map(v => `    pinMode(${v.name.toUpperCase()}_PIN, OUTPUT);`)] : []),
        `    WiFi.begin(WIFI_SSID, WIFI_PASS);`,
        `    while (WiFi.status() != WL_CONNECTED) delay(500);`,
        `    Serial.println("\\n[WiFi] Connected!");`,
        `}`,
        ``,
        `void loop() {`,
        `    if (WiFi.status() == WL_CONNECTED) {`,
        `        WiFiClient client;`,
        `        HTTPClient http;`,
        `        http.begin(client, serverBase + "/api/v1/devices/" + DEVICE_ID + "/ingest");`,
        `        http.addHeader("Content-Type", "application/json");`,
        `        http.addHeader("x-api-key", API_KEY);`,
        ``,
        `        JsonDocument doc;`,
        `        JsonObject data = doc.to<JsonObject>();`,
        ...uplinkFields.map(l => `    ${l}`),
        ``,
        `        String body;`,
        `        serializeJson(doc, body);`,
        `        int code = http.POST(body);`,
        `        Serial.printf("[UPLINK] HTTP %d\\n", code);`,
        `        http.end();`,
        ``,
        `        // ── Poll for Commands ──`,
        `        http.begin(client, serverBase + "/api/v1/devices/" + DEVICE_ID + "/commands");`,
        `        http.addHeader("x-api-key", API_KEY);`,
        `        if (http.GET() == 200) {`,
        `            if (!deserializeJson(doc, http.getString())) {`,
        `                for (JsonObject cmd : doc["commands"].as<JsonArray>()) {`,
        `                    String key = cmd["key"]; String val = cmd["value"]; String id = cmd["id"];`,
        `                    handleCommand(key, val);`,
        `                    // ACK Command`,
        `                    HTTPClient ack; ack.begin(client, serverBase + "/api/v1/devices/" + DEVICE_ID + "/commands/" + id + "/ack");`,
        `                    ack.addHeader("Content-Type", "application/json"); ack.POST("{}"); ack.end();`,
        `                }`,
        `            }`,
        `        }`,
        `        http.end();`,
        ...(ota ? [
        ``,
        `        // ── Handle Pending OTA Updates ──`,
        `        if (otaUrl != "") {`,
        `            Serial.println("[OTA] Processing update...");`,
        `            t_httpUpdate_return ret = httpUpdate.update(client, otaUrl);`,
        `            if(ret == HTTP_UPDATE_FAILED) Serial.printf("[OTA] Error (%d): %s\\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());`,
        `            otaUrl = "";`,
        `        }`
        ] : []),
        `    }`,
        `    delay(5000);  // Loop every 5 seconds`,
        `}`,
    ].join(nl)

    // ════════════════════════════════════════════════════════════
    //  HTTPS sketch — same as HTTP with setInsecure()
    // ════════════════════════════════════════════════════════════
    if (wireless === 'wifi' && protocol === 'https') return [
        ...makeHeader('WiFi + HTTPS (Uplink + Downlink)', [
            'ArduinoJson by Benoit Blanchon (search: "ArduinoJson")',
            '(HTTPClient, WiFiClientSecure built into ESP32 Arduino core)',
        ]),
        ``,
        `#include <WiFi.h>`,
        `#include <WiFiClientSecure.h>`,
        `#include <HTTPClient.h>`,
        ...(ota ? [`#include <HTTPUpdate.h>`] : []),
        `#include <ArduinoJson.h>`,
        ``,
        ...credsBlock,
        ...(pinLines.length ? ['', ...pinLines] : []),
        `const char* SERVER_HOST = "${ip}";   // for HTTPS use your domain or IP`,
        ``,
        `WiFiClientSecure sslClient;`,
        `String serverBase = String("https://") + SERVER_HOST;`,
        ...(ota ? [`String otaUrl = "";`] : []),
        ``,
        `void handleCommand(String key, String value) {`,
        ...cmdBody,
        `}`,
        ``,
        `void setup() {`,
        `    Serial.begin(115200);`,
        ...(pinLines.length ? [...downlinks.filter(v => v.type === 'bool').map(v => `    pinMode(${v.name.toUpperCase()}_PIN, OUTPUT);`)] : []),
        `    sslClient.setInsecure();   // skip cert check — OK for dev`,
        `    WiFi.begin(WIFI_SSID, WIFI_PASS);`,
        `    while (WiFi.status() != WL_CONNECTED) delay(500);`,
        `    Serial.println("\\n[WiFi] Connected to Network!");`,
        `}`,
        ``,
        `void loop() {`,
        `    if (WiFi.status() == WL_CONNECTED) {`,
        `        HTTPClient http;`,
        `        http.begin(sslClient, serverBase + "/api/v1/devices/" + DEVICE_ID + "/ingest");`,
        `        http.addHeader("Content-Type", "application/json");`,
        `        http.addHeader("x-api-key", API_KEY);`,
        ``,
        `        JsonDocument doc;`,
        `        JsonObject data = doc.to<JsonObject>();`,
        ...uplinkFields.map(l => `    ${l}`),
        ``,
        `        String body;`,
        `        serializeJson(doc, body);`,
        `        int code = http.POST(body);`,
        `        Serial.printf("[UPLINK] HTTPS %d\\n", code);`,
        `        http.end();`,
        ``,
        `        // ── Poll for Commands ──`,
        `        http.begin(sslClient, serverBase + "/api/v1/devices/" + DEVICE_ID + "/commands");`,
        `        http.addHeader("x-api-key", API_KEY);`,
        `        if (http.GET() == 200) {`,
        `            if (!deserializeJson(doc, http.getString())) {`,
        `                for (JsonObject cmd : doc["commands"].as<JsonArray>()) {`,
        `                    String key = cmd["key"]; String val = cmd["value"]; String id = cmd["id"];`,
        `                    handleCommand(key, val);`,
        `                    HTTPClient ack; ack.begin(sslClient, serverBase + "/api/v1/devices/" + DEVICE_ID + "/commands/" + id + "/ack");`,
        `                    ack.addHeader("Content-Type", "application/json"); ack.POST("{}"); ack.end();`,
        `                }`,
        `            }`,
        `        }`,
        `        http.end();`,
        ...(ota ? [
        ``,
        `        // ── Handle Pending OTA Updates ──`,
        `        if (otaUrl != "") {`,
        `            Serial.println("[OTA] Processing update...");`,
        `            t_httpUpdate_return ret = httpUpdate.update(sslClient, otaUrl);`,
        `            if(ret == HTTP_UPDATE_FAILED) Serial.printf("[OTA] Error (%d): %s\\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());`,
        `            otaUrl = "";`,
        `        }`
        ] : []),
        `    }`,
        `    delay(5000);  // Loop every 5 seconds`,
        `}`,
    ].join(nl)

    return `// Protocol "${wireless}/${protocol}" not yet supported by the code generator.`
}

// ─────────────────────────────────────────────────────────────
//  STEP 1 — DEVICE INFO
// ─────────────────────────────────────────────────────────────
function StepInfo({ data, setData }) {
    return (
        <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>Step 1</div>
                <h3>Device Information</h3>
                <p>Give your device a name and tell us what board you're using.</p>
            </div>
            <div className={styles.formCol}>
                <div className={styles.field}>
                    <label>Device Name *</label>
                    <input value={data.name} onChange={e => setData({ name: e.target.value })}
                        placeholder="e.g. Weather Station, Smart Lamp, Door Sensor" />
                </div>
                <div className={styles.field}>
                    <label>Description (optional)</label>
                    <input value={data.description} onChange={e => setData({ description: e.target.value })}
                        placeholder="What does this device do?" />
                </div>
                <div className={styles.field}>
                    <label>Location (optional)</label>
                    <input value={data.location} onChange={e => setData({ location: e.target.value })}
                        placeholder="Living Room / Rooftop / Lab Bench" />
                </div>
                <div className={styles.field}>
                    <label>Board Type *</label>
                    <div className={styles.typeGrid}>
                        {DEVICE_TYPES.map(t => (
                            <button key={t.id}
                                className={`${styles.typeBtn} ${data.type === t.id ? styles.typeBtnOn : ''}`}
                                onClick={() => setData({ type: t.id })}>
                                <span className={styles.typeBtnIcon}>{t.icon}</span>
                                <span className={styles.typeBtnLabel}>{t.label}</span>
                                {data.type === t.id && <span className={styles.typeBtnCheck}>✓</span>}
                            </button>
                        ))}
                    </div>
                </div>
                {data.type && (
                    <div className={styles.boardHint}>
                        🔧 Arduino IDE Board: <code>{DEVICE_TYPES.find(t => t.id === data.type)?.board || 'See board manager'}</code>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  STEP 2 — PROTOCOL (two-level: wireless → sub-protocol)
// ─────────────────────────────────────────────────────────────
function StepProtocol({ data, setData }) {
    const wireless = data.wireless || 'wifi'
    const proto = data.protocol || ''

    const INFO = {
        ws: { title: '⚡ WebSocket', text: 'Keeps a persistent connection. Supports both sending sensor data AND receiving commands from the Dashboard in real-time.' },
        http: { title: '🌐 HTTP POST', text: 'Device makes a fresh HTTP request every few seconds to upload data. Simple to set up but cannot receive commands from the Dashboard.' },
        https: { title: '🔒 HTTPS POST', text: 'Same as HTTP POST but all data is encrypted with TLS/SSL. Ideal for cloud servers or public deployments.' },
    }

    return (
        <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>Step 2</div>
                <h3>Communication Protocol</h3>
                <p>First pick your wireless technology, then choose how data is sent.</p>
            </div>

            {/* ── Tier 1: Wireless transport ─────────────────── */}
            <div className={styles.protoSection}>
                <div className={styles.protoSectionLabel}>📡 Wireless Technology</div>
                <div className={styles.protocolList}>
                    {WIRELESS.map(w => (
                        <button key={w.id}
                            className={`${styles.protoCard} ${wireless === w.id ? styles.protoOn : ''} ${w.disabled ? styles.protoDisabled : ''}`}
                            onClick={() => !w.disabled && setData({ wireless: w.id, protocol: '' })}
                            disabled={w.disabled}>
                            <div className={styles.protoLeft}>
                                <span className={styles.protoIcon}>{w.icon}</span>
                                <div>
                                    <div className={styles.protoLabel}>{w.label}</div>
                                    <div className={styles.protoDesc}>{w.desc}</div>
                                </div>
                            </div>
                            <div className={styles.protoRight}>
                                <span className={`${styles.protoBadge} ${w.disabled ? styles.badgeGray : styles.badgeGreen}`}>
                                    {w.badge}
                                </span>
                                {!w.disabled && (
                                    <div className={`${styles.protoCheck} ${wireless === w.id ? styles.protoCheckOn : ''}`}>✓</div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tier 2: WiFi sub-protocol ──────────────────── */}
            {wireless === 'wifi' && (
                <div className={styles.protoSection} style={{ marginTop: 20 }}>
                    <div className={styles.protoSectionLabel}>🔗 Data Transfer Method</div>
                    <div className={styles.protocolList}>
                        {WIFI_PROTOS.map(p => (
                            <button key={p.id}
                                className={`${styles.protoCard} ${proto === p.id ? styles.protoOn : ''} ${p.disabled ? styles.protoDisabled : ''}`}
                                onClick={() => !p.disabled && setData({ protocol: p.id })}
                                disabled={p.disabled}>
                                <div className={styles.protoLeft}>
                                    <span className={styles.protoIcon}>{p.icon}</span>
                                    <div>
                                        <div className={styles.protoLabel}>{p.label}</div>
                                        <div className={styles.protoDesc}>{p.desc}</div>
                                    </div>
                                </div>
                                <div className={styles.protoRight}>
                                    <span className={`${styles.protoBadge} ${p.disabled ? styles.badgeGray : styles[p.badgeClass]}`}>{p.badge}</span>
                                    {!p.disabled && (
                                        <div className={`${styles.protoCheck} ${proto === p.id ? styles.protoCheckOn : ''}`}>✓</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    {proto && INFO[proto] && (
                        <div className={styles.infoBox} style={{ marginTop: 12 }}>
                            <b>{INFO[proto].title}</b>: {INFO[proto].text}
                        </div>
                    )}
                </div>
            )}

            {(wireless === 'lora' || wireless === 'bluetooth') && (
                <div className={styles.infoBox} style={{ marginTop: 16, borderColor: 'rgba(255,211,42,.2)', background: 'rgba(255,211,42,.04)', color: 'var(--accent-yellow)' }}>
                    ⚠️ <b>{wireless === 'lora' ? 'LoRa' : 'Bluetooth'}</b> support is coming soon. Select <b>WiFi</b> to continue right now.
                </div>
            )}

            {/* ── WiFi Credentials (shown when WiFi selected) ─────── */}
            {wireless === 'wifi' && (
                <div className={styles.protoSection} style={{ marginTop: 20 }}>
                    <div className={styles.protoSectionLabel}>🔐 WiFi Credentials <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>(injected into generated sketch)</span></div>
                    <div className={styles.formRow}>
                        <div className={styles.field} style={{ flex: 1 }}>
                            <label>WiFi Network Name (SSID)</label>
                            <input
                                value={data.wifiSsid || ''}
                                onChange={e => setData({ wifiSsid: e.target.value })}
                                placeholder="e.g. Airtel_Home_2.4G"
                                autoComplete="off"
                            />
                        </div>
                        <div className={styles.field} style={{ flex: 1 }}>
                            <label>WiFi Password</label>
                            <input
                                type="password"
                                value={data.wifiPass || ''}
                                onChange={e => setData({ wifiPass: e.target.value })}
                                placeholder="Your WiFi password"
                                autoComplete="new-password"
                            />
                        </div>
                    </div>
                    <div className={styles.infoBox} style={{ marginTop: 8, fontSize: 12 }}>
                        💡 These are saved only in your browser and written into the generated sketch. They are <b>never sent</b> to any server.
                    </div>

                    <div className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 }}>
                        <div className={styles.protoCheck} style={{ cursor: 'pointer', borderColor: data.ota ? 'var(--accent-purple)' : 'var(--surface-a09)', background: data.ota ? 'var(--accent-purple)' : 'transparent', color: data.ota ? '#fff' : 'transparent', transition: '.2s' }} onClick={() => setData({ ota: !data.ota })}>✓</div>
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setData({ ota: !data.ota })}>
                            <label style={{ fontSize: '.8rem', cursor: 'pointer', margin: 0, color: 'var(--text-primary)' }}>Enable Over-The-Air (OTA) Updates</label>
                            <p style={{ margin: '2px 0 0', fontSize: '.7rem', color: 'var(--text-secondary)' }}>Automatically generates `HTTPUpdate` code to allow internet firmware flashing</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  STEP 3 — VARIABLES
// ─────────────────────────────────────────────────────────────
function StepVariables({ data, setData }) {
    const vars = data.variables || []

    const addVar = (dir = 'uplink') =>
        setData({ variables: [...vars, { id: Date.now(), name: '', type: 'float', unit: '', dir }] })

    const remVar = id =>
        setData({ variables: vars.filter(v => v.id !== id) })

    const setVar = (id, k, v) =>
        setData({ variables: vars.map(x => x.id === id ? { ...x, [k]: v } : x) })

    const uplinks = vars.filter(v => v.dir === 'uplink')
    const downlinks = vars.filter(v => v.dir === 'downlink')

    const renderGroup = (list, dir) => {
        const color = dir === 'uplink' ? 'var(--accent-purple)' : 'var(--accent-green)'
        const label = dir === 'uplink' ? '⬆ Uplink Variables — ESP32 → Dashboard' : '⬇ Downlink Variables — Dashboard → ESP32'
        return (
            <div className={styles.varGroup} key={dir}>
                <div className={styles.varGroupHeader} style={{ borderColor: color + '44', color }}>
                    {label}
                    <button className={styles.addVarInlineBtn}
                        style={{ background: color + '18', color, border: `1px solid ${color}44` }}
                        onClick={() => addVar(dir)}>
                        ＋ Add {dir === 'uplink' ? 'Sensor' : 'Control'}
                    </button>
                </div>
                {list.length === 0 ? (
                    <div className={styles.varEmptyGroup}>
                        No {dir} variables yet.
                        <button className={styles.varEmptyAddBtn} onClick={() => addVar(dir)}>＋ Add one</button>
                    </div>
                ) : list.map(v => (
                    <div key={v.id} className={styles.varRow}>
                        <input value={v.name} onChange={e => setVar(v.id, 'name', e.target.value)}
                            placeholder="temperature / led / speed" className={styles.varInput} />
                        <select value={v.type} onChange={e => setVar(v.id, 'type', e.target.value)} className={styles.varSel}>
                            {VAR_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input value={v.unit} onChange={e => setVar(v.id, 'unit', e.target.value)}
                            placeholder="°C / % / V" className={styles.varUnitIn} />
                        <button className={styles.remVarBtn} onClick={() => remVar(v.id)}>✕</button>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>Step 3</div>
                <h3>Variables</h3>
                <p>Define sensors your ESP32 reads (<b>Uplink</b>) and things you want to control from the Dashboard (<b>Downlink</b>). Both will appear in the generated code.</p>
            </div>

            <div className={styles.varTableHead}>
                <span>Name</span><span>Type</span><span>Unit</span><span></span>
            </div>

            {renderGroup(uplinks, 'uplink')}
            {renderGroup(downlinks, 'downlink')}

            {vars.length === 0 && (
                <div className={styles.varEmpty}>
                    No variables yet.<br />Use the buttons above to add sensor readings or control outputs.
                </div>
            )}

            <div className={styles.varHints}>
                <div className={styles.varHintItem}>⬆ <b>Uplink</b>: ESP32 reads sensor → sends data to Dashboard (e.g. temperature, humidity, voltage)</div>
                <div className={styles.varHintItem}>⬇ <b>Downlink</b>: Dashboard sends command → ESP32 acts on it (e.g. led, relay, fan speed)</div>
                <div className={styles.varHintItem}>💡 Both uplink and downlink will appear as separate sections in your boilerplate code</div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  STEP 4 — DATA FLOW
// ─────────────────────────────────────────────────────────────
function StepDirection({ data }) {
    const vars = data.variables || []
    const up = vars.filter(v => v.dir === 'uplink')
    const down = vars.filter(v => v.dir === 'downlink')

    const protoLabel = (() => {
        if (data.wireless === 'wifi') {
            return WIFI_PROTOS.find(p => p.id === data.protocol)?.label || data.protocol
        }
        return WIRELESS.find(w => w.id === data.wireless)?.label || data.wireless
    })()

    return (
        <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>Step 4</div>
                <h3>Data Flow Summary</h3>
                <p>Review how data will flow between your ESP32 and the dashboard.</p>
            </div>

            <div className={styles.flowDiagram}>
                <div className={styles.flowNode}>
                    <div className={styles.flowNodeIcon}>🔌</div>
                    <div className={styles.flowNodeLabel}>{data.name || 'ESP32 Device'}</div>
                    <div className={styles.flowNodeSub}>{DEVICE_TYPES.find(t => t.id === data.type)?.label || 'Board'}</div>
                </div>

                <div className={styles.flowArrows}>
                    {up.length > 0 && (
                        <div className={styles.flowArrow}>
                            <div className={styles.arrowLine}>
                                <div className={styles.arrowFill} style={{ background: 'var(--accent-purple)' }} />
                            </div>
                            <div className={styles.arrowLabel} style={{ color: 'var(--accent-purple)' }}>
                                ⬆ Uplink ({up.length} var{up.length !== 1 ? 's' : ''})
                                <div className={styles.arrowVars}>
                                    {up.map(v => (
                                        <span key={v.id} className={styles.varChip}>
                                            {v.name}<i>{v.unit ? ` ${v.unit}` : ''}</i>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {down.length > 0 && (
                        <div className={styles.flowArrow}>
                            <div className={styles.arrowLine}>
                                <div className={styles.arrowFill} style={{ background: 'var(--accent-green)' }} />
                            </div>
                            <div className={styles.arrowLabel} style={{ color: 'var(--accent-green)' }}>
                                ⬇ Downlink ({down.length} var{down.length !== 1 ? 's' : ''})
                                <div className={styles.arrowVars}>
                                    {down.map(v => (
                                        <span key={v.id} className={styles.varChip}
                                            style={{ background: 'rgba(0,229,160,.1)', color: 'var(--accent-green)', border: '1px solid rgba(0,229,160,.2)' }}>
                                            {v.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {up.length === 0 && down.length === 0 && (
                        <div className={styles.flowEmpty}>No variables defined.<br />Go back to Step 3 to add some.</div>
                    )}
                </div>

                <div className={styles.flowNode}>
                    <div className={styles.flowNodeIcon}>🖥️</div>
                    <div className={styles.flowNodeLabel}>EnthutechIoT Server</div>
                    <div className={styles.flowNodeSub}>{SERVER_HOST}:{SERVER_PORT}</div>
                </div>

                <div className={styles.flowArrowSm}>↔</div>

                <div className={styles.flowNode}>
                    <div className={styles.flowNodeIcon}>📊</div>
                    <div className={styles.flowNodeLabel}>Dashboard</div>
                    <div className={styles.flowNodeSub}>Browser / React App</div>
                </div>
            </div>

            <div className={styles.protoChip}>
                Wireless: <b>{WIRELESS.find(w => w.id === data.wireless)?.label || '—'}</b>
                {data.wireless === 'wifi' && <> &nbsp;·&nbsp; Protocol: <b>{protoLabel || '—'}</b></>}
            </div>

            <div className={styles.widgetSuggest}>
                <div className={styles.suggestTitle}>💡 Suggested Widgets for Dashboard</div>
                <div className={styles.suggestList}>
                    {up.map(v => (
                        <div key={v.id} className={styles.suggestItem}>
                            {v.type === 'bool' ? '💡 LED Status' : v.type === 'String' ? '📝 Text Display' : '📈 Line Chart'}
                            &nbsp;→ <code>{v.name}</code>
                            {v.unit && <span style={{ color: '#555' }}> ({v.unit})</span>}
                        </div>
                    ))}
                    {down.map(v => (
                        <div key={v.id} className={styles.suggestItem}>
                            {v.type === 'bool' ? '🔘 Toggle' : v.type === 'String' ? '⌨️ Text Input' : '🎚️ Slider'}
                            &nbsp;→ <code>{v.name}</code>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  STEP 5 — CREDENTIALS
// ─────────────────────────────────────────────────────────────
function StepCredentials({ device }) {
    const [copied, setCopied] = useState('')
    const copy = (text, key) => {
        navigator.clipboard?.writeText(text)
        setCopied(key)
        setTimeout(() => setCopied(''), 2000)
    }
    const endpoint = `${SERVER_HTTP}/api/v1/devices/${device.id}/ingest`
    const wsUrl = SERVER_WS

    return (
        <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>Step 5</div>
                <h3>Credentials</h3>
                <p>Copy these into your firmware — or just use the generated code in Step 6.</p>
            </div>

            <div className={styles.credGrid}>
                {[
                    { label: '🔑 API Key', value: device.apiKey, key: 'key' },
                    { label: '🆔 Device ID', value: device.id, key: 'id' },
                    { label: '🌐 Server', value: `${SERVER_HOST}:${SERVER_PORT}`, key: 'ip' },
                    { label: '📌 HTTP Endpoint', value: endpoint, key: 'ep' },
                    { label: '⚡ WebSocket URL', value: wsUrl, key: 'ws' },
                ].map(({ label, value, key }) => (
                    <div key={key} className={`${styles.credBox} ${key === 'ep' || key === 'ws' ? styles.credFull : ''}`}>
                        <div className={styles.credLabel}>{label}</div>
                        <div className={styles.credRow}>
                            <code className={styles.credVal}>{value}</code>
                            <button className={`${styles.cpBtn} ${copied === key ? styles.cpDone : ''}`}
                                onClick={() => copy(value, key)}>{copied === key ? '✓' : '⎘'}</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.infoBox} style={{ marginTop: 16 }}>
                🔐 <b>API Key</b> is your device's password. Never share it publicly.
                The server validates it on every request.
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  STEP 6 — BOILERPLATE CODE
// ─────────────────────────────────────────────────────────────
function StepCode({ device }) {
    const [copied, setCopied] = useState(false)
    const code = generateCode(device)
    const lines = code.split('\n')

    const copy = () => {
        navigator.clipboard?.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    return (
        <div className={styles.stepBody}>
            <div className={styles.stepHeading}>
                <div className={styles.stepNum}>Step 6</div>
                <h3>Boilerplate Code</h3>
                <p>Copy this into a new Arduino sketch. Install the <b>EnthutechIoT</b> library first.</p>
            </div>

            <div className={styles.codeSteps}>
                <div className={styles.codeStep}><span>1</span> Download the library → click <b>⬇ Arduino Library</b> in the Dashboard header</div>
                <div className={styles.codeStep}><span>2</span> Arduino IDE → Sketch → Include Library → <b>Add .ZIP Library…</b> → select the ZIP</div>
                <div className={styles.codeStep}><span>3</span> Paste the code below into a <b>new .ino file</b></div>
                <div className={styles.codeStep}><span>4</span> Set <code>WIFI_SSID</code> and <code>WIFI_PASS</code>, then upload to your board</div>
            </div>

            <div className={styles.codeWrap}>
                <div className={styles.codeHeader}>
                    <div className={styles.codeDots}><span /><span /><span /></div>
                    <div className={styles.codeFilename}>
                        {(device.name || 'device').toLowerCase().replace(/\s+/g, '_')}.ino
                    </div>
                    <button className={`${styles.copyBtn} ${copied ? styles.copyDone : ''}`} onClick={copy}>
                        {copied ? '✓ Copied!' : '⎘ Copy'}
                    </button>
                </div>
                <div className={styles.codeBody}>
                    <pre>
                        {lines.map((line, i) => (
                            <div key={i} className={styles.codeLine}>
                                <span className={styles.codeLineNum}>{i + 1}</span>
                                <span className={styles.codeLineText}>{line}</span>
                            </div>
                        ))}
                    </pre>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────
//  WIZARD SHELL
// ─────────────────────────────────────────────────────────────
export default function AddDeviceWizard({ onClose }) {
    const { addDevice } = useApp()

    const [step, setStep] = useState(0)
    const [form, setForm] = useState({
        name: '', description: '', location: '',
        type: 'esp32',
        wireless: 'wifi', protocol: 'http',
        variables: [],
        wifiSsid: '', wifiPass: '',
    })
    const [createdDevice, setCreatedDevice] = useState(null)

    const merge = useCallback(patch => setForm(p => ({ ...p, ...patch })), [])

    const canNext = () => {
        if (step === 0) return form.name.trim().length > 0
        if (step === 1) return form.wireless === 'wifi' && !!form.protocol
        if (step === 2) return true  // variables optional
        if (step === 3) return true
        if (step === 4) return !!createdDevice
        return true
    }

    const next = () => {
        if (step === 3 && !createdDevice) {
            const dev = addDevice({
                name: form.name.trim(),
                description: form.description,
                location: form.location,
                type: form.type,
                wireless: form.wireless,
                protocol: form.protocol,
                variables: form.variables,
            })
            setCreatedDevice(dev)
        }
        if (step < STEPS.length - 1) setStep(s => s + 1)
    }

    const prev = () => step > 0 && setStep(s => s - 1)

    const deviceForCode = createdDevice
        ? { ...form, ...createdDevice, wifiSsid: form.wifiSsid, wifiPass: form.wifiPass }
        : { ...form, id: '---', apiKey: '---' }

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.wizard}>

                {/* ── Header ─────────────────────────────────── */}
                <div className={styles.wizHeader}>
                    <div>
                        <h2 className={styles.wizTitle}>Add New Device</h2>
                        <p className={styles.wizSub}>Follow the steps to connect your device to the dashboard</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* ── Step bar ────────────────────────────────── */}
                <div className={styles.stepBar}>
                    {STEPS.map((s, i) => (
                        <div key={s.id}
                            className={`${styles.stepItem} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}
                            onClick={() => i < step && setStep(i)}>
                            <div className={styles.stepCircle}>
                                {i < step ? '✓' : s.icon}
                            </div>
                            <div className={styles.stepLabel}>{s.label}</div>
                            {i < STEPS.length - 1 && (
                                <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />
                            )}
                        </div>
                    ))}
                </div>

                {/* ── Step Content ──────────────────────────────── */}
                <div className={styles.stepContent}>
                    {step === 0 && <StepInfo data={form} setData={merge} />}
                    {step === 1 && <StepProtocol data={form} setData={merge} />}
                    {step === 2 && <StepVariables data={form} setData={merge} />}
                    {step === 3 && <StepDirection data={form} />}
                    {step === 4 && <StepCredentials device={createdDevice || deviceForCode} />}
                    {step === 5 && <StepCode device={deviceForCode} />}
                </div>

                {/* ── Footer nav ──────────────────────────────────── */}
                <div className={styles.wizFooter}>
                    <button className={styles.backBtn} onClick={prev} disabled={step === 0}>← Back</button>
                    <div className={styles.stepDots}>
                        {STEPS.map((_, i) => (
                            <div key={i} className={`${styles.dot} ${i === step ? styles.dotOn : i < step ? styles.dotDone : ''}`} />
                        ))}
                    </div>
                    {step < STEPS.length - 1 ? (
                        <button className={styles.nextBtn} onClick={next} disabled={!canNext()}>
                            {step === 3 ? '✅ Create Device' : 'Next →'}
                        </button>
                    ) : (
                        <button className={styles.doneBtn} onClick={onClose}>🎉 Done</button>
                    )}
                </div>
            </div>
        </div>
    )
}
