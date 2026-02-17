/**
 * TDD Test Runner for WebContainer
 * 
 * Executes Vitest tests inside WebContainer and captures output.
 */

import { WebContainer } from '@webcontainer/api';

// ==================== TYPES ====================

export interface TestResult {
    success: boolean;
    logs: string;
    exitCode: number;
    duration: number;
    testFile?: string;
}

export interface TestRunnerConfig {
    timeout?: number;  // Default: 30000ms
    testCommand?: string;  // Default: 'npm run test'
}

// ==================== TEST RUNNER ====================

export class TDDTestRunner {
    private container: WebContainer | null = null;

    constructor(container: WebContainer) {
        this.container = container;
    }

    /**
     * Run a single test file and capture output
     */
    async runTest(testFile: string, config: TestRunnerConfig = {}): Promise<TestResult> {
        if (!this.container) {
            return {
                success: false,
                logs: 'WebContainer not initialized',
                exitCode: 1,
                duration: 0,
            };
        }

        const timeout = config.timeout || 30000;
        const startTime = Date.now();
        let logs = '';

        try {
            // Run vitest with the specific test file
            const process = await this.container.spawn('npx', ['vitest', 'run', testFile, '--reporter=verbose']);

            // Capture output
            const outputPromise = new Promise<void>((resolve) => {
                process.output.pipeTo(
                    new WritableStream({
                        write(data) {
                            logs += data;
                        },
                        close() {
                            resolve();
                        },
                    })
                );
            });

            // Race between process completion and timeout
            const exitCodePromise = process.exit;
            const timeoutPromise = new Promise<number>((_, reject) => {
                setTimeout(() => reject(new Error('Test timeout')), timeout);
            });

            const exitCode = await Promise.race([exitCodePromise, timeoutPromise]) as number;
            await outputPromise.catch(() => { }); // Ensure we capture remaining output

            const duration = Date.now() - startTime;

            return {
                success: exitCode === 0,
                logs,
                exitCode,
                duration,
                testFile,
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                success: false,
                logs: logs + '\n' + (error instanceof Error ? error.message : String(error)),
                exitCode: 1,
                duration,
                testFile,
            };
        }
    }

    /**
     * Run all tests in the project
     */
    async runAllTests(config: TestRunnerConfig = {}): Promise<TestResult> {
        if (!this.container) {
            return {
                success: false,
                logs: 'WebContainer not initialized',
                exitCode: 1,
                duration: 0,
            };
        }

        const timeout = config.timeout || 60000;
        const startTime = Date.now();
        let logs = '';

        try {
            const process = await this.container.spawn('npm', ['run', 'test']);

            process.output.pipeTo(
                new WritableStream({
                    write(data) {
                        logs += data;
                    },
                })
            );

            const exitCodePromise = process.exit;
            const timeoutPromise = new Promise<number>((_, reject) => {
                setTimeout(() => reject(new Error('Test timeout')), timeout);
            });

            const exitCode = await Promise.race([exitCodePromise, timeoutPromise]) as number;
            const duration = Date.now() - startTime;

            return {
                success: exitCode === 0,
                logs,
                exitCode,
                duration,
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                success: false,
                logs: logs + '\n' + (error instanceof Error ? error.message : String(error)),
                exitCode: 1,
                duration,
            };
        }
    }

    /**
     * Check if vitest is installed
     */
    async isVitestInstalled(): Promise<boolean> {
        if (!this.container) return false;

        try {
            const process = await this.container.spawn('npx', ['vitest', '--version']);
            const exitCode = await process.exit;
            return exitCode === 0;
        } catch {
            return false;
        }
    }
}

// ==================== VITEST CONFIG GENERATOR ====================

export function generateVitestConfig(): string {
    return `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
`;
}

export function generateTestSetup(): string {
    return `import '@testing-library/jest-dom';
`;
}

/**
 * Generate a sample test file for a React component
 */
export function generateComponentTest(componentName: string, expectedBehavior: string): string {
    return `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  it('${expectedBehavior}', () => {
    render(<${componentName} />);

    // NOTE: This is a generic smoke assertion. The agent should refine it
    // based on the component's actual contract (labels, text, roles, etc.).
    expect(document.body).toBeTruthy();

    // Prefer accessible queries when possible:
    // expect(screen.getByText(/.../i)).toBeInTheDocument();
    // expect(screen.getByRole('button', { name: /.../i })).toBeInTheDocument();
  });
});
`;
}
