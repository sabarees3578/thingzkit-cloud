import { Routes, Route, Navigate } from 'react-router-dom'
import WelcomePage from './pages/WelcomePage.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

function ProtectedRoute({ children }) {
    const { currentUser } = useAuth()
    
    if (!currentUser) {
        return <Navigate to="/" replace />
    }
    
    return children
}

function App() {
    return (
        <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/dashboard/*" element={
                <ProtectedRoute>
                    <DashboardLayout />
                </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
