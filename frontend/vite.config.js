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
  },
});
