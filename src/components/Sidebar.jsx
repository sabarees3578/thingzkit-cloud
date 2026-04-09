import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import NewProjectModal from './modals/NewProjectModal.jsx'
import styles from './Sidebar.module.css'

const NAV = [
    { to: '/dashboard', label: 'Dashboard', icon: '▦', badge: 'LIVE', end: true },
    { to: '/dashboard/devices', label: 'Devices', icon: '📡' },
    { to: '/dashboard/analytics', label: 'Analytics', icon: '📊' },
    { to: '/dashboard/automations', label: 'Automations', icon: '⚡' },
    { to: '/dashboard/alerts', label: 'Alerts', icon: '🔔' },
    { to: '/dashboard/datalog', label: 'Data Log', icon: '📈' },
    { to: '/dashboard/team', label: 'Team', icon: '👥' },
    { to: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar({ open, onClose }) {
    const { projects, currentProject, currentProjectId, setCurrentProjectId, projectDevices } = useApp()
    const { logout } = useAuth()
    const navigate = useNavigate()
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [showNewProject, setShowNewProject] = useState(false)

    const onlineCount = projectDevices.filter(d => d.status === 'online').length

    const selectProject = (id) => {
        setCurrentProjectId(id)
        setDropdownOpen(false)
    }

    return (
        <>
            <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
                {/* Brand Header */}
                <div className={styles.header}>
                    <div className={styles.brand}>
                        <div className={styles.logoIcon}>
                            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                                <circle cx="16" cy="16" r="6" fill="#fff" />
                                <circle cx="16" cy="4" r="2.5" fill="#fff" opacity="0.7" />
                                <circle cx="28" cy="10" r="2.5" fill="#fff" opacity="0.7" />
                                <circle cx="28" cy="22" r="2.5" fill="#fff" opacity="0.7" />
                                <circle cx="16" cy="28" r="2.5" fill="#fff" opacity="0.7" />
                                <circle cx="4" cy="22" r="2.5" fill="#fff" opacity="0.7" />
                                <circle cx="4" cy="10" r="2.5" fill="#fff" opacity="0.7" />
                            </svg>
                        </div>
                        <div>
                            <span className={styles.brandName}>Enthu<span>Tech</span></span>
                            <span className={styles.brandTagline}>IoT Platform</span>
                        </div>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                {/* ── Project Dropdown ── */}
                <div className={styles.projectSection}>
                    <span className={styles.sectionLabel}>Current Project</span>
                    <div className={styles.projectDropdown}>
                        <button
                            className={styles.projectTrigger}
                            onClick={() => setDropdownOpen(v => !v)}
                        >
                            <div className={styles.projectIcon}>{currentProject?.name?.[0] || '?'}</div>
                            <div className={styles.projectInfo}>
                                <span className={styles.projectName}>{currentProject?.name || 'No Project'}</span>
                                <span className={styles.projectMeta}>{projectDevices.length} devices · {onlineCount} online</span>
                            </div>
                            <span className={`${styles.chevron} ${dropdownOpen ? styles.open : ''}`}>▾</span>
                        </button>

                        {dropdownOpen && (
                            <div className={styles.dropdown}>
                                <div className={styles.dropdownHeader}>Switch Project</div>
                                {projects.map(p => (
                                    <button
                                        key={p.id}
                                        className={`${styles.dropdownItem} ${p.id === currentProjectId ? styles.active : ''}`}
                                        onClick={() => selectProject(p.id)}
                                    >
                                        <div className={styles.dpIcon}>{p.name[0]}</div>
                                        <div>
                                            <div className={styles.dpName}>{p.name}</div>
                                            <div className={styles.dpDate}>{new Date(p.createdAt).toLocaleDateString()}</div>
                                        </div>
                                        {p.id === currentProjectId && <span className={styles.checkmark}>✓</span>}
                                    </button>
                                ))}
                                <div className={styles.dropdownDivider} />
                                <button
                                    className={styles.newProjectBtn}
                                    onClick={() => { setDropdownOpen(false); setShowNewProject(true) }}
                                >
                                    <span>＋</span> Make New Project
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Navigation ── */}
                <nav className={styles.nav}>
                    {NAV.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                            onClick={onClose}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{item.label}</span>
                            {item.badge && <span className={styles.navBadgeLive}>{item.badge}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.statusBar}>
                        <span className={`${styles.statusDot} ${onlineCount > 0 ? styles.green : styles.orange}`} />
                        <span className={styles.statusText}>
                            {onlineCount > 0 ? `${onlineCount} device${onlineCount > 1 ? 's' : ''} online` : 'No devices online'}
                        </span>
                    </div>
                    <button className={styles.logoutBtn} onClick={async () => {
                        try {
                            await logout()
                            navigate('/')
                        } catch (err) {
                            console.error('Failed to log out', err)
                        }
                    }}>
                        <span>⎋</span> Sign Out
                    </button>
                </div>
            </aside>

            {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
        </>
    )
}
