/**
 * Agdi Permission Gate
 * 
 * The Zero-Trust security firewall that all skills and voice commands
 * must pass through. Even if the coding brain or voice interface wants
 * to execute a dangerous command, this gate MUST intercept it.
 * 
 * CRITICAL: No skill can bypass this gate.
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PermissionRequest {
    action: string;
    target: string;
    source: 'skill' | 'voice' | 'user' | 'system';
    riskLevel: RiskLevel;
    timestamp: number;
}

export interface PermissionResult {
    allowed: boolean;
    reason?: string;
    requiresConfirmation: boolean;
    confirmedBy?: 'user' | 'auto' | 'policy';
}

export interface AuditEntry {
    request: PermissionRequest;
    result: PermissionResult;
    timestamp: number;
}

export interface PermissionPolicy {
    /** Actions that are always allowed without confirmation */
    allowlist: string[];
    /** Actions that are always blocked */
    blocklist: string[];
    /** Actions that require user confirmation */
    confirmList: string[];
    /** Auto-approve low-risk actions */
    autoApproveLowRisk: boolean;
    /** Auto-approve medium-risk actions */
    autoApproveMediumRisk: boolean;
}

// =============================================================================
// DEFAULT POLICIES
// =============================================================================

export const DEFAULT_PERMISSION_POLICY: PermissionPolicy = {
    allowlist: [
        'read',
        'ls',
        'find',
        'grep',
        'web_search',
        'web_fetch',
    ],
    blocklist: [
        'rm -rf /',
        'rm -rf /*',
        'mkfs',
        'dd if=/dev/zero',
        ':(){:|:&};:',
        'format c:',
    ],
    confirmList: [
        'exec',
        'write',
        'edit',
        'delete',
        'install',
        'deploy',
        'publish',
        'push',
    ],
    autoApproveLowRisk: true,
    autoApproveMediumRisk: false,
};

// =============================================================================
// RISK CLASSIFIER
// =============================================================================

/**
 * Classify the risk level of an action
 */
export function classifyRisk(action: string, target: string): RiskLevel {
    const combined = `${action} ${target}`.toLowerCase();

    // CRITICAL: System-destroying operations
    const criticalPatterns = [
        /rm\s+-rf\s+[/~]/,
        /rm\s+--no-preserve-root/,
        /mkfs/,
        /dd\s+if=.*of=\/dev/,
        /:()\s*{\s*:\|:&\s*}\s*;:/,
        /format\s+c:/i,
        /del\s+\/s\s+\/q\s+c:\\/i,
        /drop\s+database/i,
        /delete\s+from\s+\w+\s*$/i,
    ];

    if (criticalPatterns.some(p => p.test(combined))) {
        return 'critical';
    }

    // HIGH: Destructive but recoverable
    const highPatterns = [
        /rm\s+-rf/,
        /delete/i,
        /deploy/i,
        /publish/i,
        /push\s+--force/i,
        /git\s+reset\s+--hard/i,
        /npm\s+publish/i,
        /overwrite/i,
    ];

    if (highPatterns.some(p => p.test(combined))) {
        return 'high';
    }

    // MEDIUM: Modifications
    const mediumPatterns = [
        /write/i,
        /edit/i,
        /modify/i,
        /update/i,
        /create/i,
        /install/i,
        /exec/i,
        /npm\s+install/i,
    ];

    if (mediumPatterns.some(p => p.test(combined))) {
        return 'medium';
    }

    // LOW: Read-only operations
    return 'low';
}

// =============================================================================
// PERMISSION GATE
// =============================================================================

/**
 * Permission Gate - The Zero-Trust firewall
 * All skills and voice commands MUST pass through this gate.
 */
export class PermissionGate extends EventEmitter {
    private policy: PermissionPolicy;
    private auditLog: AuditEntry[] = [];
    private pendingConfirmations: Map<string, {
        request: PermissionRequest;
        resolve: (confirmed: boolean) => void;
        timeout: NodeJS.Timeout;
    }> = new Map();
    private confirmationTimeout = 60000; // 1 minute

    constructor(policy: Partial<PermissionPolicy> = {}) {
        super();
        this.policy = { ...DEFAULT_PERMISSION_POLICY, ...policy };
    }

