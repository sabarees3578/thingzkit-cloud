import styles from './SubPage.module.css'

const TEAM = [
    { id: 1, initials: 'JD', name: 'John Doe', role: 'Admin', status: 'active', color: 'linear-gradient(135deg,var(--accent-purple),var(--accent-blue))' },
    { id: 2, initials: 'AS', name: 'Aisha Singh', role: 'Engineer', status: 'active', color: 'linear-gradient(135deg,var(--accent-green),var(--accent-blue))' },
    { id: 3, initials: 'MK', name: 'Mohan Kumar', role: 'Viewer', status: 'inactive', color: 'linear-gradient(135deg,var(--accent-orange),var(--accent-yellow))' },
]

export default function TeamPage() {
    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Team</h2>
                    <p className={styles.pageSub}>{TEAM.length} members</p>
                </div>
                <button className={styles.btnPrimary}>＋ Invite Member</button>
            </div>
            <div className={styles.teamGrid}>
                {TEAM.map(m => (
                    <div key={m.id} className={styles.teamCard}>
                        <div className={styles.teamAvatar} style={{ background: m.color }}>{m.initials}</div>
                        <div className={styles.teamName}>{m.name}</div>
                        <div className={styles.teamRole}>{m.role}</div>
                        <div className={`${styles.teamStatus} ${m.status === 'active' ? styles.active : styles.inactive}`}>
                            ● {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
