import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173
    },
    define: {
        // Injected at build time — set VITE_SERVER_URL in your GitHub Actions / Vercel env vars
        // e.g. VITE_SERVER_URL=https://your-app.railway.app
        // Falls back to localhost for local dev
        __SERVER_URL__: JSON.stringify(process.env.VITE_SERVER_URL || 'http://localhost:4000'),
    }
})
