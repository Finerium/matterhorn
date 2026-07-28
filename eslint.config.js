// ponytail: flat config, typescript-eslint recommended only. The custom Matterhorn lints
// (banned lexicon, future-tense harm, em dash / emoji) arrive at Gate 1 with the content
// they police; adding rule plugins before then buys nothing.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'app/dist/**', 'node_modules/**', 'coverage/**'] },
  tseslint.configs.recommended,
  {
    files: ['**/*.tsx'],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
);
