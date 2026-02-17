/**
 * StepFeatures — Multi-select feature cards with dependency awareness
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AppFeature, FEATURE_META } from '../../lib/wizard/types';

interface StepFeaturesProps {
    selected: AppFeature[];
    onToggle: (feat: AppFeature) => void;
}

const features = Object.entries(FEATURE_META) as [AppFeature, typeof FEATURE_META[AppFeature]][];

export const StepFeatures: React.FC<StepFeaturesProps> = ({ selected, onToggle }) => {
    const handleToggle = (feat: AppFeature) => {
        const meta = FEATURE_META[feat];

        // If selecting a feature with dependencies, auto-select them
        if (!selected.includes(feat) && meta.requires) {
            for (const dep of meta.requires) {
                if (!selected.includes(dep)) {
                    onToggle(dep);
                }
            }
        }

        onToggle(feat);
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <motion.h2
                className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                Pick your features
            </motion.h2>
            <motion.p
                className="text-white/50 text-center mb-10 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                Select the features your app needs — you can always add more later
            </motion.p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {features.map(([key, meta], i) => {
                    const isSelected = selected.includes(key);
                    const hasDeps = meta.requires && meta.requires.length > 0;
                    const depsLabel = hasDeps
                        ? `Requires: ${meta.requires!.map(d => FEATURE_META[d].label).join(', ')}`
                        : null;

                    return (
                        <motion.button
                            key={key}
                            onClick={() => handleToggle(key)}
                            className={`relative p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer ${isSelected
                                    ? 'border-emerald-400/60 bg-emerald-400/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.35 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-lg">{meta.icon}</span>
                                <span className={`font-semibold text-sm transition-colors ${isSelected ? 'text-emerald-300' : 'text-white/80'}`}>
                                    {meta.label}
                                </span>

                                {/* Checkbox */}
                                <div className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-emerald-400 border-emerald-400' : 'border-white/20'
                                    }`}>
                                    {isSelected && (
                                        <motion.svg
                                            className="w-2.5 h-2.5 text-black"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </motion.svg>
                                    )}
                                </div>
                            </div>
                            <p className="text-[11px] text-white/40 leading-relaxed">{meta.description}</p>
                            {depsLabel && (
                                <p className="text-[10px] text-cyan-400/60 mt-1">{depsLabel}</p>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            <motion.p
                className="text-center text-white/30 text-xs mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
            >
                {selected.length === 0 ? 'Skip this step if you\'re not sure' : `${selected.length} feature${selected.length > 1 ? 's' : ''} selected`}
            </motion.p>
        </div>
    );
};
