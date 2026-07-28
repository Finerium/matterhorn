// Root vitest config. It exists for one reason: vitest collects every *.spec.* under the repo,
// and tests/e2e is playwright's, whose `@playwright/test` import explodes inside vitest.
//
// ponytail: no plugins. The renderer specs are .tsx, and esbuild reads `jsx: react-jsx` out of
// tsconfig.json on its own, so @vitejs/plugin-react buys nothing here. Environment stays
// per-file via the `// @vitest-environment jsdom` docblock the specs already carry.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'tests/e2e/**'] },
});
