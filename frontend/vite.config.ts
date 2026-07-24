import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    // Generación del informe de análisis de bundle bajo opt-in explícito (`ANALYZE=true`).
    process.env.ANALYZE === 'true' &&
      visualizer({
        filename: 'build/bundle-analysis.html',
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
      }),
  ],
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
          if (
            id.includes('node_modules/react-markdown') ||
            id.includes('node_modules/remark-gfm') ||
            id.includes('node_modules/mdast-') ||
            id.includes('node_modules/micromark') ||
            id.includes('node_modules/unist-') ||
            id.includes('node_modules/hast-') ||
            id.includes('node_modules/prism-react-renderer')
          ) {
            // Aisla las librerías de renderizado de markdown y resaltado de sintaxis en su propio chunk.
            return 'markdown-vendor';
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
