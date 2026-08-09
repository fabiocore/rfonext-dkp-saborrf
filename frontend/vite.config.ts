import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: {
      // Bind mounts do Docker Desktop no Windows não propagam eventos de FS
      // de forma confiável — polling garante que o HMR funcione mesmo assim.
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://api:3000',
        changeOrigin: true,
      },
    },
  },
})
