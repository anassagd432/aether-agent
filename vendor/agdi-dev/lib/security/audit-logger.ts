/**
 * Audit Logger
 * 
 * Structured logging for all permission decisions and command executions.
 */

import type {
    AuditEvent,
    AuditEventType,
    PermissionDecision,
    RiskTier
} from './types';

// ==================== AUDIT LOGGER ====================

const MAX_LOG_SIZE = 1000;
const MAX_OUTPUT_LENGTH = 5000;

class AuditLogger {
    private logs: AuditEvent[] = [];
    private listeners: Set<(event: AuditEvent) => void> = new Set();

    /**
     * Generate unique event ID
     */
    private generateId(): string {
        return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Log an event
     */
    log(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
        const fullEvent: AuditEvent = {
            ...event,
            id: this.generateId(),
            timestamp: Date.now(),
            // Truncate output if too long
            output: event.output ? event.output.substring(0, MAX_OUTPUT_LENGTH) : undefined,
        };

        this.logs.push(fullEvent);

        // Trim old logs
        if (this.logs.length > MAX_LOG_SIZE) {
            this.logs = this.logs.slice(-MAX_LOG_SIZE);
        }

        // Notify listeners
        this.listeners.forEach(listener => {
            try {
                listener(fullEvent);
            } catch (e) {
                console.error('Audit listener error:', e);
            }
        });

        // Also log to console in development
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
            console.log('[AUDIT]', fullEvent);
        }

        return fullEvent;
    }

    /**
     * Log a tool proposal
     */
    logProposal(command: string, argv: string[], cwd: string): AuditEvent {
        return this.log({
            type: 'tool_proposed',
            command,
            argv,
            cwd,
        });
    }

    /**
     * Log a permission decision
     */
    logDecision(
        command: string,
        argv: string[],
        decision: PermissionDecision,
        decisionSource: 'rule' | 'policy' | 'user' | 'session',
        riskTier: RiskTier,
        matchedRule?: string
    ): AuditEvent {
        return this.log({
            type: 'tool_decision',
            command,
            argv,
            decision,
            decisionSource,
            riskTier,
            matchedRule,
        });
    }

    /**
     * Log user approval
     */
    logApproval(
        command: string,
        argv: string[],
        approvalType: 'once' | 'session' | 'rule',
        approverIdentity: string = 'user'
    ): AuditEvent {
        return this.log({
            type: 'tool_approved',
            command,
            argv,
            decision: 'allow',
            decisionSource: 'user',
            approverIdentity,
            metadata: { approvalType },
        });
    }

    /**
     * Log user denial
     */
    logDenial(
        command: string,
        argv: string[],
        approverIdentity: string = 'user'
    ): AuditEvent {
        return this.log({
            type: 'tool_denied',
            command,
            argv,
            decision: 'deny',
            decisionSource: 'user',
            approverIdentity,
        });
    }

    /**
     * Log command execution result
     */
    logResult(
        command: string,
        argv: string[],
        success: boolean,
        duration: number,
        output?: string,
        error?: string
    ): AuditEvent {
        return this.log({
            type: 'tool_result',
            command,
            argv,
            success,
            duration,
            output,
            error,
        });
    }

    /**
     * Log rule addition
     */
    logRuleAdded(
        ruleId: string,
        pattern: string[],
        decision: PermissionDecision
    ): AuditEvent {
        return this.log({
            type: 'rule_added',
            metadata: { ruleId, pattern, decision },
        });
    }

    /**
     * Log session approval
     */
    logSessionApproval(toolType: string): AuditEvent {
        return this.log({
            type: 'session_approval',
            metadata: { toolType },
        });
    }

    /**
     * Subscribe to audit events
     */
    subscribe(listener: (event: AuditEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Get all logs
     */
    getLogs(): AuditEvent[] {
        return [...this.logs];
    }

    /**
     * Get logs by type
     */
    getLogsByType(type: AuditEventType): AuditEvent[] {
        return this.logs.filter(e => e.type === type);
    }

    /**
     * Get logs for a time range
     */
    getLogsInRange(startTime: number, endTime: number): AuditEvent[] {
        return this.logs.filter(e =>
            e.timestamp >= startTime && e.timestamp <= endTime
        );
    }

    /**
     * Export logs as JSON
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Clear all logs
     */
    clear(): void {
        this.logs = [];
    }
}

// ==================== SINGLETON ====================

export const auditLogger = new AuditLogger();
