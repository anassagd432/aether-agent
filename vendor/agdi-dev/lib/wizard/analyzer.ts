/**
 * Wizard Analyzer — AI-powered follow-up questions & spec synthesis
 *
 * Port of the CLI's "Intelligent Analyst Loop" from wizard.ts.
 * Calls the LLM to analyze vague answers and generate clarifying questions,
 * then synthesizes all answers into a detailed technical specification.
 */

import {
    type WizardAnswers,
    type AIFollowUp,
    APP_CATEGORY_META,
    AUDIENCE_META,
    FEATURE_META,
    STYLE_META,
    type AppCategory,
    type AudienceType,
    type AppFeature,
    type AppStyle,
} from './types';
import { createLogger } from '../logger';
import { isSupabaseConfigured } from '../supabase';

const log = createLogger('Wizard');

/**
 * Build a human-readable summary of the wizard answers
 */
export function summarizeAnswers(answers: WizardAnswers): string {
    const parts: string[] = [];

    if (answers.category) {
        parts.push(`**App Type:** ${APP_CATEGORY_META[answers.category].label}`);
    }
    if (answers.vision) {
        parts.push(`**Vision:** ${answers.vision}`);
    }
    if (answers.audience.length > 0) {
        const labels = answers.audience.map((a: AudienceType) => AUDIENCE_META[a].label);
        parts.push(`**Target Audience:** ${labels.join(', ')}`);
    }
    if (answers.features.length > 0) {
        const labels = answers.features.map((f: AppFeature) => FEATURE_META[f].label);
        parts.push(`**Features:** ${labels.join(', ')}`);

        // Add auth backend context if auth is selected
        if (answers.features.includes('auth' as AppFeature)) {
            if (isSupabaseConfigured()) {
                parts.push(`**Auth Backend:** Supabase (configured)`);
            } else {
                parts.push(`**Auth Backend:** Mock auth provider (React Context + localStorage) — Supabase is NOT configured`);
            }
        }
    }
    if (answers.style) {
        parts.push(`**Design Style:** ${STYLE_META[answers.style].label} — ${STYLE_META[answers.style].description}`);
    }

    return parts.join('\n');
}

/**
 * Ask the LLM if the spec is detailed enough, or generate follow-up questions
 */
export async function analyzeSpec(
    answers: WizardAnswers,
    generateFn: (prompt: string, systemPrompt: string) => Promise<string>
): Promise<{ isDetailed: boolean; questions: string[] }> {
    const summary = summarizeAnswers(answers);

    log.info('Analyzing wizard answers for completeness...');

    const systemPrompt = `You are a Senior Product Manager at a top SaaS company.
Analyze the following app specification from a non-technical business owner.

If the spec is vague or missing critical details, generate 2-3 SHORT, specific questions to clarify.
If the spec is detailed enough to build, respond with exactly: "DETAILED"

Rules:
- Questions should be answerable in one sentence
- Focus on: core user flow, key data entities, must-have vs nice-to-have features
- Do NOT ask about tech stack (you decide that)
- Do NOT ask questions already answered in the spec

Format your response as:
DETAILED
OR
1. [Question]
2. [Question]
3. [Question]`;

    try {
        const response = await generateFn(summary, systemPrompt);

        if (response.trim().toUpperCase().startsWith('DETAILED')) {
            log.info('Spec is detailed enough, proceeding to synthesis');
            return { isDetailed: true, questions: [] };
        }

        const questions = response
            .split('\n')
            .filter(line => line.match(/^\d+\.\s/))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(q => q.length > 5)
            .slice(0, 3);

        log.info(`Generated ${questions.length} follow-up questions`);
        return { isDetailed: false, questions };
    } catch (err) {
        log.warn('Analysis failed, proceeding without follow-ups');
        return { isDetailed: true, questions: [] };
    }
}

/**
 * Synthesize all wizard answers + follow-up answers into a full technical spec
 */
export async function synthesizeSpec(
    answers: WizardAnswers,
    followUps: AIFollowUp[],
    generateFn: (prompt: string, systemPrompt: string) => Promise<string>
): Promise<string> {
    const summary = summarizeAnswers(answers);

    const followUpSection = followUps.length > 0
        ? `\n\n**Clarifications:**\n${followUps.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`
        : '';

    // Auth context for the synthesis prompt
    const hasAuth = answers.features.includes('auth' as AppFeature);
    const authClause = hasAuth
        ? isSupabaseConfigured()
            ? '\n8. For authentication, use Supabase (@supabase/supabase-js). Environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are available.'
            : '\n8. For authentication, use a client-side mock auth provider (React Context + localStorage). Do NOT use Supabase or any external auth service. The mock should simulate login/signup with fake user objects stored in localStorage.'
        : '';

    const systemPrompt = `You are a Technical Architect and Full-Stack Senior Engineer.
Convert the following business requirements into a comprehensive technical specification for a React development squad.

You MUST include:
1. A clear project name and one-line description
2. Complete file structure (every file needed for a working MVP)
3. Key data models / entities
4. User flows (step by step)
5. Tech stack decisions (always use: React 19, TypeScript, Tailwind CSS, Vite)
6. API endpoints if needed
7. Design system tokens (colors, fonts, spacing) based on the chosen style${authClause}

Output a clean, structured specification. No code — just the blueprint.`;

    log.info('Synthesizing technical specification...');

    try {
        const spec = await generateFn(
            `${summary}${followUpSection}\n\nCreate a comprehensive technical specification for this application.`,
            systemPrompt
        );

        log.info('Spec synthesis complete');
        return spec;
    } catch (err) {
        log.warn('Synthesis failed, building from raw answers');
        return buildFallbackSpec(answers, followUps);
    }
}

/**
 * Fallback spec builder if LLM is unavailable
 */
function buildFallbackSpec(answers: WizardAnswers, followUps: AIFollowUp[]): string {
    const category = answers.category ? APP_CATEGORY_META[answers.category].label : 'Web Application';
    const features = answers.features.map((f: AppFeature) => FEATURE_META[f].label).join(', ');
    const style = answers.style ? STYLE_META[answers.style].label : 'Modern Dark';

    let spec = `Build a ${category} application.\n\n`;
    spec += `Vision: ${answers.vision}\n`;
    spec += `Features: ${features || 'Basic CRUD'}\n`;
    spec += `Design: ${style} theme\n`;
    spec += `Tech: React 19, TypeScript, Tailwind CSS, Vite\n`;

    if (followUps.length > 0) {
        spec += `\nAdditional Details:\n`;
        followUps.forEach(f => {
            spec += `- ${f.answer}\n`;
        });
    }

    return spec;
}
