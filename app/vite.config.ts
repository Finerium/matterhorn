import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: react plugin only. Path aliases, PWA, and route splitting join when a surface
// needs them (Gate 3 onward). Root is this directory; `pnpm dev` / `pnpm build` pass it in.
//
// Harness mode (`vite app --mode harness`) adds two things, and only in that mode: read access
// to the repo root, so the seed content root can be served over /@fs, and the define that tells
// the harness entry where that root sits. The production build takes app/index.html as its only
// input, so harness.html and everything it reaches stay out of the shipped bundle.
const APP_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(APP_ROOT, '..');
const SEED_ROOT = join(REPO_ROOT, 'tests', 'fixtures', 'seed');

export default defineConfig(({ mode }) => {
  const harness = mode === 'harness';
  return {
    plugins: [react()],
    define: harness ? { __SEED_ROOT__: JSON.stringify(`/@fs${SEED_ROOT}`) } : {},
    // host pinned to IPv4: vite's default `localhost` binds ::1 only on some machines, and the
    // screenshot config drives http://127.0.0.1.
    server: harness ? { host: '127.0.0.1', fs: { allow: [REPO_ROOT] } } : {},
    build: { rollupOptions: { input: join(APP_ROOT, 'index.html') } },
  };
});
