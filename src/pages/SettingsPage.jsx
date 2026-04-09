import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import styles from './SubPage.module.css'

export default function SettingsPage() {
    const { currentProject, renameProject } = useApp()
    const [projName, setProjName] = useState(currentProject?.name || '')
    const [emailAlerts, setEmailAlerts] = useState(true)
    const [pushNotifs, setPushNotifs] = useState(false)
    const [weeklyReports, setWeeklyReports] = useState(true)
    const [saved, setSaved] = useState(false)

    const handleSave = () => {
        if (projName.trim() && currentProject) {
            renameProject(currentProject.id, projName.trim())
        }
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Settings</h2>
                    <p className={styles.pageSub}>Project and platform configuration</p>
                </div>
                <button className={styles.btnPrimary} onClick={handleSave}>
                    {saved ? '✓ Saved!' : 'Save Changes'}
                </button>
            </div>

            <div className={styles.settingsSections}>
                {/* Project */}
                <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>📁 Project Settings</h3>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Project Name</div>
                            <div className={styles.settDesc}>Rename this project workspace</div>
                        </div>
                        <input
                            className={styles.settInput}
                            value={projName}
                            onChange={e => setProjName(e.target.value)}
                            placeholder="Project name"
                        />
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Project ID</div>
                            <div className={styles.settDesc}>Unique identifier (read-only)</div>
                        </div>
                        <input className={styles.settInput} value={currentProject?.id || ''} readOnly style={{ color: 'var(--accent-purple)', cursor: 'default' }} />
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Created</div>
                            <div className={styles.settDesc}>When this project was created</div>
                        </div>
                        <input className={styles.settInput} value={currentProject ? new Date(currentProject.createdAt).toLocaleString() : ''} readOnly style={{ cursor: 'default' }} />
                    </div>
                </div>

                {/* API */}
                <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>🌐 API Configuration</h3>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Base Endpoint</div>
                            <div className={styles.settDesc}>All ESP32 devices send data to this base URL</div>
                        </div>
                        <input className={styles.settInput} value="http://enthutechiot.local/api/v1" readOnly style={{ color: 'var(--accent-green)', cursor: 'default', minWidth: '260px' }} />
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Ingest Format</div>
                            <div className={styles.settDesc}>JSON key-value pairs sent by your device</div>
                        </div>
                        <code style={{ fontSize: '.75rem', color: 'var(--accent-purple)', background: 'rgba(108,99,255,.1)', padding: '6px 12px', borderRadius: '8px' }}>
                            {'{"temperature": 25.4, "humidity": 60}'}
                        </code>
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Auth Header</div>
                            <div className={styles.settDesc}>Add this to every ESP32 HTTP request</div>
                        </div>
                        <code style={{ fontSize: '.75rem', color: 'var(--accent-yellow)', background: 'rgba(255,211,42,.08)', padding: '6px 12px', borderRadius: '8px' }}>
                            X-API-Key: {'<your-device-api-key>'}
                        </code>
                    </div>
                </div>

                {/* Notifications */}
                <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>🔔 Notifications</h3>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Email Alerts</div>
                            <div className={styles.settDesc}>Receive email when thresholds are exceeded</div>
                        </div>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={emailAlerts} onChange={() => setEmailAlerts(v => !v)} />
                            <span className={styles.slider} />
                        </label>
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Push Notifications</div>
                            <div className={styles.settDesc}>Browser push notifications for alerts</div>
                        </div>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={pushNotifs} onChange={() => setPushNotifs(v => !v)} />
                            <span className={styles.slider} />
                        </label>
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Weekly Reports</div>
                            <div className={styles.settDesc}>Summary email every Monday</div>
                        </div>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={weeklyReports} onChange={() => setWeeklyReports(v => !v)} />
                            <span className={styles.slider} />
                        </label>
                    </div>
                </div>

                {/* Data */}
                <div className={styles.settingsSection}>
                    <h3 className={styles.sectionTitle}>⚙️ General</h3>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Data Refresh Rate</div>
                            <div className={styles.settDesc}>How often the dashboard polls for new data</div>
                        </div>
                        <select className={styles.settInput}>
                            <option>Every 2 seconds</option>
                            <option>Every 5 seconds</option>
                            <option>Every 10 seconds</option>
                            <option>Manual only</option>
                        </select>
                    </div>
                    <div className={styles.settRow}>
                        <div className={styles.settInfo}>
                            <div className={styles.settLabel}>Timezone</div>
                            <div className={styles.settDesc}>Used for timestamps and automation schedules</div>
                        </div>
                        <select className={styles.settInput}>
                            <option>Asia/Kolkata (IST)</option>
                            <option>UTC</option>
                            <option>America/New_York (EST)</option>
                            <option>Europe/London (GMT)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}
