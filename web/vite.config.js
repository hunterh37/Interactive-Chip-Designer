import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2022', rollupOptions: { input: { host: 'index.html', join: 'join.html', xr: 'xr.html' } } },
});
