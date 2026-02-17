/**
 * ProgressBar — Wizard step indicator
 */

import React from 'react';
import { motion } from 'framer-motion';
import { WIZARD_PHASES, type WizardPhase } from '../../lib/wizard/types';

const STEP_LABELS: Record<string, string> = {
    userType: 'You',
    category: 'App Type',
    vision: 'Your Idea',
    audience: 'Audience',
    features: 'Features',
    style: 'Design',
    deploy: 'Deploy',
};

interface ProgressBarProps {
    currentPhase: WizardPhase;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentPhase }) => {
    const currentIndex = WIZARD_PHASES.indexOf(currentPhase);
    const progress = currentIndex >= 0 ? ((currentIndex) / (WIZARD_PHASES.length - 1)) * 100 : 0;

    return (
        <div className="w-full max-w-2xl mx-auto px-4">
            {/* Progress track */}
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-4">
                <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                        background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899)',
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
            </div>

            {/* Step dots */}
            <div className="flex justify-between items-center">
                {WIZARD_PHASES.map((phase, i) => {
                    const isCompleted = i < currentIndex;
                    const isCurrent = i === currentIndex;

                    return (
                        <div key={phase} className="flex flex-col items-center gap-1.5">
                            <motion.div
                                className={`w-3 h-3 rounded-full border-2 transition-colors duration-300 ${isCompleted
                                    ? 'bg-cyan-400 border-cyan-400'
                                    : isCurrent
                                        ? 'bg-transparent border-cyan-400'
                                        : 'bg-transparent border-white/20'
                                    }`}
                                animate={isCurrent ? { scale: [1, 1.3, 1] } : {}}
                                transition={{ repeat: Infinity, duration: 2 }}
                            />
                            <span
                                className={`text-[10px] font-medium tracking-wider uppercase transition-colors duration-300 hidden sm:block ${isCurrent
                                    ? 'text-cyan-400'
                                    : isCompleted
                                        ? 'text-white/60'
                                        : 'text-white/20'
                                    }`}
                            >
                                {STEP_LABELS[phase] || phase}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
