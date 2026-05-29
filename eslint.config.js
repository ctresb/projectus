import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/target/**', '**/node_modules/**', '**/*.css'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Classic react-hooks rules. (v7's recommended preset additionally bundles the
      // React Compiler rules — set-state-in-effect, refs, immutability, etc. — which we
      // don't opt this codebase into here.)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Barrels intentionally mix exports.
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Relax react-refresh in test files.
    files: ['**/*.test.*', '**/__tests__/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
