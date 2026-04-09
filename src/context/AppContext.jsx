import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { db } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'

const AppContext = createContext(null)

// ── Helpers ──────────────────────────────────────────────────
const genId = () => Math.random().toString(36).slice(2, 10).toUpperCase()
const genApiKey = () => 'ET-' + Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
const genDeviceId = () => 'DEV-' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()

// ── Backend server config ────────────────────────────────────
// Dynamically determine backend URL based on where the app is hosted
const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        // If deployed to production (not localhost), use the current origin
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return window.location.origin;
        }
    }
    // Context fallback for local development
    return (typeof __SERVER_URL__ !== 'undefined' ? __SERVER_URL__ : 'http://localhost:4000').replace(/\/$/, '')
}

const _BASE = getBaseUrl()
export const SERVER_HTTP = _BASE
export const SERVER_WS = _BASE.replace(/^https/, 'wss').replace(/^http/, 'ws')

// Determine host and port for device code generation
export const SERVER_HOST = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? window.location.hostname 
    : '10.44.130.136'; // PC LAN IP fallback

export const SERVER_PORT = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? (window.location.protocol === 'https:' ? 443 : 80)
    : 4000;

export const SERVER_LAN = SERVER_HOST; // Alias to prevent breakage in older bindings

export const ESP32_BASE = `${SERVER_HTTP}/api/v1`

function getBaseUrlFunc() {
    return ESP32_BASE
}

// ── Default initial project ───────────────────────────────────
const makeProject = (name = 'Smart Home Hub') => ({
    id: genId(), name, createdAt: new Date().toISOString(), description: ''
})

function initProjects() {
    try {
        const s = localStorage.getItem('et_projects')
        if (s) return JSON.parse(s)
    } catch { }
    const p = makeProject('Smart Home Hub')
    return [p]
}

function initCurrentId(projects) {
    try {
        const s = localStorage.getItem('et_currentProject')
        if (s && projects.find(p => p.id === s)) return s
    } catch { }
    return projects[0]?.id
}

