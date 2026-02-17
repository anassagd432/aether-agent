import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['**/__tests__/**/*.test.ts', '**/*.test.ts', '**/*.test.tsx'],
        exclude: ['node_modules', 'dist', 'packages/**/node_modules', 'IDE'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['lib/**/*.ts', 'components/**/*.tsx'],
        },
    },
});
