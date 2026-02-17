/**
 * Audit Logger - OWASP-aligned command logging
 * 
 * Logs all permission decisions, command executions, and results.
 */

import { existsSync, appendFileSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { RiskTier, GateResult } from './permission-gate.js';

// ==================== TYPES ====================

export type AuditEventType =
    | 'session_start'
    | 'session_end'
    | 'trust_prompt'
    | 'trust_decision'
    | 'gate_evaluation'
    | 'approval_request'
    | 'approval_decision'
    | 'command_start'
    | 'command_result'
    | 'rule_created'
    | 'rule_deleted';

export type ApprovalChoice =
    | 'approve_once'
    | 'approve_session'
    | 'always_allow'
    | 'always_prompt'
    | 'always_forbid'
    | 'deny';

export interface AuditEvent {
    timestamp: string;
    sessionId: string;
    eventType: AuditEventType;
    command?: string;
    cwd?: string;
    riskTier?: RiskTier;
    decision?: string;
    userAction?: ApprovalChoice;
    result?: {
        exitCode?: number;
        output?: string;
        error?: string;
        duration?: number;
    };
    metadata?: Record<string, unknown>;
}

// ==================== CONFIGURATION ====================

const LOG_DIR = join(homedir(), '.agdi');
const LOG_FILE = join(LOG_DIR, 'audit.jsonl');
const MAX_OUTPUT_LENGTH = 1000;

// ==================== SESSION STATE ====================

let currentSessionId: string | null = null;

/**
 * Generate a session ID
 */
function generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get or create session ID
 */
export function getSessionId(): string {
    if (!currentSessionId) {
        currentSessionId = generateSessionId();
    }
    return currentSessionId;
}

// ==================== LOGGING ====================

/**
 * Ensure log directory exists
 */
function ensureLogDir(): void {
    if (!existsSync(LOG_DIR)) {
        mkdirSync(LOG_DIR, { recursive: true });
    }
}

/**
 * Truncate output for logging
 */
function truncateOutput(output: string | undefined): string | undefined {
    if (!output) return output;
    if (output.length <= MAX_OUTPUT_LENGTH) return output;
    return output.substring(0, MAX_OUTPUT_LENGTH) + `... (truncated, ${output.length} total chars)`;
}

/**
 * Log an audit event
 */
export function logEvent(event: Omit<AuditEvent, 'timestamp' | 'sessionId'>): void {
    ensureLogDir();

    const fullEvent: AuditEvent = {
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        ...event,
    };

    // Truncate output if present
    if (fullEvent.result?.output) {
        fullEvent.result.output = truncateOutput(fullEvent.result.output);
    }

    try {
        appendFileSync(LOG_FILE, JSON.stringify(fullEvent) + '\n');
    } catch (error) {
        // Silent fail - don't break execution for logging
        console.error('Failed to write audit log:', error);
    }
}

// ==================== CONVENIENCE LOGGERS ====================

/**
 * Log session start
 */
export function logSessionStart(workspacePath: string, trustLevel: string): void {
    currentSessionId = generateSessionId();
    logEvent({
        eventType: 'session_start',
        metadata: {
            workspacePath,
            trustLevel,
            platform: process.platform,
            nodeVersion: process.version,
        },
    });
}

/**
 * Log session end
 */
export function logSessionEnd(): void {
    logEvent({
        eventType: 'session_end',
    });
}

/**
 * Log gate evaluation
 */
export function logGateEvaluation(result: GateResult): void {
    logEvent({
        eventType: 'gate_evaluation',
        command: result.command,
        cwd: result.cwd,
        riskTier: result.riskTier,
        decision: result.decision,
        metadata: {
            paths: result.paths,
            domains: result.domains,
            ports: result.ports,
            violations: result.violations,
            matchedRuleId: result.matchedRuleId,
        },
    });
}

/**
 * Log approval request
 */
export function logApprovalRequest(result: GateResult, reason: string): void {
    logEvent({
        eventType: 'approval_request',
        command: result.command,
        cwd: result.cwd,
        riskTier: result.riskTier,
        metadata: {
            reason,
            sideEffects: {
                paths: result.paths,
                domains: result.domains,
                ports: result.ports,
            },
        },
    });
}

/**
 * Log approval decision
 */
export function logApprovalDecision(result: GateResult, choice: ApprovalChoice): void {
    logEvent({
        eventType: 'approval_decision',
        command: result.command,
        userAction: choice,
        riskTier: result.riskTier,
    });
}

/**
 * Log command execution result
 */
export function logCommandResult(
    command: string,
    exitCode: number,
    output: string,
    error: string | undefined,
    durationMs: number
): void {
    logEvent({
        eventType: 'command_result',
        command,
        result: {
            exitCode,
            output: truncateOutput(output),
            error: truncateOutput(error),
            duration: durationMs,
        },
    });
}

// ==================== LOG READING ====================

/**
 * Read all audit events
 */
export function readAuditLog(): AuditEvent[] {
    if (!existsSync(LOG_FILE)) {
        return [];
    }

    try {
        const content = readFileSync(LOG_FILE, 'utf-8');
        return content
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line));
    } catch {
        return [];
    }
}

/**
 * Read events for current session
 */
export function readCurrentSessionEvents(): AuditEvent[] {
    const events = readAuditLog();
    return events.filter(e => e.sessionId === getSessionId());
}

/**
 * Export audit log as JSON
 */
export function exportAuditLogJSON(): string {
    const events = readAuditLog();
    return JSON.stringify(events, null, 2);
}

/**
 * Export audit log as CSV
 */
export function exportAuditLogCSV(): string {
    const events = readAuditLog();
    const headers = ['timestamp', 'sessionId', 'eventType', 'command', 'riskTier', 'decision', 'userAction'];

    const rows = events.map(e => [
        e.timestamp,
        e.sessionId,
        e.eventType,
        e.command || '',
        e.riskTier?.toString() || '',
        e.decision || '',
        e.userAction || '',
    ]);

    return [
        headers.join(','),
        ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
}

/**
 * Clear audit log
 */
export function clearAuditLog(): void {
    ensureLogDir();
    writeFileSync(LOG_FILE, '');
}
