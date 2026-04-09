import { useRef, useEffect, useState, useCallback } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
    Chart, LineElement, BarElement, PointElement,
    LinearScale, CategoryScale, Filler, Tooltip, Legend
} from 'chart.js'
import { useApp } from '../context/AppContext.jsx'
import AddWidgetModal from '../components/modals/AddWidgetModal.jsx'
import styles from './DashboardPage.module.css'

Chart.register(LineElement, BarElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

// ── Shared chart options ──────────────────────────────────────
const chartOpts = (color) => ({
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: 'rgba(20,24,40,.95)', borderColor: 'rgba(108,99,255,.3)', borderWidth: 1, titleColor: '#EAEAF4', bodyColor: '#8B8FA8', padding: 8, cornerRadius: 8 },
    },
    scales: {
        x: { ticks: { color: '#555', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } },
        y: { ticks: { color: '#555', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,.04)' } },
    },
})

// ── Gauge Widget ──────────────────────────────────────────────
function GaugeWidget({ widget, value }) {
    const ref = useRef(null)
    useEffect(() => {
        const canvas = ref.current; if (!canvas) return
        const ctx = canvas.getContext('2d')
        const W = canvas.width, H = canvas.height
        ctx.clearRect(0, 0, W, H)
        const cx = W / 2, cy = H - 4, r = Math.min(W, H) - 20
        const num = parseFloat(value)
        const pct = isNaN(num) ? 0 : Math.min(Math.max((num - widget.min) / (widget.max - widget.min), 0), 1)
        const valueA = Math.PI + pct * Math.PI
        ctx.beginPath(); ctx.arc(cx, cy, r / 2, Math.PI, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke()
        if (!isNaN(num)) {
            const g = ctx.createLinearGradient(0, 0, W, 0)
            g.addColorStop(0, widget.color + '77'); g.addColorStop(1, widget.color)
            ctx.beginPath(); ctx.arc(cx, cy, r / 2, Math.PI, valueA)
            ctx.strokeStyle = g; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke()
        }
    }, [value, widget])

    return (
        <div className={styles.gaugeInner}>
            <canvas ref={ref} width={140} height={90} />
            <div className={styles.gaugeNum} style={{ color: widget.color }}>
                {value !== undefined ? `${value}${widget.unit}` : '—'}
            </div>
            <div className={styles.gaugeMeta}>{widget.min} → {widget.max}{widget.unit}</div>
        </div>
    )
}

// ── Line Chart Widget ─────────────────────────────────────────
function ChartWidget({ widget }) {
    const history = widget.history || []
    const labels = history.map((_, i) => `${history.length - i - 1}s`)
    const data = {
        labels,
        datasets: [{
            data: history.map(h => h.v),
            fill: true,
            borderColor: widget.color,
            backgroundColor: widget.color + '15',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.4,
        }],
    }
    return (
        <div style={{ height: 120 }}>
            {history.length < 2 ? (
                <div className={styles.waitingMsg}>
                    <div className={styles.pulsingDot} style={{ background: widget.color }} />
                    Collecting data…
                </div>
            ) : (
                <Line data={data} options={chartOpts(widget.color)} />
            )}
        </div>
    )
}

// ── Compare Chart (multi-variable bar or line) ────────────────
function CompareChartWidget({ widget }) {
    const { liveData } = useApp()
    const series = widget.series || []
    if (series.length === 0) return <div className={styles.waitingMsg}>No series configured</div>

    const labels = series.map(s => s.label || s.variable)
    const values = series.map(s => {
        const raw = (liveData[s.deviceId] || {})[s.variable]
        return raw !== undefined ? parseFloat(raw) : null
    })
    const hasAny = values.some(v => v !== null)

    const data = {
        labels,
        datasets: [{
            label: widget.label,
            data: values,
            backgroundColor: series.map(s => s.color + 'BB'),
            borderColor: series.map(s => s.color),
            borderWidth: 2,
            borderRadius: 6,
        }],
    }

    const opts = {
        ...chartOpts(),
        plugins: { legend: { display: false } },
    }

    return (
        <div style={{ height: 130 }}>
            {!hasAny ? (
                <div className={styles.waitingMsg}>
                    <div className={styles.pulsingDot} style={{ background: series[0]?.color || 'var(--accent-purple)' }} />
                    Waiting for data from series…
                </div>
            ) : widget.chartType === 'line' ? (
                <Line data={{
                    labels,
                    datasets: series.map(s => ({
                        label: s.label,
                        data: [(liveData[s.deviceId] || {})[s.variable]].map(v => v !== undefined ? parseFloat(v) : null),
                        borderColor: s.color,
                        backgroundColor: s.color + '20',
                        borderWidth: 2,
                        tension: 0.4,
                    }))
                }} options={{ ...opts, plugins: { legend: { display: true, labels: { color: '#888', font: { size: 9 } } } } }} />
            ) : (
                <Bar data={data} options={opts} />
            )}
        </div>
    )
}

// ── Stat Block (min / avg / max) ──────────────────────────────
function StatWidget({ widget }) {
    const history = widget.history || []
    if (history.length === 0) return (
        <div className={styles.waitingMsg}>
            <div className={styles.pulsingDot} style={{ background: widget.color }} />
            Collecting data…
        </div>
    )
    const vals = history.map(h => parseFloat(h.v)).filter(v => !isNaN(v))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length

    return (
        <div className={styles.statBlock}>
            {[['MIN', min], ['AVG', avg], ['MAX', max]].map(([k, v]) => (
                <div key={k} className={styles.statBlockItem}>
                    <div className={styles.statBlockKey}>{k}</div>
                    <div className={styles.statBlockVal} style={{ color: widget.color }}>
                        {v.toFixed(1)}{widget.unit}
                    </div>
                </div>
            ))}
        </div>
    )
}

// ── LED Status Widget ─────────────────────────────────────────
function LEDWidget({ widget, value }) {
    const isOn = value === true || value === 1 || value === 'true' || value === 'on' || value === '1'
    return (
        <div className={styles.ledInner}>
            <div className={styles.ledDot} style={{
                background: isOn ? widget.color : 'rgba(255,255,255,.1)',
                boxShadow: isOn ? `0 0 20px ${widget.color}` : 'none',
            }} />
            <div>
                <div className={styles.ledLabel} style={isOn ? { color: widget.color } : {}}>
                    {isOn ? '● ACTIVE' : '○ INACTIVE'}
                </div>
                <div className={styles.ledVar}>key: <code>{widget.variable}</code></div>
            </div>
        </div>
    )
}

// ── Toggle Widget ─────────────────────────────────────────────
function ToggleWidget({ widget, value }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_${widget.variable}`
    const log = commandLog[logKey]

    const isOn = value === true || value === 1 || value === 'on' || value === 'true' || value === '1'
    const isPending = log && log.delivered === null

    const toggle = () => {
        sendCommand(widget.deviceId, widget.variable, !isOn)
    }

    return (
        <div className={styles.toggleInner}>
            <button
                className={`${styles.toggleBig} ${isOn ? styles.toggleOn : ''} ${isPending ? styles.togglePending : ''}`}
                onClick={toggle}
                disabled={isPending}
                title={isOn ? 'Click to turn OFF' : 'Click to turn ON'}
            >
                <span>{isPending ? '⏳' : isOn ? 'ON' : 'OFF'}</span>
            </button>
            {log && (
                <div className={styles.cmdStatus}>
                    {log.ack ? '✅ ESP32 confirmed' : log.delivered === false ? '⚠️ ESP32 offline' : log.delivered ? '📡 Sent' : '⏳ Sending…'}
                </div>
            )}
            <p className={styles.toggleHint}>Tap to send command to ESP32</p>
        </div>
    )
}

// ── Slider Widget ─────────────────────────────────────────────
function SliderWidget({ widget, value }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_${widget.variable}`
    const log = commandLog[logKey]

    const min = widget.min ?? 0
    const max = widget.max ?? 100
    const step = widget.step ?? 1
    const current = log?.value !== undefined ? parseFloat(log.value) : (value !== undefined ? parseFloat(value) : min)

    const [local, setLocal] = useState(current)

    const handleChange = useCallback(e => {
        const v = parseFloat(e.target.value)
        setLocal(v)
    }, [])

    const handleRelease = useCallback(e => {
        const v = parseFloat(e.target.value)
        sendCommand(widget.deviceId, widget.variable, v)
    }, [widget.deviceId, widget.variable, sendCommand])

    const pct = Math.round(((local - min) / (max - min)) * 100)

    return (
        <div className={styles.sliderInner}>
            <div className={styles.sliderTop}>
                <span className={styles.sliderVal} style={{ color: widget.color }}>
                    {local}{widget.unit}
                </span>
                {log && <span className={styles.cmdStatus}>{log.delivered === null ? '⏳' : log.delivered ? '📡' : '⚠️'}</span>}
            </div>
            <div className={styles.sliderTrackWrap}>
                <div className={styles.sliderFill} style={{ width: `${pct}%`, background: widget.color }} />
                <input type="range" min={min} max={max} step={step} value={local}
                    onChange={handleChange} onMouseUp={handleRelease} onTouchEnd={handleRelease}
                    className={styles.sliderInput}
                    style={{ '--thumb-color': widget.color }}
                />
            </div>
            <div className={styles.sliderRange}><span>{min}{widget.unit}</span><span>{max}{widget.unit}</span></div>
        </div>
    )
}

// ── Button Widget ─────────────────────────────────────────────
function ButtonWidget({ widget }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_${widget.variable}`
    const log = commandLog[logKey]
    const [pressed, setPressed] = useState(false)

    const handleClick = () => {
        setPressed(true)
        sendCommand(widget.deviceId, widget.variable, widget.onValue ?? 'true')
        setTimeout(() => setPressed(false), 600)
    }

    return (
        <div className={styles.btnWidgetInner}>
            <button
                className={`${styles.btnWidgetBtn} ${pressed ? styles.btnWidgetPressed : ''}`}
                style={{ '--btn-color': widget.color, background: widget.color }}
                onClick={handleClick}
            >
                {widget.btnLabel || 'SEND'}
            </button>
            {log && (
                <div className={styles.cmdStatus}>
                    {log.ack ? '✅ ESP32 confirmed' : log.delivered === false ? '⚠️ Offline' : log.delivered ? '📡 Sent' : '⏳'}
                </div>
            )}
        </div>
    )
}

// ── Number Input Widget ───────────────────────────────────────
function NumberInputWidget({ widget }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_${widget.variable}`
    const log = commandLog[logKey]
    const [val, setVal] = useState(widget.min ?? 0)

    const send = () => {
        if (val === '' || val === null) return
        sendCommand(widget.deviceId, widget.variable, parseFloat(val))
    }

    return (
        <div className={styles.numInputInner}>
            <div className={styles.numInputRow}>
                <input type="number" value={val}
                    min={widget.min} max={widget.max} step={widget.step ?? 1}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    className={styles.numInput}
                    placeholder={`${widget.min ?? 0} – ${widget.max ?? 100}`}
                />
                {widget.unit && <span className={styles.numUnit}>{widget.unit}</span>}
                <button className={styles.numSendBtn}
                    style={{ background: widget.color }}
                    onClick={send}>→</button>
            </div>
            {log && (
                <div className={styles.cmdStatus}>
                    {log.ack ? '✅ ESP32 confirmed' : log.delivered === false ? '⚠️ Offline' : log.delivered ? `📡 Sent: ${log.value}` : '⏳ Sending…'}
                </div>
            )}
            <div className={styles.toggleHint}>Press Enter or → to send</div>
        </div>
    )
}

// ── Thermometer Widget ───────────────────────────────────────
function ThermometerWidget({ widget, value }) {
    const num = parseFloat(value)
    const min = widget.min ?? 0; const max = widget.max ?? 100
    const pct = isNaN(num) ? 0 : Math.min(Math.max((num - min) / (max - min), 0), 1)
    const c = widget.color
    return (
        <div className={styles.thermoInner}>
            <svg width="36" height="110" viewBox="0 0 36 110">
                <rect x="13" y="5" width="10" height="78" rx="5" fill="rgba(255,255,255,.07)" />
                <rect x="13" y={5 + (1 - pct) * 78} width="10" height={pct * 78} rx="5" fill={c}
                    style={{ filter: `drop-shadow(0 0 4px ${c})`, transition: '.5s' }} />
                <circle cx="18" cy="92" r="13" fill={c} style={{ filter: `drop-shadow(0 0 8px ${c})` }} />
                <circle cx="18" cy="92" r="8" fill="rgba(255,255,255,.25)" />
            </svg>
            <div>
                <div className={styles.thermoVal} style={{ color: c }}>
                    {value !== undefined ? `${num.toFixed(1)}${widget.unit}` : '—'}
                </div>
                <div className={styles.thermoRange}>{min} – {max}{widget.unit}</div>
            </div>
        </div>
    )
}

// ── Progress Bar Widget ───────────────────────────────────────
function ProgressBarWidget({ widget, value }) {
    const num = parseFloat(value)
    const min = widget.min ?? 0; const max = widget.max ?? 100
    const pct = isNaN(num) ? 0 : Math.min(Math.max((num - min) / (max - min), 0), 1)
    const c = widget.color
    return (
        <div className={styles.progInner}>
            <div className={styles.progHeader}>
                <span className={styles.progVal} style={{ color: c }}>
                    {value !== undefined ? `${num.toFixed(1)}${widget.unit}` : '—'}
                </span>
                <span className={styles.progPct}>{Math.round(pct * 100)}%</span>
            </div>
            <div className={styles.progTrack}>
                <div className={styles.progFill} style={{ width: `${pct * 100}%`, background: `linear-gradient(90deg,${c}80,${c})`, boxShadow: `0 0 10px ${c}60`, transition: '.5s' }} />
            </div>
            <div className={styles.progRange}>
                <span>{min}{widget.unit}</span><span>{max}{widget.unit}</span>
            </div>
        </div>
    )
}

// ── Battery Widget ────────────────────────────────────────────
function BatteryWidget({ widget, value }) {
    const pct = Math.min(100, Math.max(0, parseFloat(value) || 0))
    const c = pct > 60 ? 'var(--accent-green)' : pct > 25 ? 'var(--accent-yellow)' : 'var(--accent-red)'
    return (
        <div className={styles.battInner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className={styles.battIcon}>
                    <div className={styles.battFill} style={{ height: `${pct}%`, background: c, boxShadow: `0 0 10px ${c}50`, transition: '.5s' }} />
                </div>
                <div className={styles.battTip} />
            </div>
            <div>
                <div className={styles.battPct} style={{ color: c }}>{pct.toFixed(0)}%</div>
                <div className={styles.battStatus}>{pct > 60 ? 'Good' : pct > 25 ? 'Low' : '⚠️ Critical'}</div>
            </div>
        </div>
    )
}

// ── Compass Widget ────────────────────────────────────────────
function CompassWidget({ widget, value }) {
    const deg = parseFloat(value) || 0
    const nx = 50 + 36 * Math.sin(deg * Math.PI / 180)
    const ny = 50 - 36 * Math.cos(deg * Math.PI / 180)
    const c = widget.color
    return (
        <div className={styles.compassInner}>
            <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.08)" strokeWidth="2" />
                {['N', 'E', 'S', 'W'].map((d, i) => {
                    const a = i * 90
                    return <text key={d} x={50 + 40 * Math.sin(a * Math.PI / 180)} y={50 - 40 * Math.cos(a * Math.PI / 180) + 4}
                        textAnchor="middle" fill={d === 'N' ? 'var(--accent-red)' : '#555'} fontSize="9" fontWeight="bold">{d}</text>
                })}
                <line x1="50" y1="50" x2={nx} y2={ny} stroke={c} strokeWidth="3" strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 4px ${c})`, transition: '.4s' }} />
                <circle cx="50" cy="50" r="5" fill={c} />
            </svg>
            <div className={styles.compassDeg} style={{ color: c }}>{deg.toFixed(1)}°</div>
        </div>
    )
}

// ── Text Widget ───────────────────────────────────────────────
function TextWidget({ value }) {
    return (
        <div className={styles.textInner}>
            <div className={styles.textValue}>{value !== undefined ? String(value) : '—'}</div>
        </div>
    )
}

// ── Table Widget ──────────────────────────────────────────────
function TableWidget({ widget }) {
    const { liveData } = useApp()
    const series = widget.series || []
    return (
        <div className={styles.tableInner}>
            {series.length === 0 ? (
                <div className={styles.waitingMsg}>No variables configured</div>
            ) : series.map((s, i) => {
                const raw = (liveData[s.deviceId] || {})[s.variable]
                return (
                    <div key={i} className={styles.tableRow}>
                        <code className={styles.tableKey}>{s.label || s.variable}</code>
                        <span className={styles.tableVal}>{raw !== undefined ? `${raw}${s.unit || ''}` : '—'}</span>
                    </div>
                )
            })}
        </div>
    )
}

// ── Speedometer Widget ────────────────────────────────────────
function SpeedometerWidget({ widget, value }) {
    const num = parseFloat(value) || 0
    const min = widget.min ?? 0; const max = widget.max ?? 100
    const pct = Math.min(Math.max((num - min) / (max - min), 0), 1)
    const c = widget.color
    // Full arc: -140° to +140° → 280° sweep
    const startA = -230 * Math.PI / 180
    const sweepA = 280 * Math.PI / 180
    const needleA = (-230 + pct * 280) * Math.PI / 180
    const nx = 65 + 44 * Math.cos(needleA)
    const ny = 65 + 44 * Math.sin(needleA)
    const arcLen = 220
    return (
        <div className={styles.speedoInner}>
            <svg width="130" height="90" viewBox="0 0 130 90">
                <path d="M15 80 A55 55 0 1 1 115 80" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" strokeLinecap="round" />
                <path d="M15 80 A55 55 0 1 1 115 80" fill="none" stroke={c} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${pct * arcLen} ${arcLen}`}
                    style={{ filter: `drop-shadow(0 0 6px ${c})`, transition: '.5s' }} />
                <line x1="65" y1="80" x2={15 + pct * 100} y2={20 + pct * 25} stroke="#EAEAF4" strokeWidth="2.5" strokeLinecap="round"
                    style={{ transition: '.5s' }} />
                <circle cx="65" cy="80" r="5" fill={c} />
                <text x="65" y="72" textAnchor="middle" fill={c} fontSize="11" fontWeight="bold">{num.toFixed(1)}{widget.unit}</text>
            </svg>
        </div>
    )
}

