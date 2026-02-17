/**
 * TDD Types
 */

export type TDDPhase =
    | 'idle'
    | 'generating-test'
    | 'running-test-red'
    | 'test-failed-expected'
    | 'generating-code'
    | 'running-test-green'
    | 'verifying'
    | 'success'
    | 'failed';

export interface TDDLog {
    id: string;
    phase: TDDPhase;
    message: string;
    timestamp: number;
    type: 'info' | 'test' | 'code' | 'error' | 'success';
}

export interface TDDResult {
    success: boolean;
    testFile?: string;
    codeFile?: string;
    testCode?: string;
    implementationCode?: string;
    attempts: number;
    logs: TDDLog[];
    error?: string;
    duration: number;
}

export interface TDDConfig {
    maxRetries: number;
    testTimeout: number;
}

export const DEFAULT_TDD_CONFIG: TDDConfig = {
    maxRetries: 3,
    testTimeout: 30000,
};

// Phase UI colors and icons
export const PHASE_STYLES: Record<TDDPhase, { color: string; icon: string; label: string }> = {
    'idle': { color: 'text-slate-400', icon: '⏸️', label: 'Ready' },
    'generating-test': { color: 'text-yellow-400', icon: '🧪', label: 'Architecting Tests...' },
    'running-test-red': { color: 'text-yellow-400', icon: '🔄', label: 'Running Test...' },
    'test-failed-expected': { color: 'text-red-400', icon: '🛑', label: 'Test Failed (Expected)' },
    'generating-code': { color: 'text-blue-400', icon: '⚙️', label: 'Implementing Logic...' },
    'running-test-green': { color: 'text-blue-400', icon: '🔄', label: 'Verifying...' },
    'verifying': { color: 'text-cyan-400', icon: '✨', label: 'Finalizing...' },
    'success': { color: 'text-green-400', icon: '✅', label: 'Verification Passed!' },
    'failed': { color: 'text-red-400', icon: '❌', label: 'Failed' },
};
