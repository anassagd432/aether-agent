/**
 * Cloud Generate API — Vercel Serverless Function
 *
 * Server-side proxy that:
 *  1. Verifies Supabase JWT from Authorization header
 *  2. Reads user's plan tier from Supabase metadata
 *  3. Enforces plan limits (requests/day, requests/month, model access, prompt length)
 *  4. Selects the best AI model based on project type + plan tier
 *  5. Calls the AI API with server-side keys (never exposed to client)
 *  6. Returns the generated plan
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// ==================== ENV VARS ====================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ==================== PLAN LIMITS (mirrored from pricing config) ====================

type PlanTier = 'free' | 'pro' | 'business';

interface CloudLimits {
    requestsPerDay: number;
    requestsPerMonth: number;
    allowedModels: string[];
    maxPromptLength: number;
    priority: 'low' | 'normal' | 'high';
}

const PLAN_LIMITS: Record<PlanTier, CloudLimits> = {
    free: {
        requestsPerDay: 5,
        requestsPerMonth: 30,
        allowedModels: ['gemini-2.5-flash'],
        maxPromptLength: 2000,
        priority: 'low',
    },
    pro: {
        requestsPerDay: 50,
        requestsPerMonth: 500,
        allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        maxPromptLength: 5000,
        priority: 'normal',
    },
    business: {
        requestsPerDay: -1,
        requestsPerMonth: -1,
        allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'openai/gpt-4o'],
        maxPromptLength: 10000,
        priority: 'high',
    },
};

// ==================== IN-MEMORY USAGE TRACKING ====================
// NOTE: In production, replace with Supabase table or Redis

interface UsageEntry {
    daily: Map<string, number>;    // "YYYY-MM-DD" → count
    monthly: Map<string, number>;  // "YYYY-MM" → count
}

const usageStore = new Map<string, UsageEntry>();

function getUsage(userId: string): UsageEntry {
    if (!usageStore.has(userId)) {
        usageStore.set(userId, { daily: new Map(), monthly: new Map() });
    }
    return usageStore.get(userId)!;
}

function checkAndIncrementUsage(userId: string, limits: CloudLimits): { allowed: boolean; reason?: string } {
    const usage = getUsage(userId);
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);         // "2026-02-12"
    const monthKey = now.toISOString().slice(0, 7);        // "2026-02"

    const dailyCount = usage.daily.get(dayKey) || 0;
    const monthlyCount = usage.monthly.get(monthKey) || 0;

    // Check daily limit
    if (limits.requestsPerDay !== -1 && dailyCount >= limits.requestsPerDay) {
        return {
            allowed: false,
            reason: `Daily limit reached (${limits.requestsPerDay}/day). Upgrade your plan for more.`,
        };
    }

    // Check monthly limit
    if (limits.requestsPerMonth !== -1 && monthlyCount >= limits.requestsPerMonth) {
        return {
            allowed: false,
            reason: `Monthly limit reached (${limits.requestsPerMonth}/month). Upgrade your plan for more.`,
        };
    }

    // Increment
    usage.daily.set(dayKey, dailyCount + 1);
    usage.monthly.set(monthKey, monthlyCount + 1);

    return { allowed: true };
}

function getUsageCounts(userId: string): { daily: number; monthly: number } {
    const usage = getUsage(userId);
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    const monthKey = now.toISOString().slice(0, 7);
    return {
        daily: usage.daily.get(dayKey) || 0,
        monthly: usage.monthly.get(monthKey) || 0,
    };
}

// ==================== MODEL SELECTION ====================

function selectModel(
    projectType: string | undefined,
    allowedModels: string[]
): { id: string; provider: 'gemini' | 'openrouter' } {
    const complexTypes = ['saas', 'marketplace', 'ecommerce', 'dashboard'];
    const wantsComplex = projectType && complexTypes.includes(projectType);

    // Try best model first, filter by what the plan allows
    if (wantsComplex) {
        if (allowedModels.includes('openai/gpt-4o') && OPENROUTER_API_KEY) {
            return { id: 'openai/gpt-4o', provider: 'openrouter' };
        }
        if (allowedModels.includes('gemini-2.5-pro') && GEMINI_API_KEY) {
            return { id: 'gemini-2.5-pro', provider: 'gemini' };
        }
    }

    // Default → best allowed model
    if (allowedModels.includes('gemini-2.5-flash') && GEMINI_API_KEY) {
        return { id: 'gemini-2.5-flash', provider: 'gemini' };
    }
    if (OPENROUTER_API_KEY) {
        return { id: 'google/gemini-2.5-flash', provider: 'openrouter' };
    }

    throw new Error('No AI API keys configured on server');
}

// ==================== AI CALLS ====================

async function callGemini(prompt: string, modelId: string): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
        },
    });

    return response.text || '';
}

async function callOpenRouter(prompt: string, modelId: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://agdi-dev.vercel.app',
        },
        body: JSON.stringify({
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.7,
        }),
    });

    if (!response.ok) throw new Error(`OpenRouter error: ${response.statusText}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

// ==================== HANDLER ====================

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — locked to allowed origin
    const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://agdi-dev.vercel.app';
    const origin = req.headers.origin || '';
    const corsOrigin = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;

    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 1. REQUIRE authentication + email verification
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please sign in to use cloud AI models.',
                code: 'AUTH_REQUIRED',
            });
        }

        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            return res.status(503).json({
                success: false,
                error: 'Cloud AI service is not configured.',
                code: 'SERVICE_UNAVAILABLE',
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired auth token. Please sign in again.',
                code: 'INVALID_TOKEN',
            });
        }

        // Check email verification
        const emailConfirmed = data.user.email_confirmed_at;
        if (!emailConfirmed) {
            return res.status(403).json({
                success: false,
                error: 'Please verify your email before using cloud AI models. Check your inbox for the confirmation link.',
                code: 'EMAIL_NOT_VERIFIED',
            });
        }

        const userId = data.user.id;
        const planTier: PlanTier = (data.user.user_metadata?.plan_tier as PlanTier) || 'free';

        // 2. Get plan limits
        const limits = PLAN_LIMITS[planTier] || PLAN_LIMITS.free;

        // 3. Parse and sanitize request
        const { prompt: rawPrompt, projectType: rawProjectType } = req.body || {};

        if (!rawPrompt || typeof rawPrompt !== 'string') {
            return res.status(400).json({ success: false, error: 'Missing prompt' });
        }

        // Sanitize prompt — strip HTML, scripts, null bytes
        const prompt = rawPrompt
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/\0/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Validate projectType against whitelist
        const VALID_PROJECT_TYPES = ['saas', 'marketplace', 'ecommerce', 'dashboard', 'landing', 'portfolio', 'blog', 'tool'];
        const projectType = typeof rawProjectType === 'string' && VALID_PROJECT_TYPES.includes(rawProjectType)
            ? rawProjectType
            : undefined;

        if (!prompt) {
            return res.status(400).json({ success: false, error: 'Prompt is empty after sanitization' });
        }

        // 4. Enforce prompt length limit
        if (prompt.length > limits.maxPromptLength) {
            return res.status(413).json({
                success: false,
                error: `Prompt too long (${prompt.length} chars). Your ${planTier} plan allows up to ${limits.maxPromptLength} chars. Upgrade for more.`,
                plan: planTier,
                limit: limits.maxPromptLength,
            });
        }

        // 5. Enforce request rate limits
        const usageCheck = checkAndIncrementUsage(userId, limits);
        if (!usageCheck.allowed) {
            const counts = getUsageCounts(userId);
            return res.status(429).json({
                success: false,
                error: usageCheck.reason,
                plan: planTier,
                usage: counts,
                limits: {
                    daily: limits.requestsPerDay,
                    monthly: limits.requestsPerMonth,
                },
            });
        }

        // 6. Select model (restricted by plan)
        const model = selectModel(projectType, limits.allowedModels);

        // 7. Build the architect prompt
        const architectPrompt = `You are Agdi, an Expert Software Architect.
Your goal is to design a robust, scalable React application based on the user's request.

Output a JSON object with this structure:
{
  "explanation": "Brief overview of the app architecture",
  "files": [
    { "name": "filename.tsx", "path": "src/filename.tsx", "content": "full file content" }
  ],
  "dependencies": ["package-name"]
}

Rules:
1. Break the app into small, single-responsibility components.
2. ALWAYS include src/App.tsx, src/index.css, vite.config.ts, and README.md.
3. Ensure the file list is complete for a working MVP.
4. Use Tailwind CSS for styling.
5. Use TypeScript.

User request:
${prompt}`;

        // 8. Call the selected AI
        let rawResponse: string;
        if (model.provider === 'gemini') {
            rawResponse = await callGemini(architectPrompt, model.id);
        } else {
            rawResponse = await callOpenRouter(architectPrompt, model.id);
        }

        // 9. Parse and return
        const plan = JSON.parse(rawResponse);
        const counts = getUsageCounts(userId);

        return res.status(200).json({
            success: true,
            plan,
            model_used: model.id,
            usage: counts,
            limits: {
                daily: limits.requestsPerDay,
                monthly: limits.requestsPerMonth,
            },
        });

    } catch (error) {
        console.error('[Cloud Generate] Error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
}
