import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ponytail: react plugin only. Path aliases, PWA, and route splitting join when a surface
// needs them (Gate 3 onward). Root is this directory; `pnpm dev` / `pnpm build` pass it in.
export default defineConfig({
  plugins: [react()],
});
