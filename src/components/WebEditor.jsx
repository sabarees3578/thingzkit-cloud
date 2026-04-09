import { useState, useEffect } from 'react'
import { SERVER_HTTP } from '../context/AppContext.jsx'
import Editor from '@monaco-editor/react'
import styles from './WebEditor.module.css'

const DEFAULT_CODE = `// Enthutech IoT - Web Editor
// Edit your code and upload directly to your ESP32 via OTA (Over-The-Air) or USB

#include <EnthutechIoT.h>

const char* WIFI_SSID = "YourWiFi";
const char* WIFI_PASS = "YourPassword";
const char* DEVICE_ID = "{{DEVICE_ID}}";
const char* API_KEY = "{{API_KEY}}";
const char* SERVER_IP = "{{SERVER_IP}}";

EnthutechIoT iot(DEVICE_ID, API_KEY);

void setup() {
    Serial.begin(115200);
    iot.begin(WIFI_SSID, WIFI_PASS, SERVER_IP, 4000);
}

void loop() {
    iot.loop();
    
    // Send sensor data
    iot.beginPayload();
    iot.addField("temperature", analogRead(A0) / 10.0);
    iot.addField("humidity", analogRead(A0) / 20.0);
    iot.sendPayload();
    
    delay(5000);
}`

export default function WebEditor({ device, onClose }) {
    const [code, setCode] = useState('')
    const [compiling, setCompiling] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [status, setStatus] = useState('')
    
    // USB Serial State
    const [port, setPort] = useState(null)
    const [connected, setConnected] = useState(false)
    const [showPorts, setShowPorts] = useState(false)
    const [ports, setPorts] = useState([])

    useEffect(() => {
        const defaultCode = DEFAULT_CODE
            .replace('{{DEVICE_ID}}', device?.id || 'DEV-XXXX')
            .replace('{{API_KEY}}', device?.apiKey || 'ET-XXXX')
            .replace('{{SERVER_IP}}', device?.baseUrl?.split('://')[1]?.split(':')[0] || '192.168.1.X')
        setCode(defaultCode)
    }, [device])

    const handleCodeChange = (value) => {
        setCode(value || '')
    }

    // ── USB Serial Tools ──────────────────────────────────────────
    const refreshPorts = async () => {
        if (!('serial' in navigator)) {
            setStatus('WebSerial not supported. Use Chrome/Edge or OTA.')
            return
        }
        try {
            const availablePorts = await navigator.serial.getPorts()
            setPorts(availablePorts)
            if (availablePorts.length > 0) {
                setShowPorts(true)
            } else {
                setStatus('No devices found. Connect via USB or use OTA.')
            }
        } catch (err) {
            setStatus('Error accessing serial ports: ' + err.message)
        }
    }

    const connectToPort = async (selectedPort) => {
        try {
            await selectedPort.open({ baudRate: 115200 })
            setPort(selectedPort)
            setConnected(true)
            setStatus('Connected to device!')
            setShowPorts(false)
        } catch (err) {
            setStatus('Failed to connect: ' + err.message)
        }
    }

    const disconnectPort = async () => {
        if (port) {
            await port.close()
            setPort(null)
            setConnected(false)
            setStatus('Disconnected')
        }
    }

    const uploadCodeUSB = async () => {
        if (!port || !connected) {
            setStatus('Please connect to a device first')
            return
        }
        setUploading(true)
        setStatus('Uploading via USB...')
        
        const writer = port.writable.getWriter()
        const encoder = new TextEncoder()
        
        try {
            for (let i = 0; i < 10; i++) {
                await writer.write(encoder.encode('\\n'))
                await new Promise(r => setTimeout(r, 200))
            }
            await writer.write(encoder.encode(code + '\\n'))
            await writer.releaseLock()
            await new Promise(r => setTimeout(r, 2000))
            setStatus('✓ Upload successful! Device restarting...')
        } catch (err) {
            setStatus('Upload failed: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    const uploadCodeOTA = async () => {
        setCompiling(true)
        setUploading(true)
        setStatus('☁️ Compiling over the cloud...')

        try {
            // Step 1: Compile logic on backend
            const compileReq = await fetch(`${SERVER_HTTP}/api/v1/devices/${device.id}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            })
            
            const compileRes = await compileReq.json()

            if (!compileReq.ok || !compileRes.success) {
                console.error("[OTA Logs]", compileRes.logs);
                setStatus('✕ Compilation failed. Check console for logs.')
                setCompiling(false)
                setUploading(false)
                return
            }

            setStatus('✓ Compiled successfully! Flashing OTA...')
            setCompiling(false)

            // Step 2: Push command to device Queue allowing it to download the .bin
            const otaUrl = `${window.location.protocol}//${window.location.host}${compileRes.url}`
            
            const pushReq = await fetch(`${SERVER_HTTP}/api/v1/devices/${device.id}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: '__update_ota__', value: otaUrl }),
            })

            const pushRes = await pushReq.json()
            if (pushRes.success) {
                setStatus(`✓ Command Sent! ${pushRes.delivered ? 'Updating now...' : 'Waiting for device to poll.'}`)
            } else {
                setStatus('✕ Could not send OTA command to device.')
            }

        } catch (e) {
            setStatus('✕ Cloud error: ' + e.message)
            setCompiling(false)
        } finally {
            setUploading(false)
        }
    }

    const downloadCode = () => {
        const blob = new Blob([code], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${device?.name || 'sketch'}.ino`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <span className={styles.title}>⚡ Web Editor</span>
                        <span className={styles.device}>{device?.name}</span>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.toolGroup}>
                        {!connected ? (
                            <button className={styles.portBtn} onClick={refreshPorts}>
                                🔌 Connect via USB
                            </button>
                        ) : (
                            <button className={styles.disconnectBtn} onClick={disconnectPort}>
                                🔌 Disconnect USB
                            </button>
                        )}
                        
                        {showPorts && ports.length > 0 && (
                            <div className={styles.portList}>
                                {ports.map((p, i) => (
                                    <button 
                                        key={i} 
                                        className={styles.portItem}
                                        onClick={() => connectToPort(p)}
                                    >
                                        📟 COM Port {i + 1}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={styles.toolGroup}>
                        <button 
                            className={styles.uploadBtn}
                            onClick={uploadCodeOTA}
                            disabled={uploading || compiling}
                            style={{ background: 'var(--accent-purple)', color: '#fff' }}
                        >
                            {uploading && !port ? '⏳ Flashing...' : '☁️ Upload Over-Air'}
                        </button>
                        <button 
                            className={styles.actionBtn}
                            onClick={uploadCodeUSB}
                            disabled={uploading || !connected}
                            style={{ borderColor: connected ? 'var(--accent-green)' : '' }}
                        >
                            {uploading && port ? '⏳ Uploading...' : '⬆ Upload USB'}
                        </button>
                        <button className={styles.downloadBtn} onClick={downloadCode}>
                            💾 Save .ino
                        </button>
                    </div>
                </div>

                {status && (
                    <div className={`${styles.status} ${status.includes('✓') ? styles.success : status.includes('✕') || status.includes('failed') || status.includes('Error') ? styles.error : ''}`}>
                        {status}
                    </div>
                )}

                <div className={styles.editorContainer}>
                    <Editor
                        height="100%"
                        language="cpp"
                        theme="vs-dark"
                        value={code}
                        onChange={handleCodeChange}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: 'monospace',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            automaticLayout: true,
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
