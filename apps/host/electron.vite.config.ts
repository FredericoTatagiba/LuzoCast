import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

// O main é BUNDLADO por completo (pacotes internos + fastify/ws/zod). Assim o instalador
// não precisa de node_modules: só `out/` vai para o app.asar. Apenas `electron` e os
// módulos nativos do Node ficam externos (o electron-vite faz isso automaticamente).
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // Dependências OPCIONAIS carregadas com require dentro de try/catch. Se forem
        // bundladas, o rollup quebra o fallback e o WebSocket falha em runtime
        // ("bufferUtil.mask is not a function"). Externas, o require falha e a
        // biblioteca usa a implementação em JS puro. Teste: docs/performance.md#bundle.
        external: ['pino-pretty', 'bufferutil', 'utf-8-validate'],
      },
    },
  },
  preload: {
    build: {
      // sandbox: true exige preload em CommonJS
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [vue()],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
