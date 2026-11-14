import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      outDir: 'dist',
      target: 'es2022',
      minify: 'esbuild',
      cssCodeSplit: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // 1. Separate icon library BEFORE React match
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              // 2. Core React runtime
              if (
                id.includes('/react/') ||
                id.includes('\\react\\') ||
                id.includes('react-dom') ||
                id.includes('scheduler') ||
                id.includes('react/jsx-runtime') ||
                id.includes('react\\jsx-runtime')
              ) {
                return 'vendor-react';
              }
              // 3. Motion & Animation
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              // 4. Spreadsheets
              if (id.includes('exceljs') || id.includes('xlsx') || id.includes('jszip')) {
                return 'vendor-excel';
              }
              // 5. PDF generation & Canvas
              if (
                id.includes('jspdf') ||
                id.includes('html2canvas') ||
                id.includes('canvg')
              ) {
                return 'vendor-pdf';
              }
              // 6. Monaco Editor
              if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
                return 'vendor-monaco';
              }
              // 7. Sanitization
              if (id.includes('purify') || id.includes('dompurify')) {
                return 'vendor-purify';
              }
              // 8. UI Utilities
              if (id.includes('tailwind-merge') || id.includes('clsx')) {
                return 'vendor-utils';
              }
            }
          },
        },
      },
    },
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
  };
});
