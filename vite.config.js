import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // Vite will expose VITE_* env variables to the frontend
  // Do NOT expose sensitive server-side vars here
  envPrefix: 'VITE_',

  build: {
    // Tauri expects dist to be in the same directory as index.html
    outDir: 'dist',
    emptyOutDir: true,
    // Tauri uses ES2021; do not lower to avoid polyfill overhead
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },

  // Prevent Vite from obscuring Rust errors in dev
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    // Allow Tauri CLI to connect from any host
    host: process.env.TAURI_DEV_HOST || false,
    hmr: process.env.TAURI_DEV_HOST
      ? {
          protocol: 'ws',
          host: process.env.TAURI_DEV_HOST,
          port: 1421,
        }
      : undefined,
    watch: {
      // Ignore the Rust build artefacts
      ignored: ['**/src-tauri/**'],
    },
  },
});
