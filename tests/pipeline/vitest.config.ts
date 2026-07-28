// Gate C pipeline specs run from their own config because the root config permanently
// excludes staging/** (a staging tree is not part of `pnpm test` until it is installed).
//
//   pnpm exec vitest run --config tests/pipeline/vitest.config.ts
//
// `root` is the repo root so the specs spawn the runner and the validator the way CI will.
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: resolve(import.meta.dirname, '..', '..'),
  test: { include: ['tests/pipeline/**/*.spec.ts'] },
});
