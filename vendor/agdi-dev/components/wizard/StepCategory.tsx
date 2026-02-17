/**
 * StepCategory — App type selection with animated cards
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AppCategory, APP_CATEGORY_META } from '../../lib/wizard/types';

interface StepCategoryProps {
    selected: AppCategory | null;
    onSelect: (cat: AppCategory) => void;
}

const categories = Object.entries(APP_CATEGORY_META) as [AppCategory, typeof APP_CATEGORY_META[AppCategory]][];

export const StepCategory: React.FC<StepCategoryProps> = ({ selected, onSelect }) => {
    return (
        <div className="w-full max-w-3xl mx-auto">
            <motion.h2
                className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                What are you building?
            </motion.h2>
            <motion.p
                className="text-white/50 text-center mb-10 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                Select the type of app that best describes your project
            </motion.p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {categories.map(([key, meta], i) => {
                    const isSelected = selected === key;
                    return (
                        <motion.button
                            key={key}
                            onClick={() => onSelect(key)}
                            className={`relative group p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${isSelected
                                    ? 'border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-400/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.4 }}
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <motion.div
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center"
                                    layoutId="category-check"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 500 }}
                                >
                                    <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </motion.div>
                            )}

                            <div className="text-2xl mb-3">{meta.icon}</div>
                            <div className={`font-semibold text-sm mb-1 transition-colors ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                                {meta.label}
                            </div>
                            <div className="text-[11px] text-white/40 leading-relaxed">
                                {meta.description}
                            </div>

                            {/* Glow effect */}
                            {isSelected && (
                                <div className="absolute inset-0 rounded-2xl bg-cyan-400/5 pointer-events-none" />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
