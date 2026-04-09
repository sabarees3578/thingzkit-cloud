import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './AddWidgetModal.module.css'

// ─────────────────────────────────────────────────────────────
//  WIDGET CATALOGUE
// ─────────────────────────────────────────────────────────────
export const WIDGET_TYPES = [
    // Sensor / Read
    { id: 'value', label: 'Value Card', icon: '🔢', cat: 'sensor', desc: 'Single live reading with large number' },
    { id: 'gauge', label: 'Gauge', icon: '🌡️', cat: 'sensor', desc: 'Semicircular arc with min/max range' },
    { id: 'chart', label: 'Line Chart', icon: '📈', cat: 'sensor', desc: 'Scrolling time-series chart' },
    { id: 'compare', label: 'Compare Chart', icon: '📊', cat: 'sensor', desc: 'Bar or line chart across variables', multi: true },
    { id: 'stat', label: 'Stat Block', icon: '📉', cat: 'sensor', desc: 'Min / Avg / Max summary' },
    { id: 'thermometer', label: 'Thermometer', icon: '🌡️', cat: 'sensor', desc: 'Vertical fill bar like a thermometer' },
    { id: 'progressbar', label: 'Progress Bar', icon: '▓', cat: 'sensor', desc: 'Horizontal fill 0 → max' },
    { id: 'led', label: 'LED Status', icon: '💡', cat: 'sensor', desc: 'Dot turns green when truthy' },
    { id: 'battery', label: 'Battery Level', icon: '🔋', cat: 'sensor', desc: 'Battery icon fills by 0–100 %' },
    { id: 'compass', label: 'Compass', icon: '🧭', cat: 'sensor', desc: 'Rotating needle for 0–360 ° data' },
    { id: 'text', label: 'Text Display', icon: '📝', cat: 'sensor', desc: 'Show raw string from ESP32' },
    { id: 'table', label: 'Data Table', icon: '📋', cat: 'multi', desc: 'Key/value table for multiple vars', multi: true },
    { id: 'speedometer', label: 'Speedometer', icon: '🏎️', cat: 'sensor', desc: 'Full-circle gauge with needle' },
    { id: 'heatcell', label: 'Heat Cell', icon: '🌈', cat: 'sensor', desc: 'Background shifts green→red by value' },
    { id: 'alert', label: 'Alert / Alarm', icon: '🚨', cat: 'sensor', desc: 'Flashes when value crosses threshold' },
    // Control / Write
    { id: 'toggle', label: 'Toggle', icon: '🔘', cat: 'control', desc: 'ON/OFF — sends true / false' },
    { id: 'slider', label: 'Slider', icon: '🎚️', cat: 'control', desc: 'Range slider sends a number live' },
    { id: 'button', label: 'Push Button', icon: '🔲', cat: 'control', desc: 'Send any value on click' },
    { id: 'numberinput', label: 'Number Input', icon: '🔢', cat: 'control', desc: 'Type a number, press Enter to send' },
    { id: 'pwm', label: 'PWM Control', icon: '⚡', cat: 'control', desc: '0–255 PWM slider with duty display' },
    { id: 'colorpicker', label: 'Color Command', icon: '🎨', cat: 'control', desc: 'Sends R, G, B to ESP32' },
    { id: 'momentary', label: 'Momentary Hold', icon: '⏯️', cat: 'control', desc: 'ON while held, OFF on release' },
]

const COLORS = ['var(--accent-purple)', 'var(--accent-green)', 'var(--accent-blue)', 'var(--accent-orange)', 'var(--accent-red)', 'var(--accent-yellow)', '#FF6CE5', '#A8FF78', '#FF9F43', '#54A0FF']

