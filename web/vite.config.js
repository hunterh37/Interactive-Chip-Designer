import { defineConfig } from 'vite';
const BUILD = Date.now().toString(36);
export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [{ name: 'version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }); } }],
  build: { target: 'es2022', rollupOptions: { input: { host: 'index.html', join: 'join.html', xr: 'xr.html' } } },
});
