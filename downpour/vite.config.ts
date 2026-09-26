import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./web'),
  publicDir: r('./web/public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': r('./shared'),
    },
  },
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
