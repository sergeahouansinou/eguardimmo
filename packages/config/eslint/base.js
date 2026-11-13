import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export const base = defineConfig(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/storybook-static/**', '**/coverage/**'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/*.{jsx,tsx}'],
    extends: [jsxA11y.flatConfigs.strict, reactHooks.configs.flat.recommended],
  },
);
