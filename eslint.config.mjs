// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * ESLint 9 flat config covering the Electron app (root), packages/shared and apps/web.
 *
 * Import resolution is not linted here: `npm run typecheck` already fails on an
 * unresolvable import or workspace alias (`@shared`, `@/`), so eslint-plugin-import
 * would only duplicate it and misreport aliases.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.vite/**',
      '**/.next/**',
      '**/coverage/**',
      'apps/web/public/**',
      'apps/web/next-env.d.ts',
      '.beads/**',
      '.claude/**',
    ],
  },
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    files: ['**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
    // Tracked in beads vpz.7: every rule `recommended` sets to error is a warning until the
    // findings are fixed. Rules `recommended` turns off stay off.
    rules: Object.fromEntries(
      Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, setting]) => {
        const [level, ...options] = Array.isArray(setting) ? setting : [setting];
        const isError = level === 'error' || level === 2;
        return [rule, isError ? ['warn', ...options] : setting];
      }),
    ),
  },

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // The privileged processes may import only the dependency-free `types` and `key-utils` from the
    // shared UI package; anything else would bundle renderer code into main or preload.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@shared/*', '!@shared/types', '!@shared/key-utils'],
              message: 'main and preload may import only @shared/types and @shared/key-utils.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
