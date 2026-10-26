import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// O build é servido pela porta pública do servidor local (packages/server).
// Em dev isolado, aponte VITE_SIGNALING_URL para um host rodando (ex.: ws://192.168.0.10:PORT/ws/viewer).
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // sem inline de assets: a CSP só permite 'self'
    assetsInlineLimit: 0,
  },
});
