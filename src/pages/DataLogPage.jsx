import { useApp } from '../context/AppContext.jsx'
import styles from './SubPage.module.css'

function genRows(devices, n = 25) {
    if (devices.length === 0) return []
    const now = Date.now()
    return Array.from({ length: n }, (_, i) => {
        const d = devices[Math.floor(Math.random() * devices.length)]
        const t = new Date(now - i * 5 * 60000)
        return {
            device: d.name,
            time: t.toLocaleTimeString(),
            date: t.toLocaleDateString(),
            location: d.location || '—',
            protocol: d.protocol?.toUpperCase() || 'HTTP',
            status: d.status,
            payload: `{ "temperature": ${(22 + Math.random() * 10).toFixed(1)}, "humidity": ${Math.round(45 + Math.random() * 30)} }`,
        }
    })
}

export default function DataLogPage() {
    const { projectDevices, currentProject } = useApp()
    const rows = genRows(projectDevices)

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Data Log</h2>
                    <p className={styles.pageSub}>Recent inbound payloads · {currentProject?.name}</p>
                </div>
                <button className={styles.btnPrimary}>⬇ Export CSV</button>
            </div>

            {projectDevices.length === 0 ? (
                <div className={styles.emptyFull}>
                    <div className={styles.emptyIcon}>📋</div>
                    <h3>No data yet</h3>
                    <p>Add a device and start sending data from your ESP32.<br />All incoming payloads will appear here.</p>
                </div>
            ) : (
                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Device</th>
                                <th>Time</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th>Protocol</th>
                                <th>Payload</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.device}</td>
                                    <td>{r.time}</td>
                                    <td>{r.date}</td>
                                    <td>{r.location}</td>
                                    <td><code style={{ fontSize: '.7rem', color: 'var(--accent-purple)' }}>{r.protocol}</code></td>
                                    <td><code style={{ fontSize: '.68rem', color: 'var(--accent-green)' }}>{r.payload}</code></td>
                                    <td>
                                        <span className={`${styles.online}`} style={{ fontSize: '.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: 'rgba(0,229,160,.12)', color: 'var(--accent-green)' }}>
                                            ● received
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
