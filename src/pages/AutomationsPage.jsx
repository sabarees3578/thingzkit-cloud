import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import styles from './SubPage.module.css'

const CONDITIONS = [
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '≥' },
    { value: '<=', label: '≤' },
    { value: '==', label: '=' },
    { value: '!=', label: '≠' },
]

const ICONS = ['🌡️', '💧', '⚡', '🔋', '📶', '💡', '🚪', '🔔', '🔒', '🌡️', '💨', '☀️']

const LEVELS = [
    { value: 'critical', label: 'Critical', color: 'var(--accent-red)' },
    { value: 'warning', label: 'Warning', color: 'var(--accent-yellow)' },
    { value: 'info', label: 'Info', color: 'var(--accent-blue)' },
]

export default function AutomationsPage() {
    const { currentProject, projectDevices, projectAutomations, addAutomation, updateAutomation, deleteAutomation } = useApp()
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState({
        name: '',
        icon: '⚡',
        deviceId: '',
        variable: '',
        condition: '>',
        threshold: '',
        level: 'warning',
        actionDeviceId: '',
        actionVariable: '',
        actionValue: '',
    })

    const automations = projectAutomations || []

    const toggle = (id) => {
        const auto = automations.find(a => a.id === id)
        if (auto) {
            updateAutomation(id, { status: auto.status === 'enabled' ? 'disabled' : 'enabled' })
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.name || !form.deviceId || !form.variable || !form.threshold) return

        const newAuto = {
            ...form,
            threshold: parseFloat(form.threshold),
            desc: `When ${form.variable} ${form.condition} ${form.threshold}`,
            trigger: `${form.variable} ${form.condition} ${form.threshold}`,
        }

        if (editingId) {
            updateAutomation(editingId, newAuto)
        } else {
            addAutomation(newAuto)
        }

        setForm({ name: '', icon: '⚡', deviceId: '', variable: '', condition: '>', threshold: '', level: 'warning', actionDeviceId: '', actionVariable: '', actionValue: '' })
        setShowForm(false)
        setEditingId(null)
    }

    const handleEdit = (auto) => {
        setForm({
            name: auto.name,
            icon: auto.icon,
            deviceId: auto.deviceId || '',
            variable: auto.variable || '',
            condition: auto.condition || '>',
            threshold: auto.threshold?.toString() || '',
            level: auto.level || 'warning',
            actionDeviceId: auto.actionDeviceId || '',
            actionVariable: auto.actionVariable || '',
            actionValue: auto.actionValue?.toString() || '',
        })
        setEditingId(auto.id)
        setShowForm(true)
    }

    const handleDelete = (id) => {
        if (confirm('Delete this automation?')) {
            deleteAutomation(id)
        }
    }

    const selectedDevice = projectDevices.find(d => d.id === form.deviceId)
    const variables = selectedDevice?.variables || []
    
    const selectedActionDevice = projectDevices.find(d => d.id === form.actionDeviceId)
    const actionVariables = selectedActionDevice?.variables || []

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Automations</h2>
                    <p className={styles.pageSub}>
                        {automations.filter(a => a.status === 'enabled').length} active rules · {currentProject?.name}
                    </p>
                </div>
                <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>＋ New Rule</button>
            </div>

            {showForm && (
                <div className={styles.automationForm}>
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label>Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g., High Temperature Alert"
                                    className={styles.formInput}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Icon</label>
                                <div className={styles.iconPicker}>
                                    {ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            className={`${styles.iconBtn} ${form.icon === icon ? styles.selected : ''}`}
                                            onClick={() => setForm({ ...form, icon })}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Device</label>
                                <select
                                    value={form.deviceId}
                                    onChange={e => setForm({ ...form, deviceId: e.target.value, variable: '' })}
                                    className={styles.formSelect}
                                >
                                    <option value="">Select device...</option>
                                    {projectDevices.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Variable</label>
                                <select
                                    value={form.variable}
                                    onChange={e => setForm({ ...form, variable: e.target.value })}
                                    className={styles.formSelect}
                                    disabled={!form.deviceId}
                                >
                                    <option value="">Select variable...</option>
                                    {variables.map(v => (
                                        <option key={v.id} value={v.name}>{v.name} ({v.type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Condition</label>
                                <div className={styles.conditionRow}>
                                    <select
                                        value={form.condition}
                                        onChange={e => setForm({ ...form, condition: e.target.value })}
                                        className={styles.formSelect}
                                    >
                                        {CONDITIONS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        value={form.threshold}
                                        onChange={e => setForm({ ...form, threshold: e.target.value })}
                                        placeholder="Value"
                                        className={styles.formInput}
                                    />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Alert Level</label>
                                <div className={styles.levelPicker}>
                                    {LEVELS.map(l => (
                                        <button
                                            key={l.value}
                                            type="button"
                                            className={`${styles.levelBtn} ${form.level === l.value ? styles.selected : ''}`}
                                            onClick={() => setForm({ ...form, level: l.value })}
                                            style={{ borderColor: form.level === l.value ? l.color : 'transparent' }}
                                        >
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* -- Action Section -- */}
                            <div className={styles.formGroup} style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                                <label style={{ borderBottom: '1px solid var(--border)', paddingBottom: '5px' }}>Action To Execute (Optional)</label>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Action Device</label>
                                <select
                                    value={form.actionDeviceId}
                                    onChange={e => setForm({ ...form, actionDeviceId: e.target.value, actionVariable: '' })}
                                    className={styles.formSelect}
                                >
                                    <option value="">None (Alert Only)</option>
                                    {projectDevices.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Action Variable</label>
                                <select
                                    value={form.actionVariable}
                                    onChange={e => setForm({ ...form, actionVariable: e.target.value })}
                                    className={styles.formSelect}
                                    disabled={!form.actionDeviceId}
                                >
                                    <option value="">Select variable...</option>
                                    {actionVariables.map(v => (
                                        <option key={v.id} value={v.name}>{v.name} ({v.type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Action Value</label>
                                <input
                                    type="text"
                                    value={form.actionValue}
                                    onChange={e => setForm({ ...form, actionValue: e.target.value })}
                                    placeholder="e.g. 1 or true"
                                    className={styles.formInput}
                                    disabled={!form.actionVariable}
                                />
                            </div>
                        </div>
                        <div className={styles.formActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => { setShowForm(false); setEditingId(null) }}>
                                Cancel
                            </button>
                            <button type="submit" className={styles.submitBtn}>
                                {editingId ? 'Update Rule' : 'Create Rule'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className={styles.automationsList}>
                {automations.map(a => (
                    <div key={a.id} className={styles.automationCard}>
                        <div className={styles.autoIcon}>{a.icon}</div>
                        <div className={styles.autoInfo}>
                            <div className={styles.autoName}>{a.name}</div>
                            <div className={styles.autoDesc}>{a.desc || a.trigger}</div>
                            <div className={styles.autoTrigger}>
                                {a.deviceId ? `Device: ${projectDevices.find(d => d.id === a.deviceId)?.name || 'Unknown'}` : ''} · Trigger: {a.trigger}
                            </div>
                            {a.actionDeviceId && (
                                <div className={styles.autoTrigger} style={{ color: 'var(--accent-green)', marginTop: '4px' }}>
                                    ► Action: Set {projectDevices.find(d => d.id === a.actionDeviceId)?.name || 'Unknown'} '{a.actionVariable}' to {a.actionValue}
                                </div>
                            )}
                        </div>
                        <div className={`${styles.autoStatus} ${a.status === 'enabled' ? styles.enabled : styles.disabled}`}>
                            {a.status === 'enabled' ? '● Active' : '○ Disabled'}
                        </div>
                        <label className={styles.toggle}>
                            <input type="checkbox" checked={a.status === 'enabled'} onChange={() => toggle(a.id)} />
                            <span className={styles.slider} />
                        </label>
                        <div className={styles.autoActions}>
                            <button className={styles.editBtn} onClick={() => handleEdit(a)}>✏️</button>
                            <button className={styles.delBtn} onClick={() => handleDelete(a.id)}>🗑</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
