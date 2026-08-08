import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Server code, tests and build config run in Node, not the browser. Without this
    // every `process.env` read was reported as an undefined variable — 24 of them, half
    // the repo's lint errors, all false.
    //
    // That mattered beyond tidiness: no-undef is the rule that found the genuinely
    // undefined identifiers in CalendarModule that would have thrown on render. Buried in
    // two dozen false positives, a real one is invisible.
    files: [
      'server/**/*.js',
      'shared/**/*.js',
      'tests/**/*.js',
      '**/*.test.js',
      '*.config.js',
      '*.setup.js',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Express error handlers must declare all four parameters to be recognised as
      // error middleware, so the trailing `next` is unavoidably unused.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
])
