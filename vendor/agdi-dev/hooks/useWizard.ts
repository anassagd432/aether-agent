/**
 * useWizard — React hook managing the wizard state machine
 *
 * Handles step navigation, answer persistence, AI analysis,
 * and spec synthesis for the question-driven builder.
 */

import { useState, useCallback, useMemo } from 'react';
import {
    type WizardState,
    type WizardPhase,
    type WizardAnswers,
    type AIFollowUp,
    type AppCategory,
    type AudienceType,
    type AppFeature,
    type AppStyle,
    type DeployTarget,
    type UserType,
    INITIAL_WIZARD_STATE,
    WIZARD_PHASES,
} from '../lib/wizard/types';
import { analyzeSpec, synthesizeSpec } from '../lib/wizard/analyzer';

interface UseWizardReturn {
    state: WizardState;
    // Navigation
    currentStepIndex: number;
    totalSteps: number;
    canGoBack: boolean;
    canGoForward: boolean;
    goNext: () => void;
    goBack: () => void;
    // Setters
    setUserType: (type: UserType) => void;
    setCategory: (cat: AppCategory) => void;
    setVision: (vision: string) => void;
    toggleAudience: (aud: AudienceType) => void;
    toggleFeature: (feat: AppFeature) => void;
    setStyle: (style: AppStyle) => void;
    setDeployTarget: (target: DeployTarget) => void;
    // AI Analysis
    runAnalysis: () => Promise<void>;
    answerFollowUp: (index: number, answer: string) => void;
    submitFollowUps: () => Promise<void>;
    // Result
    startBuilding: () => void;
    reset: () => void;
}

