import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    // Em dev o Vite roda separado; a API continua no backend.
    proxy: { '/api': 'http://localhost:8080' },
  },
})
