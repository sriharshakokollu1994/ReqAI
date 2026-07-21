import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files:          ['src/**/*.ts'],
    languageOptions: {
      parser:        tsParser,
      parserOptions: {
        project:  './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any':            'warn',
      '@typescript-eslint/no-unused-vars':             ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion':      'warn',
      'no-console':                                    'error',
      'no-duplicate-imports':                          'error',
      'eqeqeq':                                        ['error', 'always'],
      'prefer-const':                                  'error',
      'no-var':                                        'error',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.js'],
  },
];
