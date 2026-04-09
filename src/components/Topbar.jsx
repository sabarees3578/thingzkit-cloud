import { useEffect, useState, useRef } from 'react'
import { useApp } from '../context/AppContext.jsx'
import styles from './Topbar.module.css'

const NOTIFICATIONS = [
    { id: 1, icon: '🌡️', iconCls: 'temp', text: 'Temperature exceeded <strong>35°C</strong> on Node-3', time: '2 min ago', unread: true },
    { id: 2, icon: '⚡', iconCls: 'power', text: 'High power draw detected on <strong>AC Unit</strong>', time: '15 min ago', unread: true },
    { id: 3, icon: '✅', iconCls: 'ok', text: '<strong>Garage Sensor</strong> came back online', time: '1 hour ago', unread: false },
]

export default function Topbar({ title, projectName, onMenuClick, notifOpen, onNotifToggle, onNotifClose }) {
    const [clock, setClock] = useState('')
    const [notifications, setNotifications] = useState(NOTIFICATIONS)
    const panelRef = useRef(null)
    const { wsStatus, theme, toggleTheme } = useApp()

    useEffect(() => {
        const tick = () => {
            const now = new Date()
            let h = now.getHours(), m = now.getMinutes()
            const ap = h >= 12 ? 'PM' : 'AM'
            h = h % 12 || 12
            setClock(`${h}:${String(m).padStart(2, '0')} ${ap}`)
        }
        tick()
        const t = setInterval(tick, 1000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onNotifClose()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [onNotifClose])

    const unreadCount = notifications.filter(n => n.unread).length

    const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))

    return (
        <header className={styles.topbar}>
            <div className={styles.left}>
                <button className={styles.menuBtn} onClick={onMenuClick}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <div className={styles.breadcrumb}>
                    <span className={styles.bcMain}>{title}</span>
                    <span className={styles.bcSep}>/</span>
                    <span className={styles.bcSub}>{projectName || 'Smart Home Hub'}</span>
                </div>
            </div>

            <div className={styles.right} ref={panelRef}>
                {/* WS Status Pill */}
                <div className={`${styles.wsPill} ${styles[wsStatus]}`} title={`Backend server: ${wsStatus}`}>
                    <span className={styles.wsDot} />
                    {wsStatus === 'connected' ? 'Server Live' : wsStatus === 'connecting' ? 'Connecting…' : 'Server Offline'}
                </div>
                <span className={styles.clock}>{clock}</span>

                {/* Theme Toggle */}
                <button
                    className={styles.iconBtn}
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    style={{ fontSize: '1.1rem' }}
                >
                    {theme === 'dark' ? '☀️' : '🌙'}
                </button>

                <div className={styles.notifWrap}>
                    <button className={styles.iconBtn} onClick={onNotifToggle}>
                        🔔
                        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                    </button>

                    {notifOpen && (
                        <div className={styles.notifPanel}>
                            <div className={styles.notifHeader}>
                                <span>Notifications</span>
                                <button onClick={markAllRead}>Mark all read</button>
                            </div>
                            {notifications.map(n => (
                                <div key={n.id} className={`${styles.notifItem} ${n.unread ? styles.unread : ''}`}>
                                    <div className={`${styles.notifIcon} ${styles[n.iconCls]}`}>{n.icon}</div>
                                    <div className={styles.notifContent}>
                                        <p dangerouslySetInnerHTML={{ __html: n.text }} />
                                        <span>{n.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.userAvatar}>JD</div>
            </div>
        </header>
    )
}
