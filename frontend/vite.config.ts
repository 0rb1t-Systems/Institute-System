import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Chunk strategy — keep the boot path small.
 *
 * The entry chunk previously weighed 2.45 MB (728 kB gzip) because xlsx,
 * html2canvas, jspdf and recharts were reachable from eagerly-imported pages.
 * They are now split into their own chunks that are only fetched by the
 * feature that actually needs them (export / PDF / ID card / charts).
 */
const manualChunks = (id: string) => {
  // Vite's __vitePreload helper is imported by every lazy route chunk. Left
  // unassigned, Rollup co-locates it inside a heavy vendor chunk (e.g. jspdf),
  // which then gets pulled into the entry and preloaded at boot. Pin it to the
  // always-loaded `vendor` chunk so no heavy library rides in with it.
  if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload')) return 'vendor';

  if (!id.includes('node_modules')) return undefined;

  // Heavy, feature-scoped libraries — must never land in the entry chunk.
  if (id.includes('/xlsx')) return 'vendor-xlsx';
  if (id.includes('/html2canvas')) return 'vendor-html2canvas';
  if (id.includes('/jspdf') || id.includes('/dompurify')) return 'vendor-pdf';
  if (id.includes('/recharts') || id.includes('/d3-') || id.includes('/victory-')) return 'vendor-charts';
  if (id.includes('/html5-qrcode') || id.includes('/qrcode') || id.includes('/react-qr-code')) return 'vendor-qr';

  // Supabase is large and independent — safe to isolate.
  if (id.includes('/@supabase')) return 'vendor-supabase';

  // Everything else (react, react-dom, scheduler, router, radix, lucide, …)
  // stays in one vendor chunk. Splitting react/react-dom/scheduler apart
  // creates circular chunk references, so keep the runtime together.
  return 'vendor';
};

export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    // Route chunks are small; the warning is only useful for the entry chunk.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: { manualChunks },
    },
  },
  optimizeDeps: {
    // Pre-bundle chart stack so lodash CJS (used by recharts) gets a real
    // ESM default export. Excluding recharts caused:
    //   "lodash/get.js does not provide an export named 'default'"
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'recharts',
      'lodash',
      'lodash-es',
    ],
    // Heavy libs that are fine as raw ESM / rarely touch CJS interop
    exclude: ['xlsx', 'html2canvas', 'jspdf'],
  },
});