// ── Heat Cell Widget ──────────────────────────────────────────
function HeatCellWidget({ widget, value }) {
    const num = parseFloat(value) || 0
    const min = widget.min ?? 0; const max = widget.max ?? 100
    const pct = Math.min(Math.max((num - min) / (max - min), 0), 1)
    const ir = Math.round(255 * pct); const ig = Math.round(200 * (1 - pct))
    return (
        <div className={styles.heatCell} style={{
            background: `rgba(${ir},${ig},50,.12)`,
            borderColor: `rgba(${ir},${ig},50,.3)`,
        }}>
            <div className={styles.heatVal} style={{ color: `rgb(${ir},${ig},60)` }}>
                {value !== undefined ? `${num.toFixed(1)}${widget.unit}` : '—'}
            </div>
            <div className={styles.heatPct}>{Math.round(pct * 100)}% of range</div>
        </div>
    )
}

// ── Alert Widget ──────────────────────────────────────────────
function AlertWidget({ widget, value }) {
    const num = parseFloat(value) || 0
    const triggered = num >= (widget.max ?? 100)
    const c = triggered ? 'var(--accent-red)' : widget.color
    return (
        <div className={styles.alertWidget} style={{ borderColor: triggered ? 'var(--accent-red)' : 'rgba(255,255,255,.08)' }}>
            <div className={styles.alertWidgetStatus} style={{ color: c }}>
                {triggered ? '🚨 ALERT TRIGGERED' : '✅ Normal'}
            </div>
            <div className={styles.alertWidgetVal} style={{ color: c }}>
                {value !== undefined ? `${num.toFixed(1)}${widget.unit}` : '—'}
            </div>
            <div className={styles.alertWidgetThresh}>Threshold: {widget.max}{widget.unit}</div>
        </div>
    )
}

