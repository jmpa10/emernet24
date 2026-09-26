import { defineConfig } from 'vite';

// base relativa: el build funciona en https://usuario.github.io/<repo>/ sin configurar nada
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
