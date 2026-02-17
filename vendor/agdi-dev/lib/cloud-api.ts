/**
 * Cloud API — Client-side wrapper for the Agdi cloud proxy
 *
 * Requires authenticated user with verified email.
 * Business owners use this exclusively; developers can opt in.
 *
 * Error codes from server:
 *  - AUTH_REQUIRED      → not logged in
 *  - INVALID_TOKEN      → bad/expired JWT
 *  - EMAIL_NOT_VERIFIED → email not confirmed
 *  - RATE_LIMITED       → plan quota exceeded (429)
 */

import { getSupabase } from './supabase';
import type { AppPlan } from './agdi-architect';

const CLOUD_API_BASE = import.meta.env.VITE_CLOUD_API_URL || '/api';

export type CloudErrorCode =
    | 'AUTH_REQUIRED'
    | 'INVALID_TOKEN'
    | 'EMAIL_NOT_VERIFIED'
    | 'SERVICE_UNAVAILABLE'
    | 'RATE_LIMITED'
    | 'PROMPT_TOO_LONG'
    | 'UNKNOWN';

export class CloudAPIError extends Error {
    code: CloudErrorCode;
    status: number;
    usage?: { daily: number; monthly: number };
    limits?: { daily: number; monthly: number };

    constructor(message: string, code: CloudErrorCode, status: number, extra?: Record<string, unknown>) {
        super(message);
        this.name = 'CloudAPIError';
        this.code = code;
        this.status = status;
        this.usage = extra?.usage as { daily: number; monthly: number } | undefined;
        this.limits = extra?.limits as { daily: number; monthly: number } | undefined;
    }
}

interface CloudGenerateRequest {
    prompt: string;
    projectType?: string;
    userType: 'developer' | 'business_owner';
}

interface CloudGenerateResponse {
    success: boolean;
    plan?: AppPlan;
    error?: string;
    code?: string;
    model_used?: string;
    usage?: { daily: number; monthly: number };
    limits?: { daily: number; monthly: number };
}

/**
 * Call the cloud API proxy to generate an app plan.
 * Requires authentication with verified email.
 */
export async function callCloudAPI(
    prompt: string,
    projectType?: string,
    userType: 'developer' | 'business_owner' = 'business_owner'
): Promise<AppPlan> {
    const supabase = getSupabase();

    // Get auth token — required
    let token = '';
    if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || '';
    }

    if (!token) {
        throw new CloudAPIError(
            'Please sign in to use cloud AI models.',
            'AUTH_REQUIRED',
            401
        );
    }

    const response = await fetch(`${CLOUD_API_BASE}/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            prompt,
            projectType,
            userType,
        } satisfies CloudGenerateRequest),
    });

    // Parse the response body
    let data: CloudGenerateResponse;
    try {
        data = await response.json();
    } catch {
        throw new CloudAPIError(
            `Cloud API error (${response.status})`,
            'UNKNOWN',
            response.status
        );
    }

    // Handle specific error codes
    if (!response.ok || !data.success) {
        const errorCode = (data.code as CloudErrorCode) || 'UNKNOWN';
        const errorMsg = data.error || 'Cloud API request failed';

        throw new CloudAPIError(errorMsg, errorCode, response.status, {
            usage: data.usage,
            limits: data.limits,
        });
    }

    if (!data.plan) {
        throw new CloudAPIError('Cloud API returned no plan', 'UNKNOWN', 200);
    }

    return data.plan;
}

/**
 * Check if cloud API is available.
 */
export async function isCloudAPIAvailable(): Promise<boolean> {
    try {
        const response = await fetch(`${CLOUD_API_BASE}/generate`, {
            method: 'OPTIONS',
        });
        return response.ok || response.status === 204;
    } catch {
        return false;
    }
}