// ── PWM Widget ────────────────────────────────────────────────
function PWMWidget({ widget, value }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_${widget.variable}`
    const log = commandLog[logKey]
    const min = 0; const max = widget.max ?? 255
    const cur = log?.value !== undefined ? parseFloat(log.value) : (value !== undefined ? parseFloat(value) : 0)
    const [local, setLocal] = useState(cur)
    const pct = Math.round((local / max) * 100)
    const onRelease = e => sendCommand(widget.deviceId, widget.variable, parseFloat(e.target.value))
    const c = widget.color
    return (
        <div className={styles.sliderInner}>
            <div className={styles.sliderTop}>
                <span className={styles.sliderVal} style={{ color: c }}>{local} / {max}</span>
                <span style={{ fontSize: '.7rem', color: '#888' }}>{pct}% duty</span>
                {log && <span className={styles.cmdStatus}>{log.delivered === null ? '⏳' : log.delivered ? '📡' : '⚠️'}</span>}
            </div>
            <div className={styles.sliderTrackWrap}>
                <div className={styles.sliderFill} style={{ width: `${pct}%`, background: c }} />
                <input type="range" min={0} max={max} step={1} value={local}
                    onChange={e => setLocal(parseFloat(e.target.value))}
                    onMouseUp={onRelease} onTouchEnd={onRelease}
                    className={styles.sliderInput}
                    style={{ '--thumb-color': c }} />
            </div>
            <div className={styles.sliderRange}><span>0</span><span>{max} (full)</span></div>
        </div>
    )
}

// ── Color Picker Widget ───────────────────────────────────────
function ColorPickerWidget({ widget }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_r`
    const log = commandLog[logKey]
    const [hex, setHex] = useState('var(--accent-orange)')
    const send = () => {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        sendCommand(widget.deviceId, `${widget.variable || 'color'}_r`, r)
        sendCommand(widget.deviceId, `${widget.variable || 'color'}_g`, g)
        sendCommand(widget.deviceId, `${widget.variable || 'color'}_b`, b)
    }
    const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16)
    return (
        <div className={styles.colorPickInner}>
            <div className={styles.colorSwatch} style={{ background: hex, boxShadow: `0 0 20px ${hex}60` }} />
            <div className={styles.colorInfo}>
                <div className={styles.colorRgb}>
                    R:<span style={{ color: 'var(--accent-red)' }}> {r}</span>  G:<span style={{ color: 'var(--accent-green)' }}> {g}</span>  B:<span style={{ color: 'var(--accent-blue)' }}> {b}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input type="color" value={hex} onChange={e => setHex(e.target.value)} className={styles.colorInput} />
                    <button onClick={send} className={styles.colorSendBtn} style={{ background: widget.color }}>Send RGB →</button>
                </div>
                {log && <div className={styles.cmdStatus} style={{ marginTop: 4 }}>{log.delivered === null ? '⏳ Sending…' : log.delivered ? '📡 Sent' : '⚠️ Offline'}</div>}
            </div>
        </div>
    )
}

