import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Modal.module.css'

const steps = ['Device Info', 'Connection', 'Credentials']

const DEVICE_TYPES = [
    { value: 'esp32', label: 'ESP32', icon: '🔲' },
    { value: 'esp8266', label: 'ESP8266', icon: '📶' },
    { value: 'arduino_wifi', label: 'Arduino + WiFi', icon: '🔧' },
    { value: 'raspberry_pi', label: 'Raspberry Pi', icon: '🥧' },
]

const PROTOCOLS = [
    { value: 'http', label: 'HTTP', desc: 'Port 80 — unencrypted, ideal for local network', icon: '🌐' },
    { value: 'https', label: 'HTTPS', desc: 'Port 443 — encrypted, recommended for internet', icon: '🔒' },
]

export default function AddDeviceModal({ onClose }) {
    const { addDevice } = useApp()
    const [step, setStep] = useState(0)
    const [form, setForm] = useState({ name: '', location: '', type: 'esp32', protocol: 'http' })
    const [createdDevice, setCreatedDevice] = useState(null)
    const [copied, setCopied] = useState('')

    const update = (k, v) => setForm(p => ({ ...p, [k]: v }))

    const handleCreate = () => {
        const device = addDevice(form)
        setCreatedDevice(device)
        setStep(2)
    }

    const copy = (text, key) => {
        navigator.clipboard?.writeText(text)
        setCopied(key)
        setTimeout(() => setCopied(''), 2000)
    }

    const arduinoCode = createdDevice ? `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* apiKey   = "${createdDevice.apiKey}";
const char* endpoint = "${createdDevice.endpoint}";

void sendData(float temperature, float humidity) {
  HTTPClient http;
  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);

  // JSON keys must match your Dashboard widget variables
  String body = "{\\"temperature\\":";
  body += temperature;
  body += ",\\"humidity\\":";
  body += humidity;
  body += "}";

  int code = http.POST(body);
  http.end();
}

void setup() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  float temp = 25.4;  // replace with real sensor
  float humid = 60.0; // replace with real sensor
  sendData(temp, humid);
  delay(5000);
}` : ''

    return (
        <div className={styles.overlay} onClick={step < 2 ? onClose : undefined}>
            <div className={`${styles.modal} ${styles.wide}`} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerIcon}>📡</div>
                    <div>
                        <h3 className={styles.title}>Add New Device</h3>
                        <p className={styles.subtitle}>{steps[step]}</p>
                    </div>
                    {step < 2 && <button className={styles.closeBtn} onClick={onClose}>✕</button>}
                </div>

                {/* Step indicator */}
                <div className={styles.steps}>
                    {steps.map((s, i) => (
                        <div key={s} className={`${styles.stepItem} ${i <= step ? styles.done : ''} ${i === step ? styles.current : ''}`}>
                            <div className={styles.stepNum}>{i < step ? '✓' : i + 1}</div>
                            <span>{s}</span>
                        </div>
                    ))}
                </div>

                {/* ── Step 0: Device Info ── */}
                {step === 0 && (
                    <div className={styles.body}>
                        <div className={styles.field}>
                            <label className={styles.label}>Device Name <span className={styles.req}>*</span></label>
                            <input className={styles.input} placeholder="e.g. Living Room Sensor" value={form.name} onChange={e => update('name', e.target.value)} autoFocus />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Location / Room</label>
                            <input className={styles.input} placeholder="e.g. Living Room" value={form.location} onChange={e => update('location', e.target.value)} />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Device Type</label>
                            <div className={styles.typeGrid}>
                                {DEVICE_TYPES.map(t => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        className={`${styles.typeCard} ${form.type === t.value ? styles.selected : ''}`}
                                        onClick={() => update('type', t.value)}
                                    >
                                        <span className={styles.typeIcon}>{t.icon}</span>
                                        <span className={styles.typeLabel}>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.footer}>
                            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
                            <button type="button" className={styles.btnPrimary} disabled={!form.name.trim()} onClick={() => setStep(1)}>Next →</button>
                        </div>
                    </div>
                )}

                {/* ── Step 1: Protocol ── */}
                {step === 1 && (
                    <div className={styles.body}>
                        <div className={styles.field}>
                            <label className={styles.label}>Communication Protocol</label>
                            <div className={styles.protocolList}>
                                {PROTOCOLS.map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        className={`${styles.protocolCard} ${form.protocol === p.value ? styles.selected : ''}`}
                                        onClick={() => update('protocol', p.value)}
                                    >
                                        <div className={styles.protocolLeft}>
                                            <span className={styles.protocolIcon}>{p.icon}</span>
                                            <div>
                                                <div className={styles.protocolLabel}>{p.label} <span className={styles.protocolBadge}>{p.value.toUpperCase()}</span></div>
                                                <div className={styles.protocolDesc}>{p.desc}</div>
                                            </div>
                                        </div>
                                        <div className={`${styles.radio} ${form.protocol === p.value ? styles.radioSelected : ''}`} />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Connection</label>
                            <div className={`${styles.protocolCard} ${styles.selected} ${styles.staticCard}`}>
                                <div className={styles.protocolLeft}>
                                    <span className={styles.protocolIcon}>📶</span>
                                    <div>
                                        <div className={styles.protocolLabel}>WiFi <span className={styles.protocolBadge}>802.11 b/g/n</span></div>
                                        <div className={styles.protocolDesc}>Standard WiFi connection for ESP32 / ESP8266</div>
                                    </div>
                                </div>
                                <div className={`${styles.radio} ${styles.radioSelected}`} />
                            </div>
                        </div>
                        <div className={styles.footer}>
                            <button type="button" className={styles.btnSecondary} onClick={() => setStep(0)}>← Back</button>
                            <button type="button" className={styles.btnPrimary} onClick={handleCreate}>Create Device</button>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Credentials ── */}
                {step === 2 && createdDevice && (
                    <div className={styles.body}>
                        <div className={styles.successBanner}>
                            <span className={styles.successIcon}>🎉</span>
                            <div>
                                <div className={styles.successTitle}>Device Created Successfully!</div>
                                <div className={styles.successSub}>Use the credentials below in your ESP32 firmware</div>
                            </div>
                        </div>

                        <div className={styles.credGrid}>
                            <div className={styles.credItem}>
                                <label className={styles.credLabel}>🔑 API Key</label>
                                <div className={styles.credCopy}>
                                    <code className={styles.credValue}>{createdDevice.apiKey}</code>
                                    <button className={styles.copyBtn} onClick={() => copy(createdDevice.apiKey, 'key')}>{copied === 'key' ? '✓ Copied' : 'Copy'}</button>
                                </div>
                            </div>
                            <div className={styles.credItem}>
                                <label className={styles.credLabel}>🆔 Device ID</label>
                                <div className={styles.credCopy}>
                                    <code className={styles.credValue}>{createdDevice.id}</code>
                                    <button className={styles.copyBtn} onClick={() => copy(createdDevice.id, 'id')}>{copied === 'id' ? '✓ Copied' : 'Copy'}</button>
                                </div>
                            </div>
                            <div className={`${styles.credItem} ${styles.fullWidth}`}>
                                <label className={styles.credLabel}>🌐 Data Endpoint (ESP32 sends data HERE)</label>
                                <div className={styles.credCopy}>
                                    <code className={styles.credValue}>{createdDevice.endpoint}</code>
                                    <button className={styles.copyBtn} onClick={() => copy(createdDevice.endpoint, 'url')}>{copied === 'url' ? '✓ Copied' : 'Copy'}</button>
                                </div>
                            </div>
                        </div>

                        <div className={styles.codeSection}>
                            <div className={styles.codeHeader}>
                                <span>📟 Arduino / ESP32 Sample Code</span>
                                <button className={styles.copyBtn} onClick={() => copy(arduinoCode, 'code')}>{copied === 'code' ? '✓ Copied' : 'Copy Code'}</button>
                            </div>
                            <pre className={styles.code}>{arduinoCode}</pre>
                        </div>

                        <div className={styles.footer}>
                            <button type="button" className={styles.btnPrimary} onClick={onClose}>Done → Go to Dashboard</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
