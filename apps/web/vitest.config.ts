import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: { include: ['**/*.test.ts', '**/*.test.tsx'], exclude: ['node_modules', '.next'], environment: 'node' },
});