// ── Momentary Widget ──────────────────────────────────────────
function MomentaryWidget({ widget }) {
    const { sendCommand, commandLog } = useApp()
    const logKey = `${widget.deviceId}_${widget.variable}`
    const log = commandLog[logKey]
    const [held, setHeld] = useState(false)
    const onDown = () => { setHeld(true); sendCommand(widget.deviceId, widget.variable, widget.onValue ?? 'true') }
    const onUp = () => { setHeld(false); sendCommand(widget.deviceId, widget.variable, 'false') }
    const c = widget.color
    return (
        <div className={styles.momentaryInner}>
            <button
                className={`${styles.momentaryBtn} ${held ? styles.momentaryHeld : ''}`}
                style={{ '--mbtn-color': c, borderColor: c, color: held ? '#0d1020' : c, background: held ? c : `rgba(108,99,255,.05)` }}
                onMouseDown={onDown} onMouseUp={onUp} onMouseLeave={onUp}
                onTouchStart={onDown} onTouchEnd={onUp}
            >
                {held ? '⏺ ACTIVE' : `HOLD → ${widget.btnLabel || widget.variable}`}
            </button>
            <div className={styles.toggleHint}>Hold for ON · Release for OFF</div>
            {log && <div className={styles.cmdStatus}>{log.delivered === null ? '⏳' : log.delivered ? '📡 Sent' : '⚠️ Offline'}</div>}
        </div>
    )
}

