/**
 * ╔══════════════════════════════════════════════════════════════╗
 *   EnthutechIoT Production Server  v3.0
 *   - Firebase Firestore persistence
 *   - WebSocket uplink + downlink (real-time ESP32 ↔ Dashboard)
 *   - HTTP uplink  (POST /ingest)         — works from ESP32
 *   - HTTP downlink (GET /commands)       — ESP32 polls for commands
 *   - HTTPS-friendly (deploy behind Railway / Render reverse proxy)
 *   - Command queue per device — survives ESP32 reconnects
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const http = require('http')
const { WebSocketServer } = require('ws')
const os = require('os')
const path = require('path')
const fs = require('fs')
const archiver = require('archiver')
const { exec } = require('child_process')

// ── Config ────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000
const SERVER_LAN_FALLBACK = '192.168.0.1'   // fallback if auto-detect fails
const FRONTEND_URL = process.env.FRONTEND_URL || '*'

// ── Express ───────────────────────────────────────────────────
const app = express()
app.use(cors({
    origin: FRONTEND_URL === '*' ? '*' : [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}))
app.use(express.json())

// ══════════════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION
// ══════════════════════════════════════════════════════════════

let db;
let collection, doc, setDoc, getDoc, updateDoc, addDoc, getDocs, query, where, limit, orderBy, writeBatch, deleteDoc, serverTimestamp;
let isFirebaseConnected = false;

async function initFirebase() {
    try {
        const { initializeApp } = await import('firebase/app');
        const firestore = await import('firebase/firestore');

        const firebaseConfig = {
            apiKey: process.env.VITE_FIREBASE_API_KEY,
            authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.VITE_FIREBASE_APP_ID,
            measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
        };

        const app = initializeApp(firebaseConfig);
        db = firestore.getFirestore(app);
        
        ({ collection, doc, setDoc, getDoc, updateDoc, addDoc, getDocs, query, where, limit, orderBy, writeBatch, deleteDoc, serverTimestamp } = firestore);
        isFirebaseConnected = true;
        console.log('[DB] ✅ Firebase Firestore connected\n');
    } catch (err) {
        console.error('[DB] ❌ Firebase connection failed:', err.message);
        console.error('[DB] → Running with in-memory fallback (data will not persist)\n');
        isFirebaseConnected = false;
    }
}

// ══════════════════════════════════════════════════════════════
//  IN-MEMORY WS CLIENTS  (ephemeral — reconnect restores state)
// ══════════════════════════════════════════════════════════════
const dashboardClients = new Set()
const esp32Clients = new Map()   // deviceId → ws

function broadcastToDashboard(msg) {
    const payload = JSON.stringify(msg)
    dashboardClients.forEach(c => { if (c.readyState === 1) c.send(payload) })
}

function sendToESP32(deviceId, msg) {
    const ws = esp32Clients.get(deviceId)
    if (ws && ws.readyState === 1) { ws.send(JSON.stringify(msg)); return true }
    return false
}

function getLocalIP() {
    const nets = os.networkInterfaces()
    for (const name of Object.keys(nets))
        for (const net of nets[name])
            if (net.family === 'IPv4' && !net.internal) return net.address
    return '127.0.0.1'
}

// ══════════════════════════════════════════════════════════════
//  CORE DATA INGESTION  (shared HTTP + WS path)
// ══════════════════════════════════════════════════════════════
async function ingestData(deviceId, apiKey, payload) {
    const now = new Date()

    // Upsert device data document if DB is connected
    if (isFirebaseConnected) {
        try {
            const deviceRef = doc(db, 'devices', deviceId);
            await setDoc(deviceRef, {
                deviceId,
                apiKey,
                data: payload,
                lastSeen: now.toISOString()
            }, { merge: true });

            const historyRef = collection(db, 'devices', deviceId, 'history');
            await addDoc(historyRef, {
                t: now.getTime(),
                data: payload
            });
        } catch (e) {
            console.error('[DB] Failed to save device data:', e.message)
        }
    }

    console.log(`[${now.toLocaleTimeString()}] 📡 ${deviceId} →`, payload)

    // Broadcast live update to all connected dashboard browsers
    broadcastToDashboard({ type: 'data', deviceId, data: payload, lastSeen: now.toISOString() })
}

// ══════════════════════════════════════════════════════════════
//  REST ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── UPLINK: ESP32 sends sensor data ──────────────────────────
// Works for both HTTP and HTTPS ESP32 protocols
app.post('/api/v1/devices/:deviceId/ingest', async (req, res) => {
    const { deviceId } = req.params
    const apiKey = req.headers['x-api-key'] || ''
    const payload = req.body

    if (!payload || typeof payload !== 'object')
        return res.status(400).json({ error: 'Expected JSON body' })

    try {
        await ingestData(deviceId, apiKey, payload)
        res.json({ success: true, deviceId, received: payload, timestamp: new Date().toISOString() })
    } catch (err) {
        console.error('[INGEST] DB error:', err)
        res.status(500).json({ error: 'Database error' })
    }
})

// ── OTA Firmware Compilation ──────────────────────────────────
app.use('/ota', express.static(path.join(__dirname, 'ota')))

app.post('/api/v1/devices/:id/compile', async (req, res) => {
    const { id } = req.params
    const { code } = req.body
    
    if (!code) return res.status(400).json({ success: false, error: 'No code provided.' })

    const otaDir = path.join(__dirname, 'ota', id)
    const buildDir = path.join(otaDir, 'build')
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })

    const inoPath = path.join(otaDir, 'sketch', 'sketch.ino')
    if (!fs.existsSync(path.dirname(inoPath))) fs.mkdirSync(path.dirname(inoPath), { recursive: true })
    
    fs.writeFileSync(inoPath, code)

    console.log(`[OTA] Compiling for device: ${id}`)
    
    // arduino-cli compile requires the folder of the sketch to be the target
    exec(`arduino-cli compile --fqbn esp32:esp32:esp32 --output-dir "${buildDir}" "${path.dirname(inoPath)}"`, (err, stdout, stderr) => {
        if (err) {
            console.error(`[OTA] Compilation failed:`, stderr || err.message)
            return res.status(400).json({ success: false, error: 'Compilation failed', logs: stdout + '\\n' + stderr })
        }
        
        console.log(`[OTA] Compilation successful for ${id}`)
        return res.json({ success: true, url: `/ota/${id}/build/sketch.ino.bin` })
    })
})

const memCmdQueue = new Map() // Fallback queue when Firebase is offline

// ── DOWNLINK: Dashboard sends command to ESP32 ───────────────
// Works for: WebSocket delivery (instant) + HTTP/HTTPS polling fallback
app.post('/api/v1/devices/:deviceId/command', async (req, res) => {
    const { deviceId } = req.params
    const { key, value } = req.body

    if (!key) return res.status(400).json({ error: 'Missing key' })

    try {
        // Try instant WebSocket delivery first
        const wsDelivered = sendToESP32(deviceId, { type: 'command', key, value })

        if (wsDelivered) {
            // WS device — mark directly as delivered, no need to queue
            broadcastToDashboard({ type: 'command_status', deviceId, key, value, delivered: true, method: 'websocket' })
            return res.json({ success: true, deviceId, key, value, delivered: true, method: 'websocket' })
        }

        // HTTP/HTTPS device — queue the command
        if (!isFirebaseConnected) {
            // In-Memory Fallback Queue
            const memCmdId = 'mem_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
            if (!memCmdQueue.has(deviceId)) memCmdQueue.set(deviceId, [])
            memCmdQueue.get(deviceId).push({ _id: memCmdId, key, value, status: 'pending' })

            broadcastToDashboard({ type: 'command_status', deviceId, key, value, delivered: false, queued: true, method: 'mem-queue', cmdId: memCmdId })
            return res.json({ success: true, deviceId, key, value, delivered: false, queued: true, method: 'mem-queue', cmdId: memCmdId })
        }

        const cmdRef = await addDoc(collection(db, 'commands'), { deviceId, key, value, status: 'pending', createdAt: serverTimestamp() })
        broadcastToDashboard({ type: 'command_status', deviceId, key, value, delivered: false, queued: true, method: 'http-queue', cmdId: cmdRef.id })

        res.json({ success: true, deviceId, key, value, delivered: false, queued: true, method: 'http-queue', cmdId: cmdRef.id })

    } catch (err) {
        console.error('[CMD] error:', err)
        res.status(500).json({ error: 'Server error' })
    }
})

// ── DOWNLINK POLL: HTTP/HTTPS ESP32 fetches pending commands ─
// The ESP32 calls this every few seconds in its loop()
// Returns all pending commands and marks them as delivered
app.get('/api/v1/devices/:deviceId/commands', async (req, res) => {
    const { deviceId } = req.params
    const apiKey = req.headers['x-api-key'] || ''

    try {
        if (!isFirebaseConnected) {
            const pending = memCmdQueue.get(deviceId) || []
            if (pending.length > 0) {
                memCmdQueue.set(deviceId, []) // clear the queue immediately
                pending.forEach(cmd => {
                    broadcastToDashboard({
                        type: 'command_status',
                        deviceId, key: cmd.key, value: cmd.value,
                        delivered: true, method: 'mem-poll',
                        cmdId: cmd._id,
                    })
                })
                console.log(`[POLL-MEM] ${deviceId} picked up ${pending.length} command(s)`)
            }
            return res.json({
                commands: pending.map(c => ({ key: c.key, value: c.value, id: c._id })),
                count: pending.length,
            })
        }

        // Fetch all pending commands for this device
        const q = query(
            collection(db, 'commands'),
            where('deviceId', '==', deviceId),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        const pending = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));

        if (pending.length > 0) {
            // Mark them all as delivered
            const batch = writeBatch(db);
            pending.forEach(cmd => {
                const cmdRef = doc(db, 'commands', cmd._id);
                batch.update(cmdRef, { status: 'delivered' });
            });
            await batch.commit();

            // Notify dashboard that commands were picked up
            pending.forEach(cmd => {
                broadcastToDashboard({
                    type: 'command_status',
                    deviceId, key: cmd.key, value: cmd.value,
                    delivered: true, method: 'http-poll',
                    cmdId: cmd._id,
                })
            })
            console.log(`[POLL] ${deviceId} picked up ${pending.length} command(s)`)
        }

        res.json({
            commands: pending.map(c => ({ key: c.key, value: c.value, id: c._id })),
            count: pending.length,
        })
    } catch (err) {
        console.error('[POLL] DB error:', err)
        res.status(500).json({ error: 'Database error' })
    }
})

// ── ESP32 ACK: confirm a command was executed ─────────────────
app.post('/api/v1/devices/:deviceId/commands/:cmdId/ack', async (req, res) => {
    const { deviceId, cmdId } = req.params
    const { key, value, state } = req.body

    try {
        if (isFirebaseConnected && !cmdId.startsWith('mem_')) {
            const cmdRef = doc(db, 'commands', cmdId);
            await updateDoc(cmdRef, { status: 'acked' });
        }
        broadcastToDashboard({ type: 'command_ack', deviceId, key, value, state, cmdId })
        res.json({ success: true })
    } catch (err) {
        res.status(500).json({ error: 'Database error' })
    }
})

// ── GET device list ───────────────────────────────────────────
app.get('/api/v1/devices', async (req, res) => {
    try {
        if (!isFirebaseConnected) {
            return res.json([]);
        }
        const snapshot = await getDocs(collection(db, 'devices'));
        const devices = snapshot.docs.map(d => d.data());
        
        res.json(devices.map(d => ({
            deviceId: d.deviceId,
            data: d.data || {},
            lastSeen: d.lastSeen,
            wsConnected: esp32Clients.has(d.deviceId),
        })))
    } catch (err) {
        console.error('[API] Devices GET error:', err);
        res.status(500).json({ error: 'Database error' })
    }
})

// ── GET device history ────────────────────────────────────────
app.get('/api/v1/devices/:deviceId/history', async (req, res) => {
    const { deviceId } = req.params
    const limitCount = Math.min(parseInt(req.query.limit) || 100, 500)

    try {
        if (!isFirebaseConnected) return res.json({ deviceId, history: [], count: 0 });

        const historyRef = collection(db, 'devices', deviceId, 'history');
        const q = query(historyRef, orderBy('t', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        
        // Reverse so it's chronological for graphing
        const history = snapshot.docs.map(d => d.data()).reverse();

        res.json({ deviceId, history, count: history.length })
    } catch (err) {
        console.error('[API] History GET error:', err);
        res.status(500).json({ error: 'Database error' })
    }
})

// ── Health check (Railway/Render uses this) ───────────────────
app.get('/health', async (req, res) => {
    res.json({
        status: 'ok',
        db: isFirebaseConnected ? 'connected' : 'disconnected',
        dashboards: dashboardClients.size,
        esp32s: esp32Clients.size,
        uptime: Math.floor(process.uptime()),
    })
})

// ── Arduino Library download ──────────────────────────────────
app.get('/download/library', (req, res) => {
    const libDir = path.join(__dirname, 'arduino-library', 'EnthutechIoT')
    if (!fs.existsSync(libDir))
        return res.status(404).json({ error: 'Library folder not found' })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename=EnthutechIoT.zip')
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', err => { if (!res.headersSent) res.status(500).json({ error: 'ZIP failed' }) })
    archive.pipe(res)
    archive.directory(libDir, 'EnthutechIoT')
    archive.finalize()
})

// ── OTA Compilation Endpoint ──────────────────────────────────
app.post('/api/v1/devices/:deviceId/compile', async (req, res) => {
    const { deviceId } = req.params;
    const { code } = req.body;

    if (!code) return res.status(400).json({ error: 'Source code is required' });

    const otaDir = path.join(__dirname, 'ota');
    if (!fs.existsSync(otaDir)) fs.mkdirSync(otaDir, { recursive: true });

    // Create a temporary sketch folder
    const sketchName = `sketch_${deviceId}_${Date.now()}`;
    const sketchDir = path.join(os.tmpdir(), sketchName);
    const inoPath = path.join(sketchDir, `${sketchName}.ino`);

    try {
        fs.mkdirSync(sketchDir, { recursive: true });
        fs.writeFileSync(inoPath, code);

        // Compile using arduino-cli
        const fqbn = 'esp32:esp32:esp32';
        const buildPath = path.join(sketchDir, 'build');
        const cmd = `arduino-cli compile --fqbn ${fqbn} --build-path "${buildPath}" "${sketchDir}"`;

        console.log(`[OTA] Compiling for ${deviceId}...`);
        
        exec(cmd, (error, stdout, stderr) => {
            const outBin = path.join(buildPath, `${sketchName}.ino.bin`);
            const targetBin = path.join(otaDir, `${deviceId}.bin`);

            if (error) {
                console.error(`[OTA] Compile failed:`, stderr || stdout);
                return res.status(500).json({ success: false, logs: stdout + '\n' + stderr });
            }

            if (fs.existsSync(outBin)) {
                // Move the compiled binary to the static OTA folder
                fs.copyFileSync(outBin, targetBin);
                
                // Cleanup
                fs.rmSync(sketchDir, { recursive: true, force: true });
                
                console.log(`[OTA] Compile SUCCESS for ${deviceId} -> /ota/${deviceId}.bin`);
                res.json({ success: true, url: `/ota/${deviceId}.bin`, logs: stdout });
            } else {
                res.status(500).json({ success: false, logs: 'Binary file not found after compilation.\n' + stdout });
            }
        });

    } catch (err) {
        console.error('[OTA] Error:', err);
        res.status(500).json({ success: false, error: 'Failed to process compilation request' });
    }
});

// Serve compiled binaries
app.use('/ota', express.static(path.join(__dirname, 'ota')));

// ══════════════════════════════════════════════════════════════
//  SERVE STATIC FRONTEND (REACT APP)
// ══════════════════════════════════════════════════════════════
// Host the 'dist' folder generated by 'npm run build'
app.use(express.static(path.join(__dirname, 'dist')))

// Catch-all route to hand over routing to React Router
app.use((req, res) => {
    // Only intercept if we actually have a dist/index.html built, else just 404
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath)
    } else {
        res.status(404).send('Backend API Live. (run "npm run build" to compile Dashboard here)')
    }
})

// ══════════════════════════════════════════════════════════════
//  WEBSOCKET SERVER
// ══════════════════════════════════════════════════════════════
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
    let clientRole = 'unknown'
    let clientDeviceId = null

    ws.on('message', async (raw) => {
        let msg
        try { msg = JSON.parse(raw.toString()) } catch { return }

        // ── ESP32 hello ──────────────────────────────────────────
        if (msg.type === 'hello') {
            clientRole = 'esp32'
            clientDeviceId = msg.deviceId
            esp32Clients.set(clientDeviceId, ws)
            console.log(`[WS] ESP32 connected: ${clientDeviceId}`)
            broadcastToDashboard({ type: 'device_online', deviceId: clientDeviceId })
            ws.send(JSON.stringify({ type: 'hello_ack', deviceId: clientDeviceId, status: 'connected' }))

            // Send any queued commands to WS-connected device immediately
            try {
                if (isFirebaseConnected) {
                    const q = query(
                        collection(db, 'commands'),
                        where('deviceId', '==', clientDeviceId),
                        where('status', '==', 'pending')
                    );
                    const snapshot = await getDocs(q);
                    const pending = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));

                    if (pending.length > 0) {
                        const batch = writeBatch(db);
                        pending.forEach(cmd => {
                            ws.send(JSON.stringify({ type: 'command', key: cmd.key, value: cmd.value, cmdId: cmd._id }))
                            const cmdRef = doc(db, 'commands', cmd._id);
                            batch.update(cmdRef, { status: 'delivered' });
                        });
                        await batch.commit();
                    }
                }
            } catch (e) { /* non-fatal */ }
            return
        }

        // ── Dashboard connect ────────────────────────────────────
        if (msg.type === 'dashboard_connect') {
            clientRole = 'dashboard'
            dashboardClients.add(ws)
            console.log(`[WS] Dashboard connected (${dashboardClients.size} clients)`)

            // Send snapshot of all current device data from Firestore
            try {
                if (isFirebaseConnected) {
                    const snapshot = await getDocs(collection(db, 'devices'));
                    const devices = snapshot.docs.map(d => d.data());
                    ws.send(JSON.stringify({
                        type: 'snapshot',
                        devices: Object.fromEntries(devices.map(d => [d.deviceId, {
                            data: d.data || {},
                            lastSeen: d.lastSeen,
                            wsConnected: esp32Clients.has(d.deviceId),
                        }]))
                    }))
                } else {
                    ws.send(JSON.stringify({ type: 'snapshot', devices: {} }))
                }
            } catch (e) { console.error('WS Snapshot Error:', e) }
            return
        }

        // ── ESP32 → sensor data ──────────────────────────────────
        if (clientRole === 'esp32') {
            if (msg.type === 'data') {
                await ingestData(clientDeviceId, msg.apiKey || '', msg.data || {})
            }
            if (msg.type === 'command_ack') {
                console.log(`[WS] ESP32 ${clientDeviceId} ACK: ${msg.key}=${msg.value}`)
                if (msg.cmdId && !msg.cmdId.startsWith('mem_')) {
                    try {
                        if (isFirebaseConnected) {
                            const cmdRef = doc(db, 'commands', msg.cmdId);
                            await updateDoc(cmdRef, { status: 'acked' });
                        }
                    } catch { }
                }
                broadcastToDashboard({ type: 'command_ack', deviceId: clientDeviceId, key: msg.key, value: msg.value, state: msg.state })
            }
        }

        // ── Dashboard → command ──────────────────────────────────
        if (clientRole === 'dashboard' && msg.type === 'command') {
            const { deviceId, key, value } = msg
            const wsDelivered = sendToESP32(deviceId, { type: 'command', key, value })
            console.log(`[CMD] ${key}=${value} → ${deviceId} | ws: ${wsDelivered}`)

            if (!wsDelivered) {
                if (!isFirebaseConnected) {
                    // Queue for HTTP polling (In Memory)
                    const memCmdId = 'mem_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
                    if (!memCmdQueue.has(deviceId)) memCmdQueue.set(deviceId, [])
                    memCmdQueue.get(deviceId).push({ _id: memCmdId, key, value, status: 'pending' })

                    ws.send(JSON.stringify({ type: 'command_status', deviceId, key, value, delivered: false, queued: true, method: 'mem-queue', cmdId: memCmdId }))
                } else {
                    // Queue for HTTP polling (Firestore)
                    try {
                        const cmdRef = await addDoc(collection(db, 'commands'), {
                            deviceId,
                            key,
                            value,
                            status: 'pending',
                            createdAt: serverTimestamp()
                        })
                        ws.send(JSON.stringify({ type: 'command_status', deviceId, key, value, delivered: false, queued: true, method: 'http-queue', cmdId: cmdRef.id }))
                    } catch { }
                }
            } else {
                ws.send(JSON.stringify({ type: 'command_status', deviceId, key, value, delivered: true, method: 'websocket' }))
            }
        }
    })

    ws.on('close', () => {
        if (clientRole === 'esp32' && clientDeviceId) {
            esp32Clients.delete(clientDeviceId)
            console.log(`[WS] ESP32 disconnected: ${clientDeviceId}`)
            broadcastToDashboard({ type: 'device_offline', deviceId: clientDeviceId })
        }
        if (clientRole === 'dashboard') {
            dashboardClients.delete(ws)
        }
    })

    ws.on('error', () => ws.close())
})