    /**
     * Check if an action is allowed
     */
    async check(action: string, target: string): Promise<PermissionResult> {
        const riskLevel = classifyRisk(action, target);

        const request: PermissionRequest = {
            action,
            target,
            source: 'skill',
            riskLevel,
            timestamp: Date.now(),
        };

        let result: PermissionResult;

        // Check blocklist first (always deny)
        if (this.isBlocked(action, target)) {
            result = {
                allowed: false,
                reason: 'Action is on the blocklist',
                requiresConfirmation: false,
            };
        }
        // Check allowlist (always allow)
        else if (this.isAllowed(action)) {
            result = {
                allowed: true,
                requiresConfirmation: false,
                confirmedBy: 'policy',
            };
        }
        // Auto-approve based on risk level
        else if (riskLevel === 'low' && this.policy.autoApproveLowRisk) {
            result = {
                allowed: true,
                requiresConfirmation: false,
                confirmedBy: 'auto',
            };
        }
        else if (riskLevel === 'medium' && this.policy.autoApproveMediumRisk) {
            result = {
                allowed: true,
                requiresConfirmation: false,
                confirmedBy: 'auto',
            };
        }
        // Critical risk always requires confirmation
        else if (riskLevel === 'critical') {
            result = {
                allowed: false,
                reason: 'Critical risk action requires explicit user confirmation',
                requiresConfirmation: true,
            };
        }
        // High risk requires confirmation
        else if (riskLevel === 'high') {
            result = {
                allowed: false,
                reason: 'High risk action requires user confirmation',
                requiresConfirmation: true,
            };
        }
        // Medium risk requires confirmation if not auto-approved
        else {
            result = {
                allowed: false,
                reason: 'Action requires user confirmation',
                requiresConfirmation: true,
            };
        }

        // Log the check
        this.logAudit(request, result);

        return result;
    }

    /**
     * Request user confirmation for an action
     */
    async requestConfirmation(action: string, target: string): Promise<boolean> {
        const riskLevel = classifyRisk(action, target);

        const request: PermissionRequest = {
            action,
            target,
            source: 'skill',
            riskLevel,
            timestamp: Date.now(),
        };

        // Emit confirmation request event
        this.emit('confirmation_required', request);

        // Create a unique ID for this request
        const confirmId = `${action}:${target}:${Date.now()}`;

        // Wait for user response
        return new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                this.pendingConfirmations.delete(confirmId);
                this.logAudit(request, {
                    allowed: false,
                    reason: 'Confirmation timed out',
                    requiresConfirmation: true,
                });
                resolve(false);
            }, this.confirmationTimeout);

            this.pendingConfirmations.set(confirmId, {
                request,
                resolve: (confirmed: boolean) => {
                    clearTimeout(timeout);
                    this.pendingConfirmations.delete(confirmId);
                    this.logAudit(request, {
                        allowed: confirmed,
                        reason: confirmed ? 'User confirmed' : 'User denied',
                        requiresConfirmation: true,
                        confirmedBy: 'user',
                    });
                    resolve(confirmed);
                },
                timeout,
            });
        });
    }

    /**
     * Confirm a pending request (called from UI)
     */
    confirmRequest(confirmId: string, confirmed: boolean): void {
        const pending = this.pendingConfirmations.get(confirmId);
        if (pending) {
            pending.resolve(confirmed);
        }
    }

    /**
     * Get all pending confirmation requests
     */
    getPendingConfirmations(): PermissionRequest[] {
        return Array.from(this.pendingConfirmations.values()).map(p => p.request);
    }

    /**
     * Check if action is on blocklist
     */
    private isBlocked(action: string, target: string): boolean {
        const combined = `${action} ${target}`;
        return this.policy.blocklist.some(pattern =>
            combined.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Check if action is on allowlist
     */
    private isAllowed(action: string): boolean {
        return this.policy.allowlist.some(allowed =>
            action.toLowerCase() === allowed.toLowerCase()
        );
    }

    /**
     * Log an audit entry
     */
    private logAudit(request: PermissionRequest, result: PermissionResult): void {
        const entry: AuditEntry = {
            request,
            result,
            timestamp: Date.now(),
        };

        this.auditLog.push(entry);
        this.emit('audit', entry);

        // Keep only last 1000 entries
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }
    }

    /**
     * Get audit log
     */
    getAuditLog(options?: { limit?: number; since?: number }): AuditEntry[] {
        let entries = [...this.auditLog];

        if (options?.since) {
            entries = entries.filter(e => e.timestamp >= options.since!);
        }

        if (options?.limit) {
            entries = entries.slice(-options.limit);
        }

        return entries;
    }

    /**
     * Clear audit log
     */
    clearAuditLog(): void {
        this.auditLog = [];
    }

    /**
     * Update policy
     */
    updatePolicy(updates: Partial<PermissionPolicy>): void {
        this.policy = { ...this.policy, ...updates };
        this.emit('policy_updated', this.policy);
    }

    /**
     * Get current policy
     */
    getPolicy(): PermissionPolicy {
        return { ...this.policy };
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let gateInstance: PermissionGate | null = null;

/**
 * Get the global permission gate instance
 */
export function getPermissionGate(): PermissionGate {
    if (!gateInstance) {
        gateInstance = new PermissionGate();
    }
    return gateInstance;
}

/**
 * Reset the global permission gate instance
 */
export function resetPermissionGate(): void {
    gateInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    PermissionGate,
    getPermissionGate,
    resetPermissionGate,
    classifyRisk,
    DEFAULT_PERMISSION_POLICY,
};