// ── Widget Card (wrapper) ─────────────────────────────────────
function WidgetCard({ widget, onRemove }) {
    const { liveData, projectDevices } = useApp()
    const MULTI_TYPES = ['compare', 'table']
    const CONTROL_TYPES = ['toggle', 'slider', 'button', 'numberinput', 'pwm', 'colorpicker', 'momentary']
    const isMulti = MULTI_TYPES.includes(widget.type)
    const isControl = CONTROL_TYPES.includes(widget.type)

    const device = isMulti ? null : projectDevices.find(d => d.id === widget.deviceId)
    const deviceData = liveData[widget.deviceId] || {}
    const value = deviceData[widget.variable]
    const hasData = isMulti || value !== undefined

    const renderBody = () => {
        switch (widget.type) {
            case 'value': return <div className={styles.valueDisplay} style={{ color: widget.color }}>{value}{widget.unit}</div>
            case 'gauge': return <GaugeWidget widget={widget} value={value} />
            case 'chart': return <ChartWidget widget={widget} />
            case 'compare': return <CompareChartWidget widget={widget} />
            case 'stat': return <StatWidget widget={widget} />
            case 'led': return <LEDWidget widget={widget} value={value} />
            case 'thermometer': return <ThermometerWidget widget={widget} value={value} />
            case 'progressbar': return <ProgressBarWidget widget={widget} value={value} />
            case 'battery': return <BatteryWidget widget={widget} value={value} />
            case 'compass': return <CompassWidget widget={widget} value={value} />
            case 'text': return <TextWidget value={value} />
            case 'table': return <TableWidget widget={widget} />
            case 'speedometer': return <SpeedometerWidget widget={widget} value={value} />
            case 'heatcell': return <HeatCellWidget widget={widget} value={value} />
            case 'alert': return <AlertWidget widget={widget} value={value} />
            case 'toggle': return <ToggleWidget widget={widget} value={value} />
            case 'slider': return <SliderWidget widget={widget} value={value} />
            case 'button': return <ButtonWidget widget={widget} />
            case 'numberinput': return <NumberInputWidget widget={widget} />
            case 'pwm': return <PWMWidget widget={widget} value={value} />
            case 'colorpicker': return <ColorPickerWidget widget={widget} />
            case 'momentary': return <MomentaryWidget widget={widget} />
            default: return <div className={styles.waitingMsg}>Unknown type: {widget.type}</div>
        }
    }

    return (
        <div className={styles.widgetCard} style={{ '--wcolor': widget.color }}>
            <div className={styles.widgetTop}>
                <div className={styles.widgetMeta}>
                    <div className={styles.widgetLabel} style={{ color: widget.color }}>{widget.label}</div>
                    {widget.unit && !isMulti && <div className={styles.widgetUnit}>{widget.unit}</div>}
                    {isControl && <div className={styles.controlChip}>🎮 CONTROL</div>}
                </div>
                <div className={styles.widgetActions}>
                    {!isMulti && device && (
                        <span className={`${styles.devBadge} ${device.status === 'online' ? styles.online : device.status === 'waiting' ? styles.waiting : styles.offline}`}>
                            ● {device.status}
                        </span>
                    )}
                    <button className={styles.removeBtn} onClick={onRemove} title="Remove widget">✕</button>
                </div>
            </div>

            {/* Body */}
            {!isMulti && !isControl && !device ? (
                <div className={styles.waitingMsg}>⚠️ Device not found</div>
            ) : !isMulti && !isControl && !hasData ? (
                <div className={styles.waitingMsg}>
                    <div className={styles.pulsingDot} style={{ background: widget.color }} />
                    Waiting for ESP32 data…
                    <div className={styles.varHint}>Expected key: <code>{widget.variable}</code></div>
                </div>
            ) : renderBody()}

            {/* Footer */}
            <div className={styles.widgetFooter}>
                {isMulti ? (
                    <div className={styles.seriesChips}>
                        {(widget.series || []).map((s, i) => (
                            <span key={i} className={styles.seriesChip}
                                style={{ background: s.color + '22', color: s.color, border: `1px solid ${s.color}44` }}>
                                {s.label || s.variable}
                            </span>
                        ))}
                    </div>
                ) : (
                    <>
                        <span className={styles.widgetDev}>{device?.name || 'Unknown device'}</span>
                        <span className={styles.widgetVar}>var: <code>{widget.variable}</code></span>
                    </>
                )}
            </div>
        </div>
    )
}

