/**
 * StepStyle — Theme preview picker with live color previews
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AppStyle, STYLE_META } from '../../lib/wizard/types';

interface StepStyleProps {
    selected: AppStyle | null;
    onSelect: (style: AppStyle) => void;
}

const styles = Object.entries(STYLE_META) as [AppStyle, typeof STYLE_META[AppStyle]][];

export const StepStyle: React.FC<StepStyleProps> = ({ selected, onSelect }) => {
    return (
        <div className="w-full max-w-3xl mx-auto">
            <motion.h2
                className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                Choose your style
            </motion.h2>
            <motion.p
                className="text-white/50 text-center mb-10 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                Pick a design theme — this sets the look and feel of your app
            </motion.p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {styles.map(([key, meta], i) => {
                    const isSelected = selected === key;
                    const [bg, accent] = meta.colors;

                    return (
                        <motion.button
                            key={key}
                            onClick={() => onSelect(key)}
                            className={`relative overflow-hidden rounded-2xl border text-left transition-all duration-300 cursor-pointer ${isSelected
                                    ? 'border-white/40 shadow-xl ring-2 ring-white/20'
                                    : 'border-white/10 hover:border-white/20'
                                }`}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08, duration: 0.4 }}
                            whileHover={{ scale: 1.03, y: -3 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Mini preview mockup */}
                            <div
                                className="h-28 p-3 relative"
                                style={{ background: bg }}
                            >
                                {/* Tiny nav bar */}
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                                    <div className="h-1 w-8 rounded-full" style={{ background: accent, opacity: 0.4 }} />
                                    <div className="ml-auto flex gap-1">
                                        <div className="h-1 w-4 rounded-full" style={{ background: accent, opacity: 0.3 }} />
                                        <div className="h-1 w-4 rounded-full" style={{ background: accent, opacity: 0.3 }} />
                                    </div>
                                </div>
                                {/* Tiny content blocks */}
                                <div className="space-y-1.5">
                                    <div className="h-2 w-20 rounded-full" style={{ background: accent, opacity: 0.6 }} />
                                    <div className="h-1 w-full rounded-full" style={{ background: accent, opacity: 0.15 }} />
                                    <div className="h-1 w-3/4 rounded-full" style={{ background: accent, opacity: 0.15 }} />
                                    <div className="flex gap-1 mt-2">
                                        <div className="h-4 w-10 rounded" style={{ background: accent }} />
                                        <div className="h-4 w-10 rounded border" style={{ borderColor: accent, opacity: 0.4 }} />
                                    </div>
                                </div>

                                {/* Selected overlay */}
                                {isSelected && (
                                    <motion.div
                                        className="absolute inset-0 bg-white/10 flex items-center justify-center"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <motion.div
                                            className="w-8 h-8 rounded-full bg-white flex items-center justify-center"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                        >
                                            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Label */}
                            <div className="p-3 bg-white/[0.03]">
                                <div className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-white/70'}`}>
                                    {meta.label}
                                </div>
                                <div className="text-[11px] text-white/40">{meta.description}</div>
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
