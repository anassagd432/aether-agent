import path from 'path';
import { readFileSync } from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
    plugins: [
      react(),
      wasm(),
      topLevelAwait()
    ],
    define: {
      // SECURITY: API keys must NEVER be bundled into frontend code
      // Use server-side proxy for API calls instead
      'process.env.NODE_ENV': JSON.stringify(mode),
      'APP_VERSION': JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      exclude: ['@whiskeysockets/baileys', '@whiskeysockets/libsignal-node', 'sharp', 'detect-libc'],
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        external: ['@whiskeysockets/baileys', '@whiskeysockets/libsignal-node', 'sharp', 'detect-libc'],
        output: {
          // Avoid circular manual chunk graphs by:
          // - isolating React itself (very stable + shared)
          // - splitting only the heavy/isolated stacks (AI + WebContainer)
          // - keeping the remainder together
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return;

            // Heavy / mostly-independent stacks
            if (id.includes('@google/genai')) return 'vendor-ai';
            if (id.includes('@webcontainer')) return 'vendor-webcontainer';

            // React core (keep isolated; it should not depend on app/vendor utils)
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('use-sync-external-store')
            ) {
              return 'vendor-react';
            }

            // Everything else stays together to prevent circular deps
            return 'vendor';
          },
        }
      }
    }
  };
});
