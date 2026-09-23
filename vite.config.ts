import { defineConfig } from 'vitest/config';

// LAVRA_NOHMR=1: servidor estável para testes de ponta a ponta (sem recarga nem observador de arquivos)
const noHmr = !!process.env.LAVRA_NOHMR;

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
  worker: { format: 'es' },
  server: noHmr ? { port: 5175, strictPort: true, hmr: false, watch: null } : { port: 5174, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
});
