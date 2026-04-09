import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import styles from './SubPage.module.css'

const DEFAULT_ALERTS = [
    { id: 1, icon: '🌡️', title: 'High Temperature Detected', desc: 'Temperature exceeded 35°C on Living Room Sensor. Check ventilation.', time: '2 min ago', level: 'critical' },
    { id: 2, icon: '⚡', title: 'High Power Draw', desc: 'Power consumption above 4.8kW on main circuit. AC unit at peak load.', time: '15 min ago', level: 'warning' },
    { id: 3, icon: '📶', title: 'Device Offline', desc: 'Garden Node has not sent data for 30 minutes.', time: '30 min ago', level: 'warning' },
    { id: 4, icon: '💧', title: 'Low Humidity', desc: 'Bedroom humidity dropped below 30%. Consider using a humidifier.', time: '1 hour ago', level: 'info' },
]

export default function AlertsPage() {
    const { currentProject, projectAlerts, projectDevices, dismissAlert, clearAlerts } = useApp()
    const [filter, setFilter] = useState('all')

    const alerts = projectAlerts.length > 0 ? projectAlerts : DEFAULT_ALERTS

    const filteredAlerts = filter === 'all' 
        ? alerts 
        : alerts.filter(a => a.level === filter)

    const getDeviceName = (deviceId) => {
        if (!deviceId) return ''
        const device = projectDevices.find(d => d.id === deviceId)
        return device?.name || 'Unknown Device'
    }

    const getLevelIcon = (level) => {
        switch(level) {
            case 'critical': return '🔴'
            case 'warning': return '🟡'
            case 'info': return '🔵'
            default: return '⚪'
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Alerts</h2>
                    <p className={styles.pageSub}>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''} · {currentProject?.name}</p>
                </div>
                <div className={styles.filterGroup}>
                    <button 
                        className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button 
                        className={`${styles.filterBtn} ${filter === 'critical' ? styles.active : ''}`}
                        onClick={() => setFilter('critical')}
                    >
                        🔴 Critical
                    </button>
                    <button 
                        className={`${styles.filterBtn} ${filter === 'warning' ? styles.active : ''}`}
                        onClick={() => setFilter('warning')}
                    >
                        🟡 Warning
                    </button>
                    <button 
                        className={`${styles.filterBtn} ${filter === 'info' ? styles.active : ''}`}
                        onClick={() => setFilter('info')}
                    >
                        🔵 Info
                    </button>
                </div>
            </div>

            {alerts.length > 0 && (
                <div className={styles.alertActions}>
                    <button className={styles.btnSecondary} onClick={clearAlerts}>Clear All</button>
                </div>
            )}

            <div className={styles.alertsList}>
                {filteredAlerts.map(a => (
                    <div key={a.id} className={`${styles.alertCard} ${styles[a.level]}`}>
                        <div className={styles.alertIcon}>
                            {a.icon}
                            <span className={styles.levelBadge} style={{ 
                                background: a.level === 'critical' ? 'var(--accent-red)' : a.level === 'warning' ? 'var(--accent-yellow)' : 'var(--accent-blue)' 
                            }}>
                                {getLevelIcon(a.level)}
                            </span>
                        </div>
                        <div className={styles.alertInfo}>
                            <div className={styles.alertTitle}>
                                {a.title}
                                {a.deviceId && <span className={styles.deviceTag}>{getDeviceName(a.deviceId)}</span>}
                            </div>
                            <div className={styles.alertDesc}>{a.desc}</div>
                            <div className={styles.alertTime}>{a.time}</div>
                        </div>
                        <button className={styles.dismissBtn} onClick={() => dismissAlert(a.id)}>
                            Dismiss
                        </button>
                    </div>
                ))}

                {filteredAlerts.length === 0 && (
                    <div className={styles.empty}>
                        {filter !== 'all' ? `No ${filter} alerts` : '🎉 All clear — no active alerts!'}
                    </div>
                )}
            </div>
        </div>
    )
}
