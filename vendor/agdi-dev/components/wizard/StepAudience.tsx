/**
 * StepAudience — Target audience selection pills
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AudienceType, AUDIENCE_META } from '../../lib/wizard/types';

interface StepAudienceProps {
    selected: AudienceType[];
    onToggle: (aud: AudienceType) => void;
}

const audiences = Object.entries(AUDIENCE_META) as [AudienceType, typeof AUDIENCE_META[AudienceType]][];

export const StepAudience: React.FC<StepAudienceProps> = ({ selected, onToggle }) => {
    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.h2
                className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                Who is this for?
            </motion.h2>
            <motion.p
                className="text-white/50 text-center mb-10 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                Select one or more target audiences
            </motion.p>

            <div className="flex flex-wrap justify-center gap-3">
                {audiences.map(([key, meta], i) => {
                    const isSelected = selected.includes(key);
                    return (
                        <motion.button
                            key={key}
                            onClick={() => onToggle(key)}
                            className={`group flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all duration-300 cursor-pointer ${isSelected
                                    ? 'border-amber-400/60 bg-cyan-400/10 shadow-lg shadow-amber-400/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08, duration: 0.4 }}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            <span className="text-2xl">{meta.icon}</span>
                            <span className={`font-medium text-sm transition-colors ${isSelected ? 'text-cyan-300' : 'text-white/70'}`}>
                                {meta.label}
                            </span>

                            {/* Toggle indicator */}
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ml-1 ${isSelected ? 'bg-cyan-400 border-amber-400' : 'border-white/20'
                                }`}>
                                {isSelected && (
                                    <motion.svg
                                        className="w-3 h-3 text-black"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500 }}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </motion.svg>
                                )}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
