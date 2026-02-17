/**
 * Agdi Security Permission Gate
 * 
 * Controls access to dangerous operations using a Zero-Trust model.
 * Inspired by MoltBot's bash-tools approval system.
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export type PermissionLevel = 'none' | 'ask' | 'always';
export type OperationType = 'exec' | 'write' | 'read' | 'net' | 'browser';

export interface PermissionRequest {
    id: string;
    type: OperationType;
    target: string;
    reason: string;
    timestamp: number;
    description: string;
}

export interface PermissionCheckCallback {
    (request: PermissionRequest): Promise<boolean>;
}

export class PermissionGate extends EventEmitter {
    private defaultLevel: PermissionLevel = 'ask';
    private requestCallback: PermissionCheckCallback | null = null;
    private allowedTargets: Set<string> = new Set();
    private blockedTargets: Set<string> = new Set(); // e.g., /etc/passwd, .env

    constructor() {
        super();
        // Default blocks
        this.blockTarget('.env');
        this.blockTarget('id_rsa');
    }

    /**
     * Set the callback for user approval
     */
    setRequestCallback(cb: PermissionCheckCallback) {
        this.requestCallback = cb;
    }

    allowTarget(target: string) {
        this.allowedTargets.add(target);
    }

    blockTarget(target: string) {
        this.blockedTargets.add(target);
    }

    /**
     * Check if an operation is allowed
     */
    async check(type: OperationType, target: string, reason: string): Promise<boolean> {
        // 1. Check blocked targets (Deny List)
        if (this.isBlocked(target)) {
            console.warn(`[Security] Blocked access to restricted target: ${target}`);
            return false;
        }

        // 2. Check allowed targets (Allow List)
        if (this.isAllowed(target)) {
            return true;
        }

        // 3. If no approval callback, default to deny for safety
        if (!this.requestCallback) {
            console.warn(`[Security] No permission callback set. Denying ${type} on ${target}`);
            return false;
        }

        // 4. Ask for approval
        const request: PermissionRequest = {
            id: crypto.randomUUID(),
            type,
            target,
            reason,
            timestamp: Date.now(),
            description: `${type.toUpperCase()} on ${target} (${reason})`
        };

        this.emit('permission_requested', request);

        try {
            const approved = await this.requestCallback(request);
            if (approved) {
                // Determine if we should whitelist this for future? 
                // For now, we don't auto-whitelist to be safe.
                this.emit('permission_granted', request);
                return true;
            } else {
                this.emit('permission_denied', request);
                return false;
            }
        } catch (error) {
            console.error('[Security] Permission check failed:', error);
            return false;
        }
    }

    private isBlocked(target: string): boolean {
        for (const blocked of this.blockedTargets) {
            if (target.includes(blocked)) return true;
        }
        return false;
    }

    private isAllowed(target: string): boolean {
        return this.allowedTargets.has(target);
    }
}

// Singleton
export const permissionGate = new PermissionGate();
