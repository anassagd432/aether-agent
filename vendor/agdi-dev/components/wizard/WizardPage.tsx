/**
 * WizardPage — Full-screen wizard experience
 *
 * Orchestrates all wizard steps with animated transitions,
 * floating particle background, and navigation controls.
 */

import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWizard } from '../../hooks/useWizard';
import { ProgressBar } from './ProgressBar';
import StepUserType from './StepUserType';
import { StepCategory } from './StepCategory';
import { StepVision } from './StepVision';
import { StepAudience } from './StepAudience';
import { StepFeatures } from './StepFeatures';
import { StepStyle } from './StepStyle';
import { StepDeploy } from './StepDeploy';
import { StepAnalysis } from './StepAnalysis';
import { UserType, type WizardPhase } from '../../lib/wizard/types';

interface WizardPageProps {
    onBack?: () => void;
    onComplete: (spec: string, userType: 'developer' | 'business_owner') => void;
}

// Floating particles background
const Particles: React.FC = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                    width: Math.random() * 3 + 1,
                    height: Math.random() * 3 + 1,
                    background: `rgba(${Math.random() > 0.5 ? '6,182,212' : '139,92,246'}, ${Math.random() * 0.3 + 0.1})`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                }}
                animate={{
                    y: [0, -30 - Math.random() * 40, 0],
                    x: [0, (Math.random() - 0.5) * 20, 0],
                    opacity: [0.2, 0.6, 0.2],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 4 + Math.random() * 6,
                    delay: Math.random() * 3,
                    ease: 'easeInOut',
                }}
            />
        ))}
    </div>
);

// Step transition animation
const stepVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 80 : -80,
        opacity: 0,
        scale: 0.98,
    }),
    center: {
        x: 0,
        opacity: 1,
        scale: 1,
    },
    exit: (direction: number) => ({
        x: direction > 0 ? -80 : 80,
        opacity: 0,
        scale: 0.98,
    }),
};

export const WizardPage: React.FC<WizardPageProps> = ({ onBack, onComplete }) => {
    // LLM generate function — uses the existing architect's plan generation
    const generateFn = useCallback(async (prompt: string, systemPrompt: string): Promise<string> => {
        try {
            const { generateAppPlan } = await import('../../lib/agdi-architect');
            const plan = await generateAppPlan(`${systemPrompt}\n\n${prompt}`);
            return plan?.explanation || prompt;
        } catch {
            return prompt;
        }
    }, []);

    const wizard = useWizard(generateFn);
    const { state, currentStepIndex } = wizard;

    // Track direction for animation
    const [direction, setDirection] = React.useState(0);

    const handleNext = useCallback(() => {
        setDirection(1);
        if (state.phase === 'deploy') {
            // Last step before analysis — trigger AI
            wizard.runAnalysis();
        } else {
            wizard.goNext();
        }
    }, [state.phase, wizard]);

    const handleBack = useCallback(() => {
        setDirection(-1);
        wizard.goBack();
    }, [wizard]);

    const handleBuild = useCallback(() => {
        if (state.synthesizedSpec) {
            const userType = state.answers.userType === UserType.DEVELOPER ? 'developer' : 'business_owner';
            onComplete(state.synthesizedSpec, userType as 'developer' | 'business_owner');
        }
    }, [state.synthesizedSpec, state.answers.userType, onComplete]);

    // Render current step
    const renderStep = useMemo(() => {
        switch (state.phase) {
            case 'userType':
                return <StepUserType value={state.answers.userType} onChange={wizard.setUserType} />;
            case 'category':
                return <StepCategory selected={state.answers.category} onSelect={wizard.setCategory} />;
            case 'vision':
                return <StepVision value={state.answers.vision} onChange={wizard.setVision} />;
            case 'audience':
                return <StepAudience selected={state.answers.audience} onToggle={wizard.toggleAudience} />;
            case 'features':
                return <StepFeatures selected={state.answers.features} onToggle={wizard.toggleFeature} />;
            case 'style':
                return <StepStyle selected={state.answers.style} onSelect={wizard.setStyle} />;
            case 'deploy':
                return <StepDeploy selected={state.answers.deployTarget} onSelect={wizard.setDeployTarget} />;
            case 'analysis':
            case 'building':
                return (
                    <StepAnalysis
                        isAnalyzing={state.isAnalyzing}
                        followUps={state.followUps}
                        synthesizedSpec={state.synthesizedSpec}
                        onAnswer={wizard.answerFollowUp}
                        onSubmit={wizard.submitFollowUps}
                        onStartBuilding={handleBuild}
                        error={state.error}
                    />
                );
            default:
                return null;
        }
    }, [state, wizard, handleBuild]);

    const showNav = state.phase !== 'analysis' && state.phase !== 'building';

    return (
        <div className="fixed inset-0 bg-[#07080f] flex flex-col z-50">
            <Particles />

            {/* Top bar */}
            <header className="relative z-10 flex items-center justify-between px-6 py-4">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-white/40 hover:text-white/80 transition-colors text-sm cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                </button>

                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs text-white/40 font-mono tracking-wider">AGDI WIZARD</span>
                </div>
            </header>

            {/* Progress bar */}
            {showNav && (
                <div className="relative z-10 py-4">
                    <ProgressBar currentPhase={state.phase as WizardPhase} />
                </div>
            )}

            {/* Step content */}
            <div className="flex-1 relative z-10 flex items-center justify-center overflow-hidden px-4 py-8">
                <AnimatePresence custom={direction} mode="wait">
                    <motion.div
                        key={state.phase}
                        custom={direction}
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="w-full"
                    >
                        {renderStep}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom navigation */}
            {showNav && (
                <footer className="relative z-10 flex items-center justify-between px-6 py-5 border-t border-white/5">
                    <button
                        onClick={handleBack}
                        disabled={!wizard.canGoBack}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/80 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                        ← Previous
                    </button>

                    <motion.button
                        onClick={handleNext}
                        disabled={!wizard.canGoForward}
                        className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-400 to-cyan-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-400/20 hover:shadow-cyan-400/40 cursor-pointer"
                        whileHover={{ scale: wizard.canGoForward ? 1.03 : 1 }}
                        whileTap={{ scale: wizard.canGoForward ? 0.97 : 1 }}
                    >
                        {state.phase === 'deploy' ? 'Generate →' : 'Next →'}
                    </motion.button>
                </footer>
            )}
        </div>
    );
};