// ─────────────────────────────────────────────────────────────
//  LIVE WIDGET PREVIEW
// ─────────────────────────────────────────────────────────────
function WidgetPreview({ type, config, color, series }) {
    const c = color || 'var(--accent-purple)'
    const lbl = config.label || 'Widget'
    const unit = config.unit || ''
    const min = parseFloat(config.min) || 0
    const max = parseFloat(config.max) || 100
    const pct = 0.62
    const val = +(min + (max - min) * pct).toFixed(1)

    const wrap = { background: '#0D1020', borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', padding: '14px 16px', minHeight: 110, display: 'flex', flexDirection: 'column', gap: 8 }
    const hdr = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.78rem', fontWeight: 700, color: '#EAEAF4' }
    const sub = { fontSize: '.6rem', color: '#555' }

    switch (type) {
        case 'value': return (
            <div style={{ ...wrap, borderTop: `3px solid ${c}` }}>
                <div style={hdr}><span>{lbl}</span><span style={sub}>{unit}</span></div>
                <div style={{ fontSize: '2.6rem', fontWeight: 900, color: c, textAlign: 'center', letterSpacing: -2, lineHeight: 1 }}>{val}<span style={{ fontSize: '.9rem' }}>{unit}</span></div>
            </div>
        )
        case 'gauge': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <svg width="130" height="75" viewBox="0 0 130 75">
                        <path d="M15 70 A50 50 0 0 1 115 70" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="12" strokeLinecap="round" />
                        <path d="M15 70 A50 50 0 0 1 115 70" fill="none" stroke={c} strokeWidth="12" strokeLinecap="round"
                            strokeDasharray={`${pct * 157} 157`} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />
                        <text x="65" y="65" textAnchor="middle" fill={c} fontSize="15" fontWeight="bold">{val}{unit}</text>
                    </svg>
                    <span style={sub}>{min} – {max}{unit}</span>
                </div>
            </div>
        )
        case 'chart': {
            const pts = [32, 48, 41, 58, 52, 68, 61, 70, 65, 73].map((v, i) => `${i * 15},${85 - v}`)
            return (
                <div style={wrap}>
                    <div style={hdr}><span>{lbl}</span><span style={{ color: c, fontWeight: 800 }}>{val}{unit}</span></div>
                    <svg width="100%" height="70" viewBox="0 0 135 85" preserveAspectRatio="none">
                        <defs><linearGradient id="lgc" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={c} stopOpacity=".3" /><stop offset="100%" stopColor={c} stopOpacity="0" /></linearGradient></defs>
                        <polyline points={pts.join(' ')} fill="none" stroke={c} strokeWidth="2.5" strokeLinejoin="round" />
                        <polygon points={`0,85 ${pts.join(' ')} 135,85`} fill="url(#lgc)" />
                    </svg>
                </div>
            )
        }
        case 'compare': {
            const s = series?.slice(0, 4) || [{ color: 'var(--accent-purple)', label: 'A' }, { color: 'var(--accent-green)', label: 'B' }]
            const vs = [72, 55, 85, 40]
            return (
                <div style={wrap}>
                    <div style={hdr}><span>{lbl || 'Compare'}</span></div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 65, padding: '0 4px' }}>
                        {s.map((sr, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: '100%', height: `${vs[i] || 50}%`, background: sr.color || COLORS[i], borderRadius: '5px 5px 0 0', boxShadow: `0 0 10px ${sr.color || COLORS[i]}55` }} />
                                <span style={{ fontSize: '.55rem', color: '#888' }}>{sr.label || `V${i + 1}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        }
        case 'stat': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[['MIN', '18.2'], ['AVG', '26.4'], ['MAX', '34.8']].map(([k, v]) => (
                        <div key={k} style={{ textAlign: 'center', padding: '6px 0', background: 'rgba(255,255,255,.03)', borderRadius: 7 }}>
                            <div style={{ fontSize: '.56rem', color: '#555', textTransform: 'uppercase', letterSpacing: .5 }}>{k}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: c }}>{v}{unit}</div>
                        </div>
                    ))}
                </div>
            </div>
        )
        case 'thermometer': return (
            <div style={{ ...wrap, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <svg width="40" height="100" viewBox="0 0 40 100">
                    <rect x="15" y="5" width="10" height="75" rx="5" fill="rgba(255,255,255,.07)" />
                    <rect x="15" y={5 + (1 - pct) * 75} width="10" height={pct * 75} rx="5" fill={c} style={{ filter: `drop-shadow(0 0 4px ${c})` }} />
                    <circle cx="20" cy="85" r="12" fill={c} style={{ filter: `drop-shadow(0 0 8px ${c})` }} />
                    <circle cx="20" cy="85" r="7" fill="rgba(255,255,255,.3)" />
                </svg>
                <div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: c }}>{val}<span style={{ fontSize: '.8rem' }}>{unit}</span></div>
                    <div style={sub}>{lbl}</div>
                </div>
            </div>
        )
        case 'progressbar': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span><span style={{ color: c, fontWeight: 800 }}>{val}{unit}</span></div>
                <div style={{ height: 20, borderRadius: 10, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${pct * 100}%`, background: `linear-gradient(90deg,${c}88,${c})`, borderRadius: 10, boxShadow: `0 0 10px ${c}60` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...sub }}><span>{min}</span><span>{max}{unit}</span></div>
            </div>
        )
        case 'led': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: c, boxShadow: `0 0 16px ${c}` }} />
                    <div><div style={{ fontWeight: 700, color: c }}>ACTIVE</div><div style={sub}>var: {config.variable || 'status'}</div></div>
                </div>
            </div>
        )
        case 'battery': {
            const bp = Math.round(pct * 100)
            const bc = bp > 60 ? 'var(--accent-green)' : bp > 25 ? 'var(--accent-yellow)' : 'var(--accent-red)'
            return (
                <div style={wrap}>
                    <div style={hdr}><span>{lbl}</span><span style={{ color: bc, fontWeight: 800 }}>{bp}%</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <div style={{ flex: 1, height: 24, border: `2px solid rgba(255,255,255,.15)`, borderRadius: 5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${bp}%`, background: bc, boxShadow: `0 0 8px ${bc}60` }} />
                        </div>
                        <div style={{ width: 4, height: 12, borderRadius: '0 3px 3px 0', background: 'rgba(255,255,255,.2)' }} />
                    </div>
                </div>
            )
        }
        case 'compass': {
            const angle = 135
            const nx = 50 + 30 * Math.sin(angle * Math.PI / 180)
            const ny = 50 - 30 * Math.cos(angle * Math.PI / 180)
            return (
                <div style={wrap}>
                    <div style={hdr}><span>{lbl}</span><span style={{ color: c }}>{angle}°</span></div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <svg width="90" height="90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="2" />
                            {['N', 'E', 'S', 'W'].map((d, i) => { const a = i * 90; return (<text key={d} x={50 + 38 * Math.sin(a * Math.PI / 180)} y={50 - 38 * Math.cos(a * Math.PI / 180) + 4} textAnchor="middle" fill="#444" fontSize="9" fontWeight="bold">{d}</text>) })}
                            <line x1="50" y1="50" x2={nx} y2={ny} stroke={c} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${c})` }} />
                            <circle cx="50" cy="50" r="4" fill={c} />
                        </svg>
                    </div>
                </div>
            )
        }
        case 'text': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#EAEAF4', background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '9px 12px', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,.08)' }}>
                    "Hello from ESP32 ✓"
                </div>
            </div>
        )
        case 'table': return (
            <div style={wrap}>
                <div style={hdr}><span>Live Data</span></div>
                {[['temperature', '26.4 °C'], ['humidity', '61 %'], ['status', 'ok']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: '.78rem' }}>
                        <code style={{ color: 'var(--accent-purple)', fontSize: '.72rem' }}>{k}</code>
                        <span style={{ color: '#EAEAF4', fontWeight: 600 }}>{v}</span>
                    </div>
                ))}
            </div>
        )
        case 'speedometer': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <svg width="130" height="80" viewBox="0 0 130 90">
                        <path d="M15 80 A55 55 0 1 1 115 80" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" strokeLinecap="round" />
                        <path d="M15 80 A55 55 0 1 1 115 80" fill="none" stroke={c} strokeWidth="10" strokeLinecap="round"
                            strokeDasharray={`${pct * 235} 235`} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />
                        <line x1="65" y1="80" x2={15 + pct * 100} y2={35 + pct * 10} stroke="#EAEAF4" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="65" cy="80" r="5" fill={c} />
                        <text x="65" y="75" textAnchor="middle" fill={c} fontSize="11" fontWeight="bold">{val}{unit}</text>
                    </svg>
                </div>
            </div>
        )
        case 'heatcell': {
            const ir = Math.round(255 * pct), ig = Math.round(255 * (1 - pct))
            return (
                <div style={{ ...wrap, background: `rgba(${ir},${ig},50,.14)`, border: `2px solid rgba(${ir},${ig},50,.3)` }}>
                    <div style={hdr}><span>{lbl}</span></div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, textAlign: 'center', color: `rgb(${ir},${ig},80)` }}>{val}{unit}</div>
                    <div style={{ fontSize: '.65rem', textAlign: 'center', color: '#888' }}>Threshold: {config.max || 100}</div>
                </div>
            )
        }
        case 'alert': {
            const triggered = pct > 0.8
            return (
                <div style={{ ...wrap, border: `2px solid ${triggered ? 'var(--accent-red)' : 'rgba(255,255,255,.08)'}`, background: triggered ? 'rgba(255,71,87,.08)' : undefined }}>
                    <div style={hdr}><span>{lbl}</span><span style={{ color: triggered ? 'var(--accent-red)' : '#555' }}>{triggered ? '🚨 ALERT' : '✅ Normal'}</span></div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: triggered ? 'var(--accent-red)' : c, textAlign: 'center' }}>{val}{unit}</div>
                    <div style={{ fontSize: '.65rem', color: '#666' }}>Alert above: {config.max || 100}{unit}</div>
                </div>
            )
        }
        case 'toggle': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span><span style={{ fontSize: '.6rem', color: 'var(--accent-green)' }}>🎮 CONTROL</span></div>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                    <div style={{ width: 90, height: 46, borderRadius: 100, background: c, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 5px', boxShadow: `0 0 20px ${c}40` }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff' }} />
                    </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '.65rem', color: '#555' }}>Tap → sends true to ESP32</div>
            </div>
        )
        case 'slider': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span><span style={{ color: c, fontWeight: 900 }}>{val}{unit}</span></div>
                <div style={{ position: 'relative', height: 20, margin: '4px 0' }}>
                    <div style={{ position: 'absolute', inset: '50% 0 50% 0', transform: 'translateY(-50%)', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: 0, width: `${pct * 100}%`, height: 6, borderRadius: 3, background: `linear-gradient(90deg,${c}88,${c})`, transform: 'translateY(-50%)' }} />
                    <div style={{ position: 'absolute', top: '50%', left: `${pct * 100}%`, transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: `0 0 10px ${c}` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', ...sub }}><span>{min}</span><span>{max}{unit}</span></div>
            </div>
        )
        case 'button': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span><span style={{ fontSize: '.6rem', color: 'var(--accent-green)' }}>🎮 CONTROL</span></div>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                    <div style={{ padding: '11px 36px', borderRadius: 12, background: c, color: '#fff', fontWeight: 800, fontSize: '.95rem', cursor: 'pointer', boxShadow: `0 6px 24px ${c}50` }}>
                        {config.btnLabel || 'SEND'}
                    </div>
                </div>
            </div>
        )
        case 'numberinput': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, padding: '9px 12px', color: '#EAEAF4', fontSize: '.95rem', fontWeight: 700 }}>42 {unit}</div>
                    <div style={{ padding: '9px 14px', borderRadius: 8, background: c, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>→</div>
                </div>
            </div>
        )
        case 'pwm': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, position: 'relative', height: 20 }}>
                        <div style={{ position: 'absolute', inset: '50% 0 50% 0', transform: 'translateY(-50%)', height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: 0, width: '60%', height: 6, borderRadius: 3, background: `linear-gradient(90deg,${c}88,${c})`, transform: 'translateY(-50%)' }} />
                        <div style={{ position: 'absolute', top: '50%', left: '60%', transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: c, boxShadow: `0 0 10px ${c}` }} />
                    </div>
                    <div style={{ textAlign: 'center', minWidth: 50 }}>
                        <div style={{ color: c, fontWeight: 900, fontSize: '1rem' }}>153</div>
                        <div style={sub}>/ 255</div>
                        <div style={{ color: '#888', fontSize: '.58rem' }}>60% duty</div>
                    </div>
                </div>
            </div>
        )
        case 'colorpicker': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span><span style={{ fontSize: '.6rem', color: 'var(--accent-green)' }}>🎮 CONTROL</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent-orange)', boxShadow: '0 0 14px var(--accent-orange)60' }} />
                    <div>
                        <div style={{ fontSize: '.72rem', color: '#888' }}>R:<span style={{ color: 'var(--accent-red)' }}> 255</span>  G:<span style={{ color: 'var(--accent-green)' }}> 107</span>  B:<span style={{ color: 'var(--accent-blue)' }}> 53</span></div>
                        <div style={{ fontSize: '.65rem', color: '#555', marginTop: 2 }}>var(--accent-orange) → ESP32</div>
                    </div>
                </div>
            </div>
        )
        case 'momentary': return (
            <div style={wrap}>
                <div style={hdr}><span>{lbl}</span><span style={{ fontSize: '.6rem', color: 'var(--accent-green)' }}>🎮 CONTROL</span></div>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
                    <div style={{ padding: '12px 36px', borderRadius: 12, background: `rgba(108,99,255,.1)`, border: `2px solid ${c}`, color: c, fontWeight: 800, fontSize: '.9rem', cursor: 'pointer' }}>
                        HOLD → {config.btnLabel || config.variable || 'LED'}
                    </div>
                </div>
                <div style={{ textAlign: 'center', fontSize: '.65rem', color: '#555' }}>ON while held / OFF on release</div>
            </div>
        )
        default: return <div style={{ ...wrap, alignItems: 'center', justifyContent: 'center', color: '#555' }}>Preview</div>
    }
}

