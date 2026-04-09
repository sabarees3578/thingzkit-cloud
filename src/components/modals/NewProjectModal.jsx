import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import styles from './Modal.module.css'

export default function NewProjectModal({ onClose }) {
    const { addProject } = useApp()
    const [name, setName] = useState('')
    const [desc, setDesc] = useState('')

    const submit = (e) => {
        e.preventDefault()
        if (!name.trim()) return
        addProject(name.trim(), desc.trim())
        onClose()
    }

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.headerIcon}>🗂️</div>
                    <div>
                        <h3 className={styles.title}>New Project</h3>
                        <p className={styles.subtitle}>Create a new IoT project workspace</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <form onSubmit={submit} className={styles.body}>
                    <div className={styles.field}>
                        <label className={styles.label}>Project Name <span className={styles.req}>*</span></label>
                        <input
                            className={styles.input}
                            placeholder="e.g. Smart Office Hub"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                            required
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Description <span className={styles.opt}>(optional)</span></label>
                        <textarea
                            className={`${styles.input} ${styles.textarea}`}
                            placeholder="What are you monitoring?"
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className={styles.footer}>
                        <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
                        <button type="submit" className={styles.btnPrimary} disabled={!name.trim()}>
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
