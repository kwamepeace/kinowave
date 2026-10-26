import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works at /kinowave/app/ on GitHub Pages and anywhere else
export default defineConfig({
  base: './',
  plugins: [react()],
  // hls.js (~575 kB) is its own chunk, loaded only when playback starts
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 700 },
});
