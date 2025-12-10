import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // On fixe le port du frontend
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // On redirige vers ton backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
