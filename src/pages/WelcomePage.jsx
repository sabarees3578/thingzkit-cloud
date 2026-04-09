import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import styles from './WelcomePage.module.css'

// ── Particle Canvas ──────────────────────────────────────────
function ParticleCanvas() {
    const canvasRef = useRef(null)
    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        let particles = []
        let animId

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
        resize()
        window.addEventListener('resize', resize)

        class Particle {
            constructor() { this.reset() }
            reset() {
                this.x = Math.random() * canvas.width
                this.y = Math.random() * canvas.height
                this.vx = (Math.random() - 0.5) * 0.4
                this.vy = (Math.random() - 0.5) * 0.4
                this.life = 0
                this.maxLife = 100 + Math.random() * 200
                this.size = 1 + Math.random() * 2
                const cols = ['rgba(108,99,255,', 'rgba(0,212,255,', 'rgba(0,229,160,']
                this.color = cols[Math.floor(Math.random() * cols.length)]
            }
            update() {
                this.x += this.vx; this.y += this.vy; this.life++
                if (this.life > this.maxLife || this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset()
            }
            draw() {
                const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.6
                ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
                ctx.fillStyle = this.color + alpha + ')'; ctx.fill()
            }
        }

        for (let i = 0; i < 80; i++) { const p = new Particle(); p.life = Math.random() * p.maxLife; particles.push(p) }

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            particles.forEach(p => { p.update(); p.draw() })
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < 100) {
                        ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y)
                        ctx.strokeStyle = `rgba(108,99,255,${(1 - dist / 100) * 0.15})`; ctx.lineWidth = 0.5; ctx.stroke()
                    }
                }
            }
            animId = requestAnimationFrame(loop)
        }
        loop()
        return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId) }
    }, [])
    return <canvas ref={canvasRef} className={styles.particleCanvas} />
}

// ── Counter hook ──────────────────────────────────────────────
function useCounter(target, duration = 2000) {
    const [val, setVal] = useState(0)
    useEffect(() => {
        let start = 0
        const step = (target / duration) * 16
        const timer = setInterval(() => {
            start += step
            if (start >= target) { setVal(target); clearInterval(timer) }
            else setVal(Math.floor(start))
        }, 16)
        return () => clearInterval(timer)
    }, [target, duration])
    return val
}

// ── Live Preview Cards ────────────────────────────────────────
function LiveCard({ icon, label, value, cardClass }) {
    return (
        <div className={`${styles.previewCard} ${styles[cardClass]}`}>
            <div className={styles.previewIcon}>{icon}</div>
            <div className={styles.previewInfo}>
                <span className={styles.previewLabel}>{label}</span>
                <span className={styles.previewValue}>{value}</span>
            </div>
            <div className={`${styles.badge} ${styles.online}`}>LIVE</div>
        </div>
    )
}

