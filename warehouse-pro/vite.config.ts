import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom', 'zustand', 'idb'], charts: ['recharts'], icons: ['lucide-react'] } } },
  },
})