// ─────────────────────────────────────────────────────────────
//  MODAL
// ─────────────────────────────────────────────────────────────

// Smart variable picker: shows known vars from the device wizard as a dropdown,
// with a fallback text input if the device has none defined.
function VarPicker({ deviceId, value, onChange, onUnitChange, filter, placeholder }) {
    const { projectDevices } = useApp()
    const device = projectDevices.find(d => d.id === deviceId)
    const vars = (device?.variables || []).filter(v => filter ? v.dir === filter : true)

    if (vars.length === 0) {
        // No variables from wizard — free text
        return (
            <input
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || 'variable name'}
            />
        )
    }

    return (
        <select
            value={value}
            onChange={e => {
                const picked = vars.find(v => v.name === e.target.value)
                onChange(e.target.value)
                if (picked?.unit && onUnitChange) onUnitChange(picked.unit)
            }}
        >
            <option value="">— pick variable —</option>
            {vars.map(v => (
                <option key={v.name} value={v.name}>
                    {v.name}  [{v.type}]{v.unit ? `  (${v.unit})` : ''}
                </option>
            ))}
        </select>
    )
}

export default function AddWidgetModal({ onClose }) {
    const { addWidget, projectDevices } = useApp()
    const [selType, setSelType] = useState(WIDGET_TYPES[0])
    const [color, setColor] = useState(COLORS[0])
    const [deviceId, setDeviceId] = useState(projectDevices[0]?.id || '')
    const [chartType, setChartType] = useState('bar')

    const [cfg, setCfg] = useState({
        label: '', variable: '', unit: '', min: '0', max: '100', step: '1', btnLabel: 'SEND', onValue: 'true',
    })
    const set = v => setCfg(p => ({ ...p, ...v }))

    const [series, setSeries] = useState([
        { deviceId: projectDevices[0]?.id || '', variable: 'temperature', label: 'Temperature', color: COLORS[0], unit: '°C' },
        { deviceId: projectDevices[0]?.id || '', variable: 'humidity', label: 'Humidity', color: COLORS[1], unit: '%' },
    ])
    const addSeries = () => setSeries(p => [...p, { deviceId: projectDevices[0]?.id || '', variable: '', label: `Var ${p.length + 1}`, color: COLORS[p.length % COLORS.length], unit: '' }])
    const removeSeries = i => setSeries(p => p.filter((_, x) => x !== i))
    const setSer = (i, k, v) => setSeries(p => p.map((s, x) => x === i ? { ...s, [k]: v } : s))

    const isMulti = !!selType.multi
    const isCtrl = selType.cat === 'control'
    const sp = selType.id
    const hasMinMax = ['gauge', 'progressbar', 'thermometer', 'speedometer', 'heatcell', 'alert', 'slider', 'numberinput', 'pwm'].includes(sp)
    const hasStep = ['slider', 'numberinput', 'pwm'].includes(sp)
    const hasBtn = ['button', 'momentary'].includes(sp)

    const create = () => {
        const base = { type: sp, label: cfg.label || selType.label, color, deviceId: isMulti ? '' : deviceId }
        if (isMulti) {
            addWidget({ ...base, chartType, series })
        } else {
            addWidget({
                ...base,
                variable: cfg.variable || (isCtrl ? 'led' : 'temperature'),
                unit: cfg.unit || '',
                min: parseFloat(cfg.min) || 0,
                max: parseFloat(cfg.max) || 100,
                step: parseFloat(cfg.step) || 1,
                btnLabel: cfg.btnLabel || 'SEND',
                onValue: cfg.onValue || 'true',
            })
        }
        onClose()
    }

    const cats = ['sensor', 'control', 'multi']
    const catLabel = { sensor: '📡 Sensor / Read', control: '🎮 Control / Write', multi: '📋 Multi-Variable' }

    return (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>

                {/* ── Header ─────────────────────────────────────────── */}
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.title}>Add Widget</h2>
                        <p className={styles.sub}>{WIDGET_TYPES.length} widget types · live preview</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.body}>

                    {/* ── LEFT: type list ──────────────────────────────── */}
                    <div className={styles.typePanel}>
                        {cats.map(cat => {
                            const items = WIDGET_TYPES.filter(t => t.cat === cat)
                            if (!items.length) return null
                            return (
                                <div key={cat}>
                                    <div className={styles.catLabel}>{catLabel[cat]}</div>
                                    {items.map(t => (
                                        <button key={t.id}
                                            className={`${styles.typeCard} ${selType.id === t.id ? styles.typeCardActive : ''}`}
                                            onClick={() => { setSelType(t); set({ label: t.label }) }}>
                                            <span className={styles.typeIcon}>{t.icon}</span>
                                            <div className={styles.typeInfo}>
                                                <span className={styles.typeName}>{t.label}</span>
                                                <span className={styles.typeDesc}>{t.desc}</span>
                                            </div>
                                            {t.cat === 'control' && <span className={styles.ctrlBadge}>SEND</span>}
                                        </button>
                                    ))}
                                </div>
                            )
                        })}
                    </div>

                    {/* ── RIGHT: preview + config ───────────────────────── */}
                    <div className={styles.rightPanel}>

                        {/* Live Preview */}
                        <div className={styles.previewWrap}>
                            <div className={styles.previewLabel}>Live Preview — {selType.label}</div>
                            <div className={styles.previewInner}>
                                <WidgetPreview type={selType.id} config={cfg} color={color} series={series} />
                            </div>
                        </div>

                        {/* Config Form */}
                        <div className={styles.form}>

                            {/* ── Basic Info ───────────────────────────── */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Basic Info</div>

                                {/* Label */}
                                <div className={styles.field}>
                                    <label>Widget Label</label>
                                    <input value={cfg.label} onChange={e => set({ label: e.target.value })} placeholder={selType.label} />
                                </div>

                                {/* Device selector — must come BEFORE variable so VarPicker can read vars */}
                                {!isMulti && (
                                    <div className={styles.field}>
                                        <label>Device</label>
                                        {projectDevices.length === 0
                                            ? <div className={styles.noDevice}>⚠️ Add a device first via the Devices panel</div>
                                            : <select value={deviceId} onChange={e => { setDeviceId(e.target.value); set({ variable: '', unit: '' }) }}>
                                                {projectDevices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
                                            </select>
                                        }
                                    </div>
                                )}

                                {/* Variable — smart picker from device wizard vars */}
                                {!isMulti && (
                                    <div className={styles.field}>
                                        <label>{isCtrl ? 'Command Key (Downlink)' : 'Variable Name (Uplink)'}</label>
                                        <VarPicker
                                            deviceId={deviceId}
                                            value={cfg.variable}
                                            onChange={v => set({ variable: v })}
                                            onUnitChange={u => set({ unit: u })}
                                            filter={isCtrl ? 'downlink' : 'uplink'}
                                            placeholder={isCtrl ? 'led / relay / fan' : 'temperature / humidity'}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* ── Range / Scale ────────────────────────── */}
                            {(hasMinMax || (!isMulti && !isCtrl)) && (
                                <div className={styles.section}>
                                    <div className={styles.sectionTitle}>Scale & Units</div>
                                    <div className={hasMinMax ? styles.row4 : styles.row2}>
                                        {!isMulti && !isCtrl && (
                                            <div className={styles.field}>
                                                <label>Unit</label>
                                                <input value={cfg.unit} onChange={e => set({ unit: e.target.value })} placeholder="°C / % / V" />
                                            </div>
                                        )}
                                        {hasMinMax && <>
                                            <div className={styles.field}><label>Min</label><input type="number" value={cfg.min} onChange={e => set({ min: e.target.value })} /></div>
                                            <div className={styles.field}><label>Max</label><input type="number" value={cfg.max} onChange={e => set({ max: e.target.value })} /></div>
                                        </>}
                                        {hasStep && <div className={styles.field}><label>Step</label><input type="number" value={cfg.step} onChange={e => set({ step: e.target.value })} /></div>}
                                    </div>
                                </div>
                            )}

                            {/* ── Button config ────────────────────────── */}
                            {hasBtn && (
                                <div className={styles.section}>
                                    <div className={styles.sectionTitle}>Button Config</div>
                                    <div className={styles.row2}>
                                        <div className={styles.field}><label>Button Label</label><input value={cfg.btnLabel} onChange={e => set({ btnLabel: e.target.value })} placeholder="SEND" /></div>
                                        <div className={styles.field}><label>Value on Press</label><input value={cfg.onValue} onChange={e => set({ onValue: e.target.value })} placeholder="true / 1 / ON" /></div>
                                    </div>
                                </div>
                            )}

                            {/* ── Multi-variable (Compare / Table) ─────── */}
                            {isMulti && (
                                <div className={styles.section}>
                                    <div className={styles.sectionTitle}>Variables</div>

                                    {/* Chart type toggle — only for Compare */}
                                    {sp === 'compare' && (
                                        <div className={styles.field}>
                                            <label>Chart Type</label>
                                            <div className={styles.btnRow}>
                                                {['bar', 'line'].map(ct => (
                                                    <button key={ct}
                                                        className={`${styles.pickBtn} ${chartType === ct ? styles.pickBtnOn : ''}`}
                                                        onClick={() => setChartType(ct)}>
                                                        {ct === 'bar' ? '📊 Bar' : '📈 Line'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Series header */}
                                    <div className={styles.seriesHdr}>
                                        <span className={styles.seriesHdrLabel}>Series ({series.length})</span>
                                        <button className={styles.addSerBtn} onClick={addSeries}>＋ Add Variable</button>
                                    </div>

                                    {/* Series cards */}
                                    {series.length === 0 && (
                                        <div className={styles.seriesEmpty}>No variables yet — click Add Variable above</div>
                                    )}
                                    {series.map((s, i) => (
                                        <div key={i} className={styles.serCard}>
                                            {/* Top row: badge + label input + remove */}
                                            <div className={styles.serCardTop}>
                                                <div className={styles.serBadge} style={{ background: s.color }}>{i + 1}</div>
                                                <input
                                                    value={s.label}
                                                    onChange={e => setSer(i, 'label', e.target.value)}
                                                    placeholder={`Series ${i + 1} label`}
                                                    className={styles.serInput}
                                                    style={{ flex: 1 }}
                                                />
                                                <input
                                                    type="color"
                                                    value={s.color}
                                                    onChange={e => setSer(i, 'color', e.target.value)}
                                                    className={styles.serColorBtn}
                                                    title="Pick color"
                                                />
                                                {series.length > 1 && (
                                                    <button className={styles.remSerBtn} onClick={() => removeSeries(i)} title="Remove">✕</button>
                                                )}
                                            </div>
                                            {/* Bottom row: device, variable, unit */}
                                            <div className={styles.serCardBot}>
                                                <div className={styles.field} style={{ margin: 0 }}>
                                                    <label>Device</label>
                                                    <select value={s.deviceId} onChange={e => {
                                                        setSer(i, 'deviceId', e.target.value)
                                                        setSer(i, 'variable', '')
                                                        setSer(i, 'unit', '')
                                                    }} className={styles.serSel}>
                                                        {projectDevices.length === 0
                                                            ? <option value="">— no devices —</option>
                                                            : projectDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                                        }
                                                    </select>
                                                </div>
                                                <div className={styles.field} style={{ margin: 0 }}>
                                                    <label>Variable</label>
                                                    <VarPicker
                                                        deviceId={s.deviceId}
                                                        value={s.variable}
                                                        onChange={v => {
                                                            const dev = projectDevices.find(d => d.id === s.deviceId)
                                                            const found = (dev?.variables || []).find(x => x.name === v)
                                                            setSer(i, 'variable', v)
                                                            if (found?.unit) setSer(i, 'unit', found.unit)
                                                        }}
                                                        placeholder="temperature"
                                                    />
                                                </div>
                                                <div className={styles.field} style={{ margin: 0 }}>
                                                    <label>Unit</label>
                                                    <input value={s.unit} onChange={e => setSer(i, 'unit', e.target.value)} placeholder="°C" className={styles.serInput} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── Accent Color ─────────────────────────── */}
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Accent Color</div>
                                <div className={styles.colorRow}>
                                    {COLORS.map(c => (
                                        <button key={c}
                                            className={`${styles.dot} ${color === c ? styles.dotOn : ''}`}
                                            style={{ background: c }}
                                            onClick={() => setColor(c)} />
                                    ))}
                                    <input type="color" value={color} onChange={e => setColor(e.target.value)}
                                        className={styles.dotCustom} title="Custom color" />
                                </div>
                            </div>

                        </div>{/* /form */}

                        {/* ── Footer ─────────────────────────────────── */}
                        <div className={styles.footer}>
                            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                            <button className={styles.createBtn} onClick={create}
                                disabled={!isMulti && projectDevices.length === 0}>
                                ＋ Add {selType.label}
                            </button>
                        </div>

                    </div>{/* /rightPanel */}
                </div>{/* /body */}
            </div>
        </div>
    )
}