// ══════════════════════════════════════════════════════════════
//  START: connect Firebase first, then listen
// ══════════════════════════════════════════════════════════════
async function main() {
    await initFirebase();

    const LOCAL_IP = getLocalIP()

    server.listen(PORT, '0.0.0.0', () => {
        console.log('╔══════════════════════════════════════════════════════╗')
        console.log('║   EnthutechIoT Production Server v3.0  + Firebase   ║')
        console.log('╚══════════════════════════════════════════════════════╝\n')
        console.log(`  ✅  Listening on port    ${PORT}`)
        console.log(`  🌐  http://localhost:${PORT}`)
        console.log(`  📡  http://${LOCAL_IP}:${PORT}   ← ESP32 uses this\n`)
        console.log('  ── Uplink (ESP32 → Server) ─────────────────────────')
        console.log(`  POST  /api/v1/devices/:id/ingest       ← HTTP/HTTPS upload`)
        console.log(`  WS    (send {type:"data", data:{...}}) ← WebSocket upload\n`)
        console.log('  ── Downlink (Server → ESP32) ───────────────────────')
        console.log(`  POST  /api/v1/devices/:id/command      ← Send from Dashboard`)
        console.log(`  GET   /api/v1/devices/:id/commands     ← ESP32 HTTP polling`)
        console.log(`  POST  /api/v1/devices/:id/commands/:cmdId/ack  ← ESP32 ACK\n`)
        console.log('  ── Other ───────────────────────────────────────────')
        console.log(`  GET   /api/v1/devices                  ← All devices`)
        console.log(`  GET   /api/v1/devices/:id/history      ← Data history`)
        console.log(`  GET   /health                          ← Health check`)
        console.log(`  GET   /download/library                ← Arduino library ZIP\n`)
        console.log('  Waiting for connections...\n')
    })
}

main()
