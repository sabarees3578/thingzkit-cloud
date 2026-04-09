import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import AddDeviceWizard from '../components/modals/AddDeviceWizard.jsx'
import WebEditor from '../components/WebEditor.jsx'
import styles from './SubPage.module.css'

// ── Friendly labels ──────────────────────────────────────────
const BOARD_LABEL = {
    esp32: 'ESP32',
    esp8266: 'ESP8266 / NodeMCU',
    arduino_wifi: 'Arduino + WiFi',
    raspberry_pi: 'Raspberry Pi',
}
const PROTO_LABEL = {
    ws: '⚡ WebSocket',
    http: '🌐 HTTP POST',
    mqtt: '📨 MQTT',
}
const DIR_COLOR = { uplink: 'var(--accent-purple)', downlink: 'var(--accent-green)' }

// ── Device Card ───────────────────────────────────────────────
function DeviceCard({ device, onDelete, onSimulate }) {
    const [showSim, setShowSim] = useState(false)
    const [showCode, setShowCode] = useState(false)
    const [showEditor, setShowEditor] = useState(false)
    const [simJson, setSimJson] = useState(() => {
        // Pre-fill sim JSON from uplink variables
        const up = (device.variables || []).filter(v => v.dir === 'uplink')
        if (up.length === 0) return '{\n  "temperature": 25.4\n}'
        const obj = {}
        up.forEach(v => { obj[v.name] = v.type === 'bool' ? false : v.type === 'String' ? '"hello"' : 0 })
        return JSON.stringify(obj, null, 2)
    })
    const [copied, setCopied] = useState('')

    const copy = (text, key) => {
        navigator.clipboard?.writeText(text)
        setCopied(key)
        setTimeout(() => setCopied(''), 2200)
    }

    const handleSim = () => {
        try { onSimulate(device.id, JSON.parse(simJson)); setShowSim(false) } catch { }
    }

    const uplinks = (device.variables || []).filter(v => v.dir === 'uplink')
    const downlinks = (device.variables || []).filter(v => v.dir === 'downlink')

    return (
        <div className={styles.fullCard}>
            {/* ── Card header ──────────────────────────────── */}
            <div className={styles.fullCardHeader}>
                <div className={styles.fcLeft}>
                    <div className={`${styles.fcStatusDot} ${styles[device.status]}`} />
                    <div>
                        <div className={styles.fcName}>{device.name}</div>
                        <div className={styles.fcMeta}>
                            {BOARD_LABEL[device.type] || device.type}
                            {device.protocol && ` · ${PROTO_LABEL[device.protocol] || device.protocol}`}
                            {device.location && ` · 📍 ${device.location}`}
                        </div>
                    </div>
                </div>
                <div className={styles.fcActions}>
                    <span className={`${styles.statusPill} ${styles[device.status]}`}>
                        {device.status === 'online' ? '● Online' : device.status === 'waiting' ? '⏳ Waiting' : '○ Offline'}
                    </span>
                    <button className={styles.simBtn} onClick={() => { setShowSim(v => !v); setShowCode(false); setShowEditor(false) }}>📟 Simulate</button>
                    <button className={styles.codeBtn} onClick={() => { setShowCode(v => !v); setShowSim(false); setShowEditor(false) }}>&lt;/&gt; Code</button>
                    <button className={styles.editorBtn} onClick={() => { setShowEditor(v => !v); setShowSim(false); setShowCode(false) }}>⚡ Editor</button>
                    <button className={styles.deleteBtn} onClick={() => onDelete(device.id)}>🗑</button>
                </div>
            </div>

            {/* ── Variables summary ────────────────────────── */}
            {(uplinks.length > 0 || downlinks.length > 0) && (
                <div className={styles.varSummary}>
                    {uplinks.length > 0 && (
                        <div className={styles.varGroup}>
                            <span className={styles.varGroupLabel} style={{ color: DIR_COLOR.uplink }}>⬆ Uplink</span>
                            {uplinks.map(v => (
                                <div key={v.id} className={styles.varChip} style={{ background: 'rgba(108,99,255,.1)', color: '#A5A0FF', border: '1px solid rgba(108,99,255,.2)' }}>
                                    <code>{v.name}</code>
                                    <span>{v.type}{v.unit ? ` · ${v.unit}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {downlinks.length > 0 && (
                        <div className={styles.varGroup}>
                            <span className={styles.varGroupLabel} style={{ color: DIR_COLOR.downlink }}>⬇ Downlink</span>
                            {downlinks.map(v => (
                                <div key={v.id} className={styles.varChip} style={{ background: 'rgba(0,229,160,.08)', color: 'var(--accent-green)', border: '1px solid rgba(0,229,160,.2)' }}>
                                    <code>{v.name}</code>
                                    <span>{v.type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Credentials ──────────────────────────────── */}
            <div className={styles.credGrid}>
                <div className={styles.credBox}>
                    <span className={styles.credLabel}>🔑 API Key</span>
                    <div className={styles.credRow}>
                        <code className={styles.credVal}>{device.apiKey}</code>
                        <button onClick={() => copy(device.apiKey, 'key')} className={`${styles.cpBtn} ${copied === 'key' ? styles.cpDone : ''}`}>{copied === 'key' ? '✓' : '⎘'}</button>
                    </div>
                </div>
                <div className={styles.credBox}>
                    <span className={styles.credLabel}>🆔 Device ID</span>
                    <div className={styles.credRow}>
                        <code className={styles.credVal}>{device.id}</code>
                        <button onClick={() => copy(device.id, 'id')} className={`${styles.cpBtn} ${copied === 'id' ? styles.cpDone : ''}`}>{copied === 'id' ? '✓' : '⎘'}</button>
                    </div>
                </div>
                <div className={`${styles.credBox} ${styles.full}`}>
                    <span className={styles.credLabel}>📌 HTTP Endpoint (POST from ESP32)</span>
                    <div className={styles.credRow}>
                        <code className={styles.credVal}>{device.endpoint}</code>
                        <button onClick={() => copy(device.endpoint, 'ep')} className={`${styles.cpBtn} ${copied === 'ep' ? styles.cpDone : ''}`}>{copied === 'ep' ? '✓' : '⎘'}</button>
                    </div>
                </div>
            </div>

            {device.lastSeen && (
                <div className={styles.lastSeen}>Last data: {device.lastSeen}</div>
            )}

            {/* ── Inline Simulate ──────────────────────────── */}
            {showSim && (
                <div className={styles.simInline}>
                    <div className={styles.simTitle}>📟 Send Test Data to this Device</div>
                    <textarea className={styles.simTextarea} value={simJson} onChange={e => setSimJson(e.target.value)} rows={5} />
                    <div className={styles.simHint}>Keys must match your uplink variable names</div>
                    <div className={styles.simActions}>
                        <button className={styles.simCancel} onClick={() => setShowSim(false)}>Cancel</button>
                        <button className={styles.simSend} onClick={handleSim}>Send Data →</button>
                    </div>
                </div>
            )}

            {/* ── Inline Mini Code ─────────────────────────── */}
            {showCode && (
                <div className={styles.codeInline}>
                    <div className={styles.codeInlineHeader}>
                        <span>&lt;/&gt; Quick Start — copy into your Arduino sketch</span>
                        <button onClick={() => copy(`#define DEVICE_ID "${device.id}"\n#define API_KEY   "${device.apiKey}"`, 'code')}
                            className={`${styles.cpBtn} ${copied === 'code' ? styles.cpDone : ''}`}>
                            {copied === 'code' ? '✓ Copied' : '⎘ Copy Credentials'}
                        </button>
                    </div>
                    <pre className={styles.codeInlinePre}>{`#include <EnthutechIoT.h>

const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "YourPassword";
const char* DEVICE_ID = "${device.id}";
const char* API_KEY   = "${device.apiKey}";
const char* SERVER_IP = "${device.baseUrl?.split('://')[1]?.split(':')[0] || '10.44.130.136'}";

EnthutechIoT iot(DEVICE_ID, API_KEY);

void setup() {
    Serial.begin(115200);
    iot.begin(WIFI_SSID, WIFI_PASS, SERVER_IP, 4000);
}

void loop() {
    iot.loop();
    // iot.beginPayload();
    //   iot.addField("temperature", analogRead(A0) / 10.0);
    // iot.sendPayload();
    delay(5000);
}`}</pre>
                    <div className={styles.codeInlineHint}>
                        💡 Download the full library from the Dashboard header for complete generated code
                    </div>
                </div>
            )}

            {/* ── Web Editor Modal ───────────────────────────── */}
            {showEditor && (
                <WebEditor device={device} onClose={() => setShowEditor(false)} />
            )}
        </div>
    )
}

// ── Devices Page ──────────────────────────────────────────────
export default function DevicesPage() {
    const { projectDevices, deleteDevice, simulateDeviceData } = useApp()
    const [showWizard, setShowWizard] = useState(false)

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Devices</h2>
                    <p className={styles.pageSub}>
                        {projectDevices.length} device{projectDevices.length !== 1 ? 's' : ''} · click <b>＋ Add Device</b> to run the setup wizard
                    </p>
                </div>
                <button className={styles.btnPrimary} onClick={() => setShowWizard(true)}>＋ Add Device</button>
            </div>

            {projectDevices.length === 0 ? (
                <div className={styles.emptyFull}>
                    <div className={styles.emptyIcon}>📡</div>
                    <h3>No devices yet</h3>
                    <p>Use the wizard to add your ESP32 or ESP8266.<br />You'll get credentials, variable definitions, and generated Arduino code.</p>
                    <button className={styles.btnPrimary} onClick={() => setShowWizard(true)}>＋ Add Your First Device</button>
                </div>
            ) : (
                <div className={styles.devicesFull}>
                    {projectDevices.map(d => (
                        <DeviceCard
                            key={d.id}
                            device={d}
                            onDelete={deleteDevice}
                            onSimulate={simulateDeviceData}
                        />
                    ))}
                </div>
            )}

            {showWizard && <AddDeviceWizard onClose={() => setShowWizard(false)} />}
        </div>
    )
}
