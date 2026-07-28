import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Root is this directory; `pnpm dev` / `pnpm build` pass it in.
//
// One switch runs through the whole file: `command === 'serve'` is SEED MODE. Serving (plain
// dev and the e2e harness) reads content from tests/fixtures/seed over /@fs and turns the
// dev-only state-jump hook on; building reads content from /content and folds the hook out.
// Nothing else distinguishes the two, which is what makes the Gate C content swap a no-op here.
//
// Harness mode (`vite app --mode harness`) adds one define on top: `__SEED_ROOT__`, which the
// Gate 2 screenshot harness entry reads. The production build takes app/index.html as its only
// input, so harness.html and everything it reaches stay out of the shipped bundle.
const APP_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(APP_ROOT, '..');
const SEED_ROOT = join(REPO_ROOT, 'tests', 'fixtures', 'seed');

// Blueprint 6.7, FROZEN. Field values are quoted from the blueprint; the share_target action
// stays relative (research Section 4 pitfall) and the icon set carries both purposes.
const MANIFEST = {
  name: 'Matterhorn',
  short_name: 'Matterhorn',
  id: '/app',
  start_url: '/app',
  scope: '/',
  display: 'standalone' as const,
  background_color: '#F2F1EC',
  theme_color: '#F2F1EC',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' as const },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' as const },
    { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' as const },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' as const },
  ],
  share_target: {
    action: '/share',
    method: 'GET' as const,
    params: { title: 'title', text: 'text', url: 'url' },
  },
};

export default defineConfig(({ command, mode }) => {
  const serving = command === 'serve';
  const harness = mode === 'harness';
  return {
    plugins: [
      react(),
      // Never in dev and never in the harness: the e2e suite must not have a worker between it
      // and the server. The plugin is simply not present when serving.
      ...(serving
        ? []
        : [
            VitePWA({
              strategies: 'injectManifest',
              srcDir: 'src',
              filename: 'sw.ts',
              injectRegister: null,
              devOptions: { enabled: false },
              manifest: MANIFEST,
              injectManifest: {
                globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
                // The worker stays unminified so `self.__WB_MANIFEST` survives verbatim for
                // workbox to inject into. It is a kilobyte of source, and a readable worker is
                // the right default for a product whose whole claim is an inspectable read path.
                minify: false,
              },
            }),
          ]),
    ],
    define: {
      __CONTENT_BASE__: JSON.stringify(serving ? `/@fs${SEED_ROOT}` : '/content'),
      __MTH_DEV__: JSON.stringify(serving),
      ...(harness ? { __SEED_ROOT__: JSON.stringify(`/@fs${SEED_ROOT}`) } : {}),
    },
    // host pinned to IPv4: vite's default `localhost` binds ::1 only on some machines, and the
    // screenshot config drives http://127.0.0.1. fs.allow opens the repo root so /@fs reaches
    // the seed content root, and only ever while serving.
    server: serving ? { host: '127.0.0.1', fs: { allow: [REPO_ROOT] } } : {},
    build: { rollupOptions: { input: join(APP_ROOT, 'index.html') } },
  };
});
