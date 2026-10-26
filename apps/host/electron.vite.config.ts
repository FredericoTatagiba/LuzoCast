import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

// Pacotes internos são fonte TS (ADR-0007): precisam ser BUNDLADOS, não externalizados.
// Por isso ficam em devDependencies; as dependências de runtime deles (fastify, ws, zod)
// ficam em dependencies para serem externalizadas e empacotadas no instalador.
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
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
