/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test/unit/**/*.spec.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/support/setup.ts',
    css: true,
  },
  resolve: {
    alias: {
      '@test': path.resolve(import.meta.dirname, './test'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
