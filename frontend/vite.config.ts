import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks(id: string | null) {
          if (!id) return;
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router-dom')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/react-icons')) {
            return 'ui-vendor';
          }
          if (id.includes('node_modules/axios')) {
            return 'utils-vendor';
          }
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