// ── Provider ─────────────────────────────────────────────────
export function AppProvider({ children }) {
    const { currentUser } = useAuth()
    const [hasLoadedCloud, setHasLoadedCloud] = useState(false)

    const [projects, setProjects] = useState(initProjects)
    const [currentProjectId, setCurrentProjectId] = useState(() => {
        const ps = initProjects()
        return initCurrentId(ps)
    })
    // devices: { [projectId]: Device[] }
    const [devices, setDevices] = useState(() => {
        try { return JSON.parse(localStorage.getItem('et_devices') || '{}') } catch { return {} }
    })
    // widgets: { [projectId]: Widget[] }
    const [widgets, setWidgets] = useState(() => {
        try { return JSON.parse(localStorage.getItem('et_widgets') || '{}') } catch { return {} }
    })
    // liveData: { [deviceId]: { [variable]: value } }
    const [liveData, setLiveData] = useState({})
    // WebSocket connection status
    const [wsStatus, setWsStatus] = useState('disconnected')
    // wsRef for sending commands from anywhere
    const wsRef = useRef(null)
    // commandLog: { [deviceId+key]: { value, status, ts } }
    const [commandLog, setCommandLog] = useState({})
    // automations: { [projectId]: Automation[] }
    const [automations, setAutomations] = useState(() => {
        try { return JSON.parse(localStorage.getItem('et_automations') || '{}') } catch { return {} }
    })
    // alerts: { [projectId]: Alert[] }
    const [alerts, setAlerts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('et_alerts') || '{}') } catch { return {} }
    })

    // ── Theme ─────────────────────────────────────────────────
    const [theme, setTheme] = useState(() => {
        try { return localStorage.getItem('et_theme') || 'dark' } catch { return 'dark' }
    })

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark')
    }, [])

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('et_theme', theme)
    }, [theme])

    // ── Local Storage Persist (Fallback for Guests) ───────────
    useEffect(() => { if(!hasLoadedCloud) return; localStorage.setItem('et_projects', JSON.stringify(projects)) }, [projects, hasLoadedCloud])
    useEffect(() => { if(!hasLoadedCloud) return; localStorage.setItem('et_currentProject', currentProjectId) }, [currentProjectId, hasLoadedCloud])
    useEffect(() => { if(!hasLoadedCloud) return; localStorage.setItem('et_devices', JSON.stringify(devices)) }, [devices, hasLoadedCloud])
    useEffect(() => { if(!hasLoadedCloud) return; localStorage.setItem('et_widgets', JSON.stringify(widgets)) }, [widgets, hasLoadedCloud])
    useEffect(() => { if(!hasLoadedCloud) return; localStorage.setItem('et_automations', JSON.stringify(automations)) }, [automations, hasLoadedCloud])
    useEffect(() => { if(!hasLoadedCloud) return; localStorage.setItem('et_alerts', JSON.stringify(alerts)) }, [alerts, hasLoadedCloud])

    // ── Cloud Sync ───────────────────────────────────────────
    // Load from Cloud once on login
    useEffect(() => {
        if (currentUser) {
            setHasLoadedCloud(false)
            const loadFromCloud = async () => {
                try {
                    const snap = await getDoc(doc(db, 'users', currentUser.uid))
                    if (snap.exists()) {
                        const data = snap.data()
                        if(data.projects && data.projects.length) setProjects(data.projects)
                        if(data.currentProjectId) setCurrentProjectId(data.currentProjectId)
                        if(data.devices) setDevices(data.devices)
                        if(data.widgets) setWidgets(data.widgets)
                        if(data.automations) setAutomations(data.automations)
                        if(data.alerts) setAlerts(data.alerts)
                    }
                } catch (e) {
                    console.error("[Cloud] Error loading data", e)
                } finally {
                    setHasLoadedCloud(true)
                }
            }
            loadFromCloud()
        } else {
            setHasLoadedCloud(true)
        }
    }, [currentUser])

    // Save to Cloud on any local layout change (debounced 1s)
    useEffect(() => {
        if (!hasLoadedCloud || !currentUser) return
        
        const timeout = setTimeout(() => {
            const docRef = doc(db, 'users', currentUser.uid)
            setDoc(docRef, {
                projects, currentProjectId, devices, widgets, automations, alerts
            }, { merge: true }).catch(err => console.error("[Cloud] Config save error", err))
        }, 1000)

        return () => clearTimeout(timeout)
    }, [currentUser, hasLoadedCloud, projects, currentProjectId, devices, widgets, automations, alerts])

    const currentProject = projects.find(p => p.id === currentProjectId) || projects[0]
    const projectDevices = devices[currentProjectId] || []
    const projectWidgets = widgets[currentProjectId] || []
    const projectAutomations = automations[currentProjectId] || []
    const projectAlerts = alerts[currentProjectId] || []

    // ── Project actions ───────────────────────────────────────
    const addProject = useCallback((name, description = '') => {
        const p = makeProject(name)
        p.description = description
        setProjects(prev => [...prev, p])
        setCurrentProjectId(p.id)
        return p
    }, [])

    const deleteProject = useCallback((id) => {
        setProjects(prev => {
            const next = prev.filter(p => p.id !== id)
            if (currentProjectId === id && next.length > 0) setCurrentProjectId(next[0].id)
            return next
        })
    }, [currentProjectId])

    const renameProject = useCallback((id, name) => {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p))
    }, [])

    // ── WebSocket → live data from real ESP32 ─────────────────
    useEffect(() => {
        let ws
        let retryTimer

        const connect = () => {
            setWsStatus('connecting')
            ws = new WebSocket(SERVER_WS)

            ws.onopen = () => {
                setWsStatus('connected')
                wsRef.current = ws
                // Identify ourselves as a dashboard client
                ws.send(JSON.stringify({ type: 'dashboard_connect' }))
                console.log('[WS] Connected to backend server')
            }

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data)

                    if (msg.type === 'data') {
                        // Real ESP32 data arrived
                        const { deviceId, data } = msg
                        setLiveData(prev => ({ ...prev, [deviceId]: { ...(prev[deviceId] || {}), ...data } }))
                        // Update status to online for ALL projects that have this device
                        setDevices(prev => {
                            const updated = {}
                            for (const [projId, devList] of Object.entries(prev)) {
                                updated[projId] = devList.map(d =>
                                    d.id === deviceId
                                        ? { ...d, status: 'online', lastSeen: new Date().toLocaleTimeString() }
                                        : d
                                )
                            }
                            return updated
                        })
                        // Update chart widget history
                        setWidgets(prev => {
                            const updated = {}
                            for (const [projId, wList] of Object.entries(prev)) {
                                updated[projId] = wList.map(w => {
                                    if (w.deviceId === deviceId && w.type === 'chart' && data[w.variable] !== undefined) {
                                        const history = [...(w.history || []), { t: Date.now(), v: data[w.variable] }].slice(-50)
                                        return { ...w, history }
                                    }
                                    return w
                                })
                            }
                            return updated
                        })
                    } else if (msg.type === 'snapshot') {
                        // Initial state from server
                        const snap = msg.devices || {}
                        setLiveData(prev => {
                            const next = { ...prev }
                            for (const [deviceId, d] of Object.entries(snap)) {
                                next[deviceId] = { ...(prev[deviceId] || {}), ...d.data }
                            }
                            return next
                        })
                    }
                    if (msg.type === 'device_online') {
                        // ESP32 connected via WebSocket
                        setDevices(prev => {
                            const updated = {}
                            for (const [projId, devList] of Object.entries(prev)) {
                                updated[projId] = devList.map(d =>
                                    d.id === msg.deviceId ? { ...d, status: 'online', wsConnected: true } : d
                                )
                            }
                            return updated
                        })
                    }

                    if (msg.type === 'device_offline') {
                        setDevices(prev => {
                            const updated = {}
                            for (const [projId, devList] of Object.entries(prev)) {
                                updated[projId] = devList.map(d =>
                                    d.id === msg.deviceId ? { ...d, status: 'offline', wsConnected: false } : d
                                )
                            }
                            return updated
                        })
                    }

                    if (msg.type === 'command_status' || msg.type === 'command_ack') {
                        // Track command delivery / acknowledgement
                        const logKey = `${msg.deviceId}_${msg.key}`
                        setCommandLog(prev => ({
                            ...prev,
                            [logKey]: {
                                value: msg.value,
                                delivered: msg.delivered !== false,
                                ack: msg.type === 'command_ack',
                                state: msg.state,
                                ts: Date.now(),
                                message: msg.message || '',
                            }
                        }))
                    }

                } catch (err) {
                    console.warn('[WS] parse error', err)
                }
            }

            ws.onclose = () => {
                setWsStatus('disconnected')
                wsRef.current = null
                console.log('[WS] Disconnected — retrying in 5s')
                retryTimer = setTimeout(connect, 5000)
            }

            ws.onerror = () => {
                setWsStatus('disconnected')
                wsRef.current = null
                ws.close()
            }
        }

        connect()
        return () => {
            clearTimeout(retryTimer)
            ws?.close()
        }
    }, []) // mount once

    // ── Device actions ────────────────────────────────────────
    const addDevice = useCallback((data) => {
        const deviceId = genDeviceId()
        const apiKey = genApiKey()
        const device = {
            ...data,
            id: deviceId,
            apiKey,
            createdAt: new Date().toISOString(),
            status: 'waiting',
            lastSeen: null,
            baseUrl: ESP32_BASE,
            endpoint: `${ESP32_BASE}/devices/${deviceId}/ingest`,
        }
        setDevices(prev => ({
            ...prev,
            [currentProjectId]: [...(prev[currentProjectId] || []), device]
        }))
        return device
    }, [currentProjectId])

    const deleteDevice = useCallback((deviceId) => {
        setDevices(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).filter(d => d.id !== deviceId)
        }))
    }, [currentProjectId])

    const updateDeviceStatus = useCallback((deviceId, status) => {
        setDevices(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).map(d =>
                d.id === deviceId ? { ...d, status, lastSeen: new Date().toLocaleTimeString() } : d
            )
        }))
    }, [currentProjectId])

    // Simulate receiving data from ESP32
    const simulateDeviceData = useCallback((deviceId, jsonData) => {
        setLiveData(prev => ({ ...prev, [deviceId]: { ...(prev[deviceId] || {}), ...jsonData } }))
        updateDeviceStatus(deviceId, 'online')
        // Push history for chart + stat widgets
        setWidgets(prev => {
            const pWidgets = prev[currentProjectId] || []
            const updated = pWidgets.map(w => {
                const needsHistory = (w.type === 'chart' || w.type === 'stat')
                if (w.deviceId === deviceId && needsHistory && jsonData[w.variable] !== undefined) {
                    const history = [...(w.history || []), { t: Date.now(), v: jsonData[w.variable] }].slice(-100)
                    return { ...w, history }
                }
                return w
            })
            return { ...prev, [currentProjectId]: updated }
        })
    }, [currentProjectId, updateDeviceStatus])

    // ── Send command to ESP32 via WebSocket ───────────────────
    // key   = variable name to control (e.g. 'led', 'relay', 'fan')
    // value = any value (true/false, 0/1, 0-255 for PWM, etc.)
    const sendCommand = useCallback((deviceId, key, value) => {
        const logKey = `${deviceId}_${key}`
        if (wsRef.current && wsRef.current.readyState === 1) {
            // Prefer WebSocket delivery
            wsRef.current.send(JSON.stringify({ type: 'command', deviceId, key, value }))
            setCommandLog(prev => ({
                ...prev,
                [logKey]: { value, delivered: null, ack: false, ts: Date.now(), message: 'Sending via WebSocket…' }
            }))
        } else {
            // Fallback: HTTP POST — server queues it for HTTP/HTTPS-polling devices
            setCommandLog(prev => ({
                ...prev,
                [logKey]: { value, delivered: null, ack: false, ts: Date.now(), message: 'Queuing command…' }
            }))
            fetch(`${SERVER_HTTP}/api/v1/devices/${deviceId}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            })
                .then(r => r.json())
                .then(d => setCommandLog(prev => ({
                    ...prev,
                    [logKey]: {
                        value,
                        delivered: d.delivered,
                        queued: d.queued || false,
                        ack: false,
                        ts: Date.now(),
                        message: d.delivered
                            ? '✅ Delivered via WebSocket'
                            : d.queued
                                ? '⏳ Queued — ESP32 will pick up on next poll'
                                : '⚠️ ESP32 offline',
                    }
                })))
                .catch(() => setCommandLog(prev => ({
                    ...prev,
                    [logKey]: { value, delivered: false, ack: false, ts: Date.now(), message: '❌ Server unreachable' }
                })))
        }
    }, [])

    const addWidget = useCallback((data) => {
        const widget = { id: genId(), ...data, history: [], createdAt: new Date().toISOString() }
        setWidgets(prev => ({
            ...prev,
            [currentProjectId]: [...(prev[currentProjectId] || []), widget]
        }))
        return widget
    }, [currentProjectId])

    const removeWidget = useCallback((widgetId) => {
        setWidgets(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).filter(w => w.id !== widgetId)
        }))
    }, [currentProjectId])

    const updateWidget = useCallback((widgetId, changes) => {
        setWidgets(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).map(w =>
                w.id === widgetId ? { ...w, ...changes } : w
            )
        }))
    }, [currentProjectId])

    // ── Automation actions ─────────────────────────────────────
    const addAutomation = useCallback((data) => {
        const automation = {
            id: genId(),
            ...data,
            status: data.status || 'enabled',
            createdAt: new Date().toISOString(),
        }
        setAutomations(prev => ({
            ...prev,
            [currentProjectId]: [...(prev[currentProjectId] || []), automation]
        }))
        return automation
    }, [currentProjectId])

    const updateAutomation = useCallback((automationId, changes) => {
        setAutomations(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).map(a =>
                a.id === automationId ? { ...a, ...changes } : a
            )
        }))
    }, [currentProjectId])

    const deleteAutomation = useCallback((automationId) => {
        setAutomations(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).filter(a => a.id !== automationId)
        }))
    }, [currentProjectId])

    // ── Alert actions ──────────────────────────────────────────
    const addAlert = useCallback((data) => {
        const alert = {
            id: genId(),
            ...data,
            time: 'Just now',
            createdAt: new Date().toISOString(),
        }
        setAlerts(prev => ({
            ...prev,
            [currentProjectId]: [...(prev[currentProjectId] || []), alert]
        }))
        return alert
    }, [currentProjectId])

    const dismissAlert = useCallback((alertId) => {
        setAlerts(prev => ({
            ...prev,
            [currentProjectId]: (prev[currentProjectId] || []).filter(a => a.id !== alertId)
        }))
    }, [currentProjectId])

    const clearAlerts = useCallback(() => {
        setAlerts(prev => ({
            ...prev,
            [currentProjectId]: []
        }))
    }, [currentProjectId])

    // ── Check automations against live data ───────────────────
    const lastTriggeredRef = useRef({})

    useEffect(() => {
        const checkAutomations = () => {
            const autoList = automations[currentProjectId] || []
            autoList.forEach(auto => {
                if (auto.status !== 'enabled') return
                
                const deviceData = liveData[auto.deviceId]
                if (!deviceData) return

                const value = deviceData[auto.variable]
                if (value === undefined) return

                let triggered = false
                switch (auto.condition) {
                    case '>':
                        triggered = value > auto.threshold
                        break
                    case '<':
                        triggered = value < auto.threshold
                        break
                    case '==':
                        triggered = value == auto.threshold
                        break
                    case '!=':
                        triggered = value != auto.threshold
                        break
                    case '>=':
                        triggered = value >= auto.threshold
                        break
                    case '<=':
                        triggered = value <= auto.threshold
                        break
                }

                if (triggered) {
                    const now = Date.now()
                    const lastTriggered = lastTriggeredRef.current[auto.id] || 0
                    
                    // 1-minute cooldown per automation so it doesn't spam alerts/commands every 5 seconds
                    if (now - lastTriggered > 60000) {
                        lastTriggeredRef.current[auto.id] = now
                        
                        // 1. Create Dashboard Alert
                        addAlert({
                            title: auto.name,
                            desc: `${auto.variable} ${auto.condition} ${auto.threshold} (current: ${value})`,
                            level: auto.level || 'warning',
                            deviceId: auto.deviceId,
                            automationId: auto.id,
                            icon: auto.icon || '⚡',
                        })

                        // 2. Execute Action (if configured)
                        if (auto.actionDeviceId && auto.actionVariable && auto.actionValue !== undefined) {
                            sendCommand(auto.actionDeviceId, auto.actionVariable, auto.actionValue)
                        }
                    }
                }
            })
        }

        const timer = setInterval(checkAutomations, 5000)
        return () => clearInterval(timer)
    }, [liveData, automations, currentProjectId, addAlert, sendCommand])

    return (
        <AppContext.Provider value={{
            projects, currentProject, currentProjectId, setCurrentProjectId,
            projectDevices, projectWidgets, projectAutomations, projectAlerts,
            liveData, wsStatus, commandLog,
            addProject, deleteProject, renameProject,
            addDevice, deleteDevice, updateDeviceStatus, simulateDeviceData,
            addWidget, removeWidget, updateWidget,
            addAutomation, updateAutomation, deleteAutomation,
            addAlert, dismissAlert, clearAlerts,
            sendCommand,
            theme, toggleTheme,
            SERVER_HTTP, SERVER_WS, SERVER_LAN, ESP32_BASE,
        }}>
            {children}
        </AppContext.Provider>
    )
}

export const useApp = () => useContext(AppContext)
