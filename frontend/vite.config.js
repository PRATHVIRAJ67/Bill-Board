import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_', 'REACT_APP_'],
  define: {
    'process.env': {},
  },
  server: {
    host: true,
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // React is shared by the shell and the lazy 3D chunk; pin it so Rollup
        // never hoists it into (and eagerly loads) the three.js chunk.
        manualChunks(id) {
          if (/[\/]node_modules[\/](react|react-dom|scheduler)[\/]/.test(id)) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