// ── Welcome Page ──────────────────────────────────────────────
export default function WelcomePage() {
    const navigate = useNavigate()
    const { login, signup, googleSignIn } = useAuth()
    const devices = useCounter(12400)
    const users = useCounter(3800)
    const [tab, setTab] = useState('login')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [liveData, setLiveData] = useState({ temp: '28.4°C', humid: '62%', power: '3.2 kW' })

    useEffect(() => {
        const t = setInterval(() => {
            setLiveData({
                temp: (26 + Math.random() * 5).toFixed(1) + '°C',
                humid: Math.floor(55 + Math.random() * 15) + '%',
                power: (2.8 + Math.random() * 0.8).toFixed(1) + ' kW',
            })
        }, 3000)
        return () => clearInterval(t)
    }, [])

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(email, password)
            navigate('/dashboard')
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }

    const handleSignup = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await signup(email, password)
            navigate('/dashboard')
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setError('')
        setLoading(true)
        try {
            await googleSignIn()
            navigate('/dashboard')
        } catch (err) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className={styles.welcomeBody}>
            {/* Background */}
            <div className={styles.bgAnimation}>
                <div className={`${styles.bgOrb} ${styles.orb1}`} />
                <div className={`${styles.bgOrb} ${styles.orb2}`} />
                <div className={`${styles.bgOrb} ${styles.orb3}`} />
                <ParticleCanvas />
            </div>
            <div className={styles.gridOverlay} />

            <div className={styles.container}>
                {/* ── LEFT ── */}
                <div className={styles.left}>
                    {/* Brand */}
                    <div className={styles.brand}>
                        <div className={styles.logoIcon}>
                            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                                <circle cx="16" cy="16" r="6" fill="#fff" />
                                <circle cx="16" cy="4" r="3" fill="#fff" opacity="0.7" />
                                <circle cx="28" cy="10" r="3" fill="#fff" opacity="0.7" />
                                <circle cx="28" cy="22" r="3" fill="#fff" opacity="0.7" />
                                <circle cx="16" cy="28" r="3" fill="#fff" opacity="0.7" />
                                <circle cx="4" cy="22" r="3" fill="#fff" opacity="0.7" />
                                <circle cx="4" cy="10" r="3" fill="#fff" opacity="0.7" />
                            </svg>
                        </div>
                        <span className={styles.brandName}>Enthu<span>Tech</span></span>
                    </div>

                    {/* Hero */}
                    <div className={styles.hero}>
                        <h1 className={styles.heroTitle}>
                            Connect. Monitor.<br />
                            <span className="gradient-text">Control Everything.</span>
                        </h1>
                        <p className={styles.heroSubtitle}>
                            A powerful IoT platform to manage all your connected devices, analyze real-time data, and automate your world — all from one place.
                        </p>
                        <div className={styles.pills}>
                            {[
                                { dot: styles.green, label: 'Real-time Monitoring' },
                                { dot: styles.blue, label: 'Device Management' },
                                { dot: styles.purple, label: 'Smart Automation' },
                            ].map(p => (
                                <div key={p.label} className={styles.pill}>
                                    <span className={`${styles.pillDot} ${p.dot}`} />
                                    {p.label}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className={styles.statsRow}>
                        <div className={styles.statItem}>
                            <span className={`${styles.statNum} gradient-text`}>{devices.toLocaleString()}+</span>
                            <span className={styles.statLabel}>Devices</span>
                        </div>
                        <div className={styles.statDiv} />
                        <div className={styles.statItem}>
                            <span className={`${styles.statNum} gradient-text`}>{users.toLocaleString()}+</span>
                            <span className={styles.statLabel}>Users</span>
                        </div>
                        <div className={styles.statDiv} />
                        <div className={styles.statItem}>
                            <span className={`${styles.statNum} gradient-text`}>99.9%</span>
                            <span className={styles.statLabel}>Uptime</span>
                        </div>
                    </div>

                    {/* Live Preview Cards */}
                    <div className={styles.previewCards}>
                        <LiveCard icon="🌡️" label="Temperature" value={liveData.temp} cardClass="cardTemp" />
                        <LiveCard icon="💧" label="Humidity" value={liveData.humid} cardClass="cardHumid" />
                        <LiveCard icon="⚡" label="Power Usage" value={liveData.power} cardClass="cardPower" />
                    </div>
                </div>

                {/* ── RIGHT (Auth) ── */}
                <div className={styles.right}>
                    <div className={styles.authCard}>
                        {/* Tabs */}
                        <div className={styles.authTabs}>
                            <button className={`${styles.authTab} ${tab === 'login' ? styles.active : ''}`} onClick={() => setTab('login')}>Sign In</button>
                            <button className={`${styles.authTab} ${tab === 'register' ? styles.active : ''}`} onClick={() => setTab('register')}>Sign Up</button>
                        </div>

                        {tab === 'login' ? (
                            <form className={styles.authForm} onSubmit={handleLogin}>
                                <h2 className={styles.authTitle}>Welcome back</h2>
                                <p className={styles.authSubtitle}>Sign in to your Enthu Tech account</p>
                                {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Email Address</label>
                                    <div className={styles.inputWrap}>
                                        <span className={styles.inputIcon}>✉️</span>
                                        <input type="email" className={styles.formInput} placeholder="you@enthutechiot.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Password</label>
                                    <div className={styles.inputWrap}>
                                        <span className={styles.inputIcon}>🔒</span>
                                        <input type={showPass ? 'text' : 'password'} className={styles.formInput} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
                                        <button type="button" className={styles.togglePass} onClick={() => setShowPass(v => !v)}>{showPass ? '🙈' : '👁️'}</button>
                                    </div>
                                </div>
                                <div className={styles.formRow}>
                                    <label className={styles.checkLabel}><input type="checkbox" /> Remember me</label>
                                    <a href="#" className={styles.forgotLink}>Forgot password?</a>
                                </div>
                                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                                    {loading ? <span className={styles.btnLoader} /> : 'Sign In'}
                                </button>
                                <div className={styles.divider}><span>or continue with</span></div>
                                <div className={styles.socialBtns}>
                                    <button type="button" className={styles.socialBtn} onClick={() => navigate('/dashboard')}>🚀 Demo Mode</button>
                                    <button type="button" className={styles.socialBtn} onClick={handleGoogleSignIn}>🌐 Google</button>
                                </div>
                            </form>
                        ) : (
                            <form className={styles.authForm} onSubmit={handleSignup}>
                                <h2 className={styles.authTitle}>Create account</h2>
                                <p className={styles.authSubtitle}>Start your IoT journey with Enthu Tech</p>
                                {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                                <div className={styles.formRow2}>
                                    <div className={styles.formGroup}><label className={styles.formLabel}>First Name</label><div className={styles.inputWrap}><input type="text" className={`${styles.formInput} ${styles.noIcon}`} placeholder="John" /></div></div>
                                    <div className={styles.formGroup}><label className={styles.formLabel}>Last Name</label><div className={styles.inputWrap}><input type="text" className={`${styles.formInput} ${styles.noIcon}`} placeholder="Doe" /></div></div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Email Address</label>
                                    <div className={styles.inputWrap}><span className={styles.inputIcon}>✉️</span><input type="email" className={styles.formInput} placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Password</label>
                                    <div className={styles.inputWrap}><span className={styles.inputIcon}>🔒</span><input type="password" className={styles.formInput} placeholder="Min. 8 characters" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                                </div>
                                <button type="submit" className={styles.btnPrimary} disabled={loading}>
                                    {loading ? <span className={styles.btnLoader} /> : 'Create Account'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
