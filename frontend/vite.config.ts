import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    // Escuta em todas as interfaces para poder testar no iPad durante o dev,
    // igual ao container. A API continua no backend.
    host: true,
    proxy: { '/api': 'http://localhost:8080' },
  },
})
