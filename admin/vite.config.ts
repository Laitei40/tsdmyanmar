import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // Proxy API requests to Wrangler Pages dev server
      '/admin/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist'
  }
});
