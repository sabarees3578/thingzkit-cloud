import { useApp } from '../context/AppContext.jsx'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { Chart, ArcElement, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'
import styles from './SubPage.module.css'

Chart.register(ArcElement, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const chartOpts = (legend = false) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { display: legend, position: 'right', labels: { color: '#8B8FA8', font: { family: 'Poppins', size: 11 }, usePointStyle: true, padding: 14 } },
        tooltip: { backgroundColor: 'rgba(20,24,40,.95)', borderColor: 'rgba(108,99,255,.3)', borderWidth: 1, titleColor: '#EAEAF4', bodyColor: '#8B8FA8', padding: 10, cornerRadius: 10 }
    },
    scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4A4E6A', font: { family: 'Poppins', size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4A4E6A', font: { family: 'Poppins', size: 10 } } }
    }
})

const donutOpts = () => ({
    responsive: true, maintainAspectRatio: false, cutout: '68%',
    plugins: {
        legend: { display: true, position: 'right', labels: { color: '#8B8FA8', font: { family: 'Poppins', size: 11 }, padding: 14, usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(20,24,40,.95)', borderColor: 'rgba(108,99,255,.3)', borderWidth: 1, titleColor: '#EAEAF4', bodyColor: '#8B8FA8', padding: 10, cornerRadius: 10 }
    }
})

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AnalyticsPage() {
    const { projectDevices, currentProject, liveData } = useApp()

    if (projectDevices.length === 0) {
        return (
            <div className={styles.page}>
                <div className={styles.pageHeader}>
                    <div>
                        <h2 className={styles.pageTitle}>Analytics</h2>
                        <p className={styles.pageSub}>{currentProject?.name}</p>
                    </div>
                </div>
                <div className={styles.emptyFull}>
                    <div className={styles.emptyIcon}>📊</div>
                    <h3>No data to analyze yet</h3>
                    <p>Add devices and start receiving data from your ESP32.<br />Charts and trend analysis will appear here automatically.</p>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <div>
                    <h2 className={styles.pageTitle}>Analytics</h2>
                    <p className={styles.pageSub}>Weekly trends · {currentProject?.name}</p>
                </div>
            </div>
            <div className={styles.analyticsGrid}>
                <div className={`${styles.analyticsCard} ${styles.span7}`}>
                    <h3 className={styles.cardTitle}>Sample Trend — Temperature (°C)</h3>
                    <div style={{ height: 220 }}>
                        <Line data={{
                            labels: days,
                            datasets: [{
                                label: 'Avg Temp (°C)',
                                data: [28, 30, 27, 32, 31, 29, 33],
                                borderColor: 'var(--accent-purple)', backgroundColor: 'rgba(108,99,255,.1)',
                                fill: true, tension: .4, pointRadius: 5, pointBackgroundColor: 'var(--accent-purple)', borderWidth: 2
                            }]
                        }} options={chartOpts(true)} />
                    </div>
                </div>

                <div className={`${styles.analyticsCard} ${styles.span5}`}>
                    <h3 className={styles.cardTitle}>Device Status Split</h3>
                    <div style={{ height: 220 }}>
                        <Doughnut data={{
                            labels: ['Online', 'Waiting', 'Offline'],
                            datasets: [{
                                data: [
                                    projectDevices.filter(d => d.status === 'online').length,
                                    projectDevices.filter(d => d.status === 'waiting').length,
                                    projectDevices.filter(d => d.status === 'offline').length,
                                ],
                                backgroundColor: ['var(--accent-green)', 'var(--accent-yellow)', '#4A4E6A'],
                                borderWidth: 0, hoverOffset: 6
                            }]
                        }} options={donutOpts()} />
                    </div>
                </div>

                <div className={`${styles.analyticsCard} ${styles.span7}`}>
                    <h3 className={styles.cardTitle}>Sample — Device Events per Day</h3>
                    <div style={{ height: 220 }}>
                        <Bar data={{
                            labels: days,
                            datasets: [
                                { label: 'Events', data: [120, 95, 140, 88, 200, 160, 175], backgroundColor: 'rgba(108,99,255,.6)', borderRadius: 6, borderSkipped: false },
                                { label: 'Alerts', data: [3, 1, 5, 2, 4, 1, 2], backgroundColor: 'rgba(255,71,87,.5)', borderRadius: 6, borderSkipped: false }
                            ]
                        }} options={chartOpts(true)} />
                    </div>
                </div>

                <div className={`${styles.analyticsCard} ${styles.span5}`}>
                    <h3 className={styles.cardTitle}>Protocol Distribution</h3>
                    <div style={{ height: 220 }}>
                        <Doughnut data={{
                            labels: ['HTTP', 'HTTPS'],
                            datasets: [{
                                data: [
                                    projectDevices.filter(d => d.protocol === 'http').length || 1,
                                    projectDevices.filter(d => d.protocol === 'https').length || 0,
                                ],
                                backgroundColor: ['var(--accent-purple)', 'var(--accent-green)'],
                                borderWidth: 0, hoverOffset: 6
                            }]
                        }} options={donutOpts()} />
                    </div>
                </div>
            </div>
        </div>
    )
}
