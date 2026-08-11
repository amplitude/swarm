import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: './',
  mode: 'e2e',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __E2E_MODE__: JSON.stringify('true'),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: 'Swarm - E2E Test Mode',
        short_name: 'Swarm E2E',
        description: 'E2E test build - not for production',
        theme_color: '#0f172a',
        icons: [
          { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      // Specific alias first (checked before generic @)
      {
        find: '@/llm/web-llm-provider',
        replacement: path.resolve(__dirname, './tests/e2e/fixtures/e2e-provider.ts'),
      },
      // Generic src alias
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['quickjs-emscripten'],
  },
  build: {
    minify: false, // Keep readable for bundle assertions
  },
});
