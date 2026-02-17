/**
 * usePermissions Hook
 * 
 * React hook for permission state and command approval.
 */

import { useState, useCallback, useEffect } from 'react';
import {
    permissionManager,
    type PermissionResult,
    type PermissionDecision,
    type AuditEvent,
    auditLogger,
} from '../lib/security';

// ==================== TYPES ====================

export interface PendingApproval {
    id: string;
    command: string;
    result: PermissionResult;
    onResolve: (approved: boolean, action?: string) => void;
}

export interface UsePermissionsReturn {
    // State
    pendingApproval: PendingApproval | null;
    isModalOpen: boolean;
    auditLogs: AuditEvent[];

    // Actions
    evaluateCommand: (command: string, cwd: string) => Promise<PermissionResult>;
    handleApprovalChoice: (choice: string) => void;
    dismissModal: () => void;
    trustWorkspace: (path: string) => void;
    clearSession: () => void;
}

// ==================== HOOK ====================

export function usePermissions(): UsePermissionsReturn {
    const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AuditEvent[]>([]);
    const [resolveRef, setResolveRef] = useState<((approved: boolean) => void) | null>(null);

    // Subscribe to audit events
    useEffect(() => {
        const unsubscribe = auditLogger.subscribe((event) => {
            setAuditLogs(prev => [...prev.slice(-100), event]);
        });
        return unsubscribe;
    }, []);

    /**
     * Evaluate a command and return permission result
     * If prompt is required, opens modal and waits for user
     */
    const evaluateCommand = useCallback(async (
        command: string,
        cwd: string
    ): Promise<PermissionResult> => {
        const result = permissionManager.evaluate(command, cwd);

        if (result.decision === 'prompt') {
            // Open modal and wait for user decision
            return new Promise((resolve) => {
                const approvalId = `approval-${Date.now()}`;

                setPendingApproval({
                    id: approvalId,
                    command,
                    result,
                    onResolve: (approved, action) => {
                        if (approved) {
                            // Handle different approval types
                            if (action === 'approve_session' && result.argv[0]) {
                                permissionManager.approveForSession(result.argv[0]);
                            }
                            if (action === 'approve_once' && result.commandHash) {
                                permissionManager.approveOnce(result.commandHash);
                            }
                            if (action === 'always_allow') {
                                permissionManager.addRule(
                                    `Allow ${result.argv.slice(0, 2).join(' ')}`,
                                    result.argv.slice(0, 2),
                                    'allow'
                                );
                            }
                            if (action === 'always_prompt') {
                                permissionManager.addRule(
                                    `Prompt ${result.argv.slice(0, 2).join(' ')}`,
                                    result.argv.slice(0, 2),
                                    'prompt'
                                );
                            }
                            if (action === 'always_forbid') {
                                permissionManager.addRule(
                                    `Forbid ${result.argv.slice(0, 2).join(' ')}`,
                                    result.argv.slice(0, 2),
                                    'deny'
                                );
                            }

                            auditLogger.logApproval(command, result.argv,
                                action === 'approve_session' ? 'session' :
                                    action?.startsWith('always') ? 'rule' : 'once'
                            );

                            resolve({ ...result, decision: 'allow' });
                        } else {
                            auditLogger.logDenial(command, result.argv);
                            resolve({ ...result, decision: 'deny' });
                        }

                        setPendingApproval(null);
                        setIsModalOpen(false);
                    },
                });

                setIsModalOpen(true);
            });
        }

        return result;
    }, []);

    /**
     * Handle user's approval choice
     */
    const handleApprovalChoice = useCallback((choice: string) => {
        if (!pendingApproval) return;

        const approved = choice !== 'deny';
        pendingApproval.onResolve(approved, choice);
    }, [pendingApproval]);

    /**
     * Dismiss modal (deny)
     */
    const dismissModal = useCallback(() => {
        if (pendingApproval) {
            pendingApproval.onResolve(false);
        }
        setIsModalOpen(false);
        setPendingApproval(null);
    }, [pendingApproval]);

    /**
     * Trust a workspace
     */
    const trustWorkspace = useCallback((path: string) => {
        permissionManager.trustWorkspace(path);
    }, []);

    /**
     * Clear session approvals
     */
    const clearSession = useCallback(() => {
        permissionManager.clearSession();
    }, []);

    return {
        pendingApproval,
        isModalOpen,
        auditLogs,
        evaluateCommand,
        handleApprovalChoice,
        dismissModal,
        trustWorkspace,
        clearSession,
    };
}

export default usePermissions;