export function useWizard(
    generateFn?: (prompt: string, systemPrompt: string) => Promise<string>
): UseWizardReturn {
    const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);

    const currentStepIndex = useMemo(
        () => WIZARD_PHASES.indexOf(state.phase as WizardPhase),
        [state.phase]
    );

    const totalSteps = WIZARD_PHASES.length;

    const canGoBack = currentStepIndex > 0 && state.phase !== 'analysis' && state.phase !== 'building';

    const canGoForward = useMemo(() => {
        const { answers, phase } = state;
        switch (phase) {
            case 'userType':
                return answers.userType !== null;
            case 'category':
                return answers.category !== null;
            case 'vision':
                return answers.vision.trim().length > 3;
            case 'audience':
                return answers.audience.length > 0;
            case 'features':
                return true; // Features are optional
            case 'style':
                return answers.style !== null;
            case 'deploy':
                return answers.deployTarget !== null;
            default:
                return false;
        }
    }, [state]);

    const goNext = useCallback(() => {
        setState(prev => {
            const idx = WIZARD_PHASES.indexOf(prev.phase as WizardPhase);
            if (idx < WIZARD_PHASES.length - 1) {
                return { ...prev, phase: WIZARD_PHASES[idx + 1] };
            }
            return prev;
        });
    }, []);

    const goBack = useCallback(() => {
        setState(prev => {
            const idx = WIZARD_PHASES.indexOf(prev.phase as WizardPhase);
            if (idx > 0) {
                return { ...prev, phase: WIZARD_PHASES[idx - 1] };
            }
            return prev;
        });
    }, []);

    // ==================== ANSWER SETTERS ====================

    const setUserType = useCallback((type: UserType) => {
        setState(prev => ({
            ...prev,
            answers: { ...prev.answers, userType: type },
        }));
    }, []);

    const setCategory = useCallback((cat: AppCategory) => {
        setState(prev => ({
            ...prev,
            answers: { ...prev.answers, category: cat },
        }));
    }, []);

    const setVision = useCallback((vision: string) => {
        setState(prev => ({
            ...prev,
            answers: { ...prev.answers, vision },
        }));
    }, []);

    const toggleAudience = useCallback((aud: AudienceType) => {
        setState(prev => {
            const current = prev.answers.audience;
            const updated = current.includes(aud)
                ? current.filter(a => a !== aud)
                : [...current, aud];
            return { ...prev, answers: { ...prev.answers, audience: updated } };
        });
    }, []);

    const toggleFeature = useCallback((feat: AppFeature) => {
        setState(prev => {
            const current = prev.answers.features;
            const updated = current.includes(feat)
                ? current.filter(f => f !== feat)
                : [...current, feat];
            return { ...prev, answers: { ...prev.answers, features: updated } };
        });
    }, []);

    const setStyle = useCallback((style: AppStyle) => {
        setState(prev => ({
            ...prev,
            answers: { ...prev.answers, style },
        }));
    }, []);

    const setDeployTarget = useCallback((target: DeployTarget) => {
        setState(prev => ({
            ...prev,
            answers: { ...prev.answers, deployTarget: target },
        }));
    }, []);

    // ==================== AI ANALYSIS ====================

    const runAnalysis = useCallback(async () => {
        setState(prev => ({ ...prev, phase: 'analysis', isAnalyzing: true, error: null }));

        if (!generateFn) {
            // No LLM available — go straight to build with fallback spec
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                synthesizedSpec: buildFallbackPrompt(prev.answers),
            }));
            return;
        }

        // Timeout helper — don't hang forever
        const withTimeout = <T,>(promise: Promise<T>, ms = 10000): Promise<T> =>
            Promise.race([
                promise,
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out')), ms)),
            ]);

        try {
            const result = await withTimeout(analyzeSpec(state.answers, generateFn));

            if (result.isDetailed || result.questions.length === 0) {
                // Spec is detailed enough OR no questions parsed — synthesize
                try {
                    const spec = await withTimeout(synthesizeSpec(state.answers, [], generateFn));
                    setState(prev => ({
                        ...prev,
                        isAnalyzing: false,
                        synthesizedSpec: spec,
                    }));
                } catch {
                    setState(prev => ({
                        ...prev,
                        isAnalyzing: false,
                        synthesizedSpec: buildFallbackPrompt(prev.answers),
                    }));
                }
            } else {
                // Got follow-up questions
                setState(prev => ({
                    ...prev,
                    isAnalyzing: false,
                    followUps: result.questions.map(q => ({ question: q, answer: '' })),
                }));
            }
        } catch {
            // Any failure (including timeout) — fallback to building
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                synthesizedSpec: buildFallbackPrompt(prev.answers),
            }));
        }
    }, [generateFn, state.answers]);

    const answerFollowUp = useCallback((index: number, answer: string) => {
        setState(prev => {
            const followUps = [...prev.followUps];
            if (followUps[index]) {
                followUps[index] = { ...followUps[index], answer };
            }
            return { ...prev, followUps };
        });
    }, []);

    const submitFollowUps = useCallback(async () => {
        if (!generateFn) {
            setState(prev => ({ ...prev, synthesizedSpec: buildFallbackPrompt(prev.answers) }));
            return;
        }

        setState(prev => ({ ...prev, isAnalyzing: true }));

        try {
            const spec = await synthesizeSpec(state.answers, state.followUps, generateFn);
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                synthesizedSpec: spec,
            }));
        } catch (err) {
            setState(prev => ({
                ...prev,
                isAnalyzing: false,
                error: err instanceof Error ? err.message : 'Synthesis failed',
                synthesizedSpec: buildFallbackPrompt(prev.answers),
            }));
        }
    }, [generateFn, state.answers, state.followUps]);

    // ==================== ACTIONS ====================

    const startBuilding = useCallback(() => {
        setState(prev => ({ ...prev, phase: 'building' }));
    }, []);

    const reset = useCallback(() => {
        setState(INITIAL_WIZARD_STATE);
    }, []);

    return {
        state,
        currentStepIndex,
        totalSteps,
        canGoBack,
        canGoForward,
        goNext,
        goBack,
        setUserType,
        setCategory,
        setVision,
        toggleAudience,
        toggleFeature,
        setStyle,
        setDeployTarget,
        runAnalysis,
        answerFollowUp,
        submitFollowUps,
        startBuilding,
        reset,
    };
}

// ==================== HELPERS ====================

function buildFallbackPrompt(answers: WizardAnswers): string {
    const parts: string[] = [];
    if (answers.category) parts.push(`Build a ${answers.category} application.`);
    if (answers.vision) parts.push(answers.vision);
    if (answers.features.length) parts.push(`Include: ${answers.features.join(', ')}`);
    if (answers.style) parts.push(`Design style: ${answers.style}`);
    return parts.join('\n') || 'Build a simple web application.';
}
