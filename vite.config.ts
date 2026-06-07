import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this project at /retire-pro/, so built asset URLs
  // need that prefix. Local dev (command === 'serve') stays at the root.
  base: command === 'build' ? '/retire-pro/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    host: true,
  },
}));
