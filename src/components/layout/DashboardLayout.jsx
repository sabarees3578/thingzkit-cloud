import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from '../Sidebar.jsx'
import Topbar from '../Topbar.jsx'
import DashboardPage from '../../pages/DashboardPage.jsx'
import DevicesPage from '../../pages/DevicesPage.jsx'
import AnalyticsPage from '../../pages/AnalyticsPage.jsx'
import AutomationsPage from '../../pages/AutomationsPage.jsx'
import AlertsPage from '../../pages/AlertsPage.jsx'
import DataLogPage from '../../pages/DataLogPage.jsx'
import TeamPage from '../../pages/TeamPage.jsx'
import SettingsPage from '../../pages/SettingsPage.jsx'
import { useApp } from '../../context/AppContext.jsx'
import styles from './DashboardLayout.module.css'

const PAGE_TITLES = {
    '': 'Dashboard',
    'devices': 'Devices',
    'analytics': 'Analytics',
    'automations': 'Automations',
    'alerts': 'Alerts',
    'datalog': 'Data Log',
    'team': 'Team',
    'settings': 'Settings',
}

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [notifOpen, setNotifOpen] = useState(false)
    const { currentProject } = useApp()

    // Derive current page title from URL
    const seg = window.location.pathname.replace('/dashboard', '').replace('/', '')
    const title = PAGE_TITLES[seg] || 'Dashboard'

    return (
        <div className={styles.layout}>
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
            )}

            <div className={styles.mainWrap}>
                <Topbar
                    title={title}
                    projectName={currentProject?.name}
                    onMenuClick={() => setSidebarOpen(v => !v)}
                    notifOpen={notifOpen}
                    onNotifToggle={() => setNotifOpen(v => !v)}
                    onNotifClose={() => setNotifOpen(false)}
                />

                <main className={styles.main}>
                    <Routes>
                        <Route index element={<DashboardPage />} />
                        <Route path="devices" element={<DevicesPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="automations" element={<AutomationsPage />} />
                        <Route path="alerts" element={<AlertsPage />} />
                        <Route path="datalog" element={<DataLogPage />} />
                        <Route path="team" element={<TeamPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                    </Routes>
                </main>
            </div>
        </div>
    )
}
