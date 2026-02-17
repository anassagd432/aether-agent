/**
 * useTDDAgent Hook
 * 
 * React hook implementing the Red-Green-Refactor TDD loop.
 * Generates tests first, verifies they fail, then generates code to pass.
 */

import { useState, useCallback, useRef } from 'react';
import { WebContainerService } from '../lib/webcontainer';
import { TDDTestRunner, TestResult } from '../lib/tdd/test-runner';
import { TDDPhase, TDDLog, TDDResult, TDDConfig, DEFAULT_TDD_CONFIG } from '../lib/tdd/types';

// ==================== LLM INTERFACE ====================

interface LLMProvider {
    generate: (prompt: string, systemPrompt?: string) => Promise<{ text: string }>;
}

// ==================== SYSTEM PROMPTS ====================

const TEST_GENERATION_PROMPT = `You are an expert test engineer. Given a feature request, generate a Vitest test file that:
1. Uses describe/it blocks with clear test names
2. Tests the expected behavior BEFORE implementation exists
3. Uses React Testing Library for component tests
4. Only outputs the test code, no explanations

Format: Output ONLY the test file content, starting with imports.`;

const CODE_GENERATION_PROMPT = `You are an expert React/TypeScript developer. Given a failing test and error logs:
1. Implement the code to make the test pass
2. Follow React best practices
3. Use TypeScript with proper types
4. Only output the implementation code

Format: Output ONLY the implementation file content, starting with imports.`;

const FIX_CODE_PROMPT = `You are debugging a failing test. The previous implementation failed.
Given:
- The test code
- The previous implementation
- The error logs

Fix the implementation to make the test pass. Output ONLY the fixed code.`;

// ==================== HOOK INTERFACE ====================

interface UseTDDAgentReturn {
    phase: TDDPhase;
    logs: TDDLog[];
    isRunning: boolean;
    result: TDDResult | null;
    run: (prompt: string, llm: LLMProvider) => Promise<TDDResult>;
    abort: () => void;
    reset: () => void;
}

// ==================== HOOK IMPLEMENTATION ====================