// ── Simulate Modal ────────────────────────────────────────────
function SimulateModal({ devices, onClose, onSimulate }) {
    const [deviceId, setDeviceId] = useState(devices[0]?.id || '')
    const [json, setJson] = useState('{\n  "temperature": 25.4,\n  "humidity": 60\n}')
    const [error, setError] = useState('')

    const submit = () => {
        try {
            const data = JSON.parse(json)
            onSimulate(deviceId, data)
            onClose()
        } catch (e) {
            setError('Invalid JSON: ' + e.message)
        }
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.simModal} onClick={e => e.stopPropagation()}>
                <div className={styles.simHeader}>
                    <span>📟 Simulate ESP32 Data</span>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className={styles.simBody}>
                    <div className={styles.simField}>
                        <label>Device</label>
                        <select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className={styles.simField}>
                        <label>JSON Payload (must match your widget variable names)</label>
                        <textarea value={json} onChange={e => { setJson(e.target.value); setError('') }} rows={6} />
                        {error && <span className={styles.simError}>{error}</span>}
                    </div>
                    <div className={styles.simFooter}>
                        <button className={styles.simCancel} onClick={onClose}>Cancel</button>
                        <button className={styles.simSend} onClick={submit}>Send Data →</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main Dashboard Page ───────────────────────────────────────
export default function DashboardPage() {
    const { currentProject, projectWidgets, projectDevices, removeWidget, simulateDeviceData, SERVER_HTTP } = useApp()
    const [showAddWidget, setShowAddWidget] = useState(false)
    const [showSimulate, setShowSimulate] = useState(false)

    const onlineCount = projectDevices.filter(d => d.status === 'online').length
    const waitingCount = projectDevices.filter(d => d.status === 'waiting').length

    return (
        <div className={styles.page}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>{currentProject?.name || 'Dashboard'}</h2>
                    <p className={styles.pageSub}>
                        {projectDevices.length} device{projectDevices.length !== 1 ? 's' : ''} registered
                        {onlineCount > 0 && ` · ${onlineCount} online`}
                        {waitingCount > 0 && ` · ${waitingCount} waiting`}
                    </p>
                </div>
                <div className={styles.headerBtns}>
                    {/* Download Library */}
                    <a href={`${SERVER_HTTP}/download/library`}
                        className={styles.btnDownload}
                        download="EnthutechIoT.zip"
                        title="Download Arduino Library ZIP">
                        ⬇ Arduino Library
                    </a>
                    {projectDevices.length > 0 && (
                        <button className={styles.btnSim} onClick={() => setShowSimulate(true)}>
                            📟 Simulate Data
                        </button>
                    )}
                    <button className={styles.btnAdd} onClick={() => setShowAddWidget(true)}>
                        ＋ Add Widget
                    </button>
                </div>
            </div>

            {/* Stats row */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>🗂️</span>
                    <div><div className={styles.statVal}>{currentProject?.name}</div><div className={styles.statKey}>Active Project</div></div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>📡</span>
                    <div><div className={styles.statVal}>{projectDevices.length}</div><div className={styles.statKey}>Devices</div></div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>🟢</span>
                    <div><div className={styles.statVal}>{onlineCount}</div><div className={styles.statKey}>Online</div></div>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statIcon}>🧩</span>
                    <div><div className={styles.statVal}>{projectWidgets.length}</div><div className={styles.statKey}>Widgets</div></div>
                </div>
            </div>

            {/* Widget Grid or Empty State */}
            {projectWidgets.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🧩</div>
                    <h3>No widgets yet</h3>
                    <p>Add widgets to visualize and control your ESP32 devices.<br />Sensor widgets read data. Control widgets send commands.</p>
                    <button className={styles.btnAdd} onClick={() => setShowAddWidget(true)}>＋ Add Your First Widget</button>
                    {projectDevices.length === 0 && (
                        <p className={styles.emptyHintSub}>
                            💡 You also need to <a href="/dashboard/devices">add a device</a> first to get an API key.
                        </p>
                    )}
                </div>
            ) : (
                <div className={styles.widgetGrid}>
                    {projectWidgets.map(w => (
                        <WidgetCard key={w.id} widget={w} onRemove={() => removeWidget(w.id)} />
                    ))}
                    {/* Add more widget button */}
                    <button className={styles.addWidgetPlaceholder} onClick={() => setShowAddWidget(true)}>
                        <span>＋</span>
                        <span>Add Widget</span>
                    </button>
                </div>
            )}

            {showAddWidget && <AddWidgetModal onClose={() => setShowAddWidget(false)} />}
            {showSimulate && projectDevices.length > 0 && (
                <SimulateModal
                    devices={projectDevices}
                    onClose={() => setShowSimulate(false)}
                    onSimulate={simulateDeviceData}
                />
            )}
        </div>
    )
}
