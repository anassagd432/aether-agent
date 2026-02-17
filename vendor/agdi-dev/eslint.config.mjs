import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'packages/*/dist/**',
            'packages/cli/bin/**',
            '**/*.config.js',
            '**/*.config.cjs',
            '**/*.config.mjs',
            'tw-base/**',
        ],
    },

    // Base JS rules
    js.configs.recommended,

    // TypeScript rules
    ...tseslint.configs.recommended,

    // React hooks rules
    {
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            // This repo has lots of non-React hook usage in plain TS and server code.
            // Keeping this on produces significant noise; re-enable per-package when ready.
            'react-hooks/exhaustive-deps': 'off',
        },
    },

    // Project-specific overrides
    {
        rules: {
            // These rules are useful but currently produce hundreds of findings across the monorepo.
            // We keep lint actionable by turning them off globally; re-enable gradually per package.
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',

            // Allow empty catch blocks
            '@typescript-eslint/no-empty-function': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },

    // Disable formatting rules that conflict with Prettier
    prettier,
);