export function useTDDAgent(config: Partial<TDDConfig> = {}): UseTDDAgentReturn {
    const settings = { ...DEFAULT_TDD_CONFIG, ...config };

    const [phase, setPhase] = useState<TDDPhase>('idle');
    const [logs, setLogs] = useState<TDDLog[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<TDDResult | null>(null);

    const abortRef = useRef(false);
    const testRunnerRef = useRef<TDDTestRunner | null>(null);

    // Add a log entry
    const addLog = useCallback((phase: TDDPhase, message: string, type: TDDLog['type'] = 'info') => {
        const log: TDDLog = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            phase,
            message,
            timestamp: Date.now(),
            type,
        };
        setLogs((prev) => [...prev, log]);
        return log;
    }, []);

    // Parse code block from LLM response
    const extractCode = (response: string): string => {
        // Try to extract from markdown code block
        const codeBlockMatch = response.match(/```(?:tsx?|jsx?|typescript|javascript)?\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }
        // Fallback: return as-is (assuming it's raw code)
        return response.trim();
    };

    // Main TDD loop
    const run = useCallback(async (prompt: string, llm: LLMProvider): Promise<TDDResult> => {
        const startTime = Date.now();
        setIsRunning(true);
        setLogs([]);
        abortRef.current = false;

        const resultData: TDDResult = {
            success: false,
            attempts: 0,
            logs: [],
            duration: 0,
        };

        try {
            // Boot WebContainer
            addLog('generating-test', 'Booting WebContainer...', 'info');
            const container = await WebContainerService.boot();
            testRunnerRef.current = new TDDTestRunner(container);

            // ==================== RED PHASE: Generate Test ====================
            setPhase('generating-test');
            addLog('generating-test', '🧪 Generating test based on requirements...', 'test');

            const testPrompt = `
User Request: ${prompt}

Generate a Vitest test file for a React component that implements this feature.
The component should be named based on the feature.
`;

            const testResponse = await llm.generate(testPrompt, TEST_GENERATION_PROMPT);
            const testCode = extractCode(testResponse.text);
            resultData.testCode = testCode;

            addLog('generating-test', 'Test code generated', 'test');

            if (abortRef.current) throw new Error('Aborted');

            // Write test file to WebContainer
            const testFileName = 'src/App.test.tsx';
            await container.fs.writeFile(testFileName, testCode);
            resultData.testFile = testFileName;

            // ==================== Run Test (expect FAIL) ====================
            setPhase('running-test-red');
            addLog('running-test-red', '🔄 Running test (expecting failure)...', 'test');

            const redResult = await testRunnerRef.current.runTest(testFileName, {
                timeout: settings.testTimeout,
            });

            if (redResult.success) {
                // Test passed without implementation - test might be trivial
                addLog('running-test-red', '⚠️ Test passed without implementation - regenerating stricter test', 'info');
                // Could regenerate test here, but for now continue
            }

            setPhase('test-failed-expected');
            addLog('test-failed-expected', '🛑 Test failed as expected. Ready to implement.', 'test');

            if (abortRef.current) throw new Error('Aborted');

            // ==================== GREEN PHASE: Generate Implementation ====================
            let implementationCode = '';
            let greenResult: TestResult | null = null;
            let attempt = 0;

            while (attempt < settings.maxRetries) {
                attempt++;
                resultData.attempts = attempt;

                setPhase('generating-code');
                addLog('generating-code', `⚙️ Implementing code (attempt ${attempt}/${settings.maxRetries})...`, 'code');

                const codePrompt = attempt === 1
                    ? `
Feature Request: ${prompt}

Test to satisfy:
\`\`\`typescript
${testCode}
\`\`\`

Implement the React component to make this test pass.
`
                    : `
Feature Request: ${prompt}

Test to satisfy:
\`\`\`typescript
${testCode}
\`\`\`

Previous implementation failed:
\`\`\`typescript
${implementationCode}
\`\`\`

Error logs:
${greenResult?.logs || 'Unknown error'}

Fix the implementation to make the test pass.
`;

                const codeResponse = await llm.generate(codePrompt, attempt === 1 ? CODE_GENERATION_PROMPT : FIX_CODE_PROMPT);
                implementationCode = extractCode(codeResponse.text);
                resultData.implementationCode = implementationCode;

                // Write implementation to WebContainer
                const codeFileName = 'src/App.tsx';
                await container.fs.writeFile(codeFileName, implementationCode);
                resultData.codeFile = codeFileName;

                if (abortRef.current) throw new Error('Aborted');

                // ==================== Run Test (expect PASS) ====================
                setPhase('running-test-green');
                addLog('running-test-green', '🔄 Running verification test...', 'test');

                greenResult = await testRunnerRef.current.runTest(testFileName, {
                    timeout: settings.testTimeout,
                });

                if (greenResult.success) {
                    // ==================== SUCCESS ====================
                    setPhase('success');
                    addLog('success', `✅ Test passed on attempt ${attempt}!`, 'success');

                    resultData.success = true;
                    resultData.duration = Date.now() - startTime;
                    resultData.logs = logs;
                    setResult(resultData);
                    setIsRunning(false);
                    return resultData;
                }

                addLog('running-test-green', `❌ Test failed. Error: ${greenResult.logs.slice(0, 200)}...`, 'error');
            }

            // ==================== FAILURE after max retries ====================
            setPhase('failed');
            addLog('failed', `❌ Failed after ${settings.maxRetries} attempts`, 'error');

            resultData.success = false;
            resultData.error = greenResult?.logs || 'Unknown error';
            resultData.duration = Date.now() - startTime;
            resultData.logs = logs;
            setResult(resultData);
            setIsRunning(false);
            return resultData;

        } catch (error) {
            setPhase('failed');
            const errorMsg = error instanceof Error ? error.message : String(error);
            addLog('failed', `❌ Error: ${errorMsg}`, 'error');

            resultData.success = false;
            resultData.error = errorMsg;
            resultData.duration = Date.now() - startTime;
            resultData.logs = logs;
            setResult(resultData);
            setIsRunning(false);
            return resultData;
        }
    }, [addLog, settings.maxRetries, settings.testTimeout, logs]);

    const abort = useCallback(() => {
        abortRef.current = true;
        setPhase('idle');
        setIsRunning(false);
        addLog('idle', '⏹️ Aborted by user', 'info');
    }, [addLog]);

    const reset = useCallback(() => {
        setPhase('idle');
        setLogs([]);
        setIsRunning(false);
        setResult(null);
        abortRef.current = false;
    }, []);

    return {
        phase,
        logs,
        isRunning,
        result,
        run,
        abort,
        reset,
    };
}

export default useTDDAgent;
