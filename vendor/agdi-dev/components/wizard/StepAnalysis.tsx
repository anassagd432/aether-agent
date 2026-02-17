/**
 * StepAnalysis — AI follow-up questions with conversational UI
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIFollowUp } from '../../lib/wizard/types';

interface StepAnalysisProps {
    isAnalyzing: boolean;
    followUps: AIFollowUp[];
    synthesizedSpec: string | null;
    onAnswer: (index: number, answer: string) => void;
    onSubmit: () => void;
    onStartBuilding: () => void;
    error: string | null;
}

export const StepAnalysis: React.FC<StepAnalysisProps> = ({
    isAnalyzing,
    followUps,
    synthesizedSpec,
    onAnswer,
    onSubmit,
    onStartBuilding,
    error,
}) => {
    const [typedText, setTypedText] = useState('');
    const fullText = isAnalyzing ? 'Analyzing your requirements...' : 'I have a few questions to make your app perfect';

    // Typewriter effect
    useEffect(() => {
        setTypedText('');
        let i = 0;
        const interval = setInterval(() => {
            if (i < fullText.length) {
                setTypedText(fullText.slice(0, i + 1));
                i++;
            } else {
                clearInterval(interval);
            }
        }, 30);
        return () => clearInterval(interval);
    }, [fullText]);

    const allAnswered = followUps.every(f => f.answer.trim().length > 0);

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* AI Avatar & Status */}
            <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <motion.div
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center text-xl shrink-0"
                    animate={isAnalyzing ? { rotate: [0, 360] } : {}}
                    transition={isAnalyzing ? { repeat: Infinity, duration: 3, ease: 'linear' } : {}}
                >
                    🧠
                </motion.div>
                <div>
                    <p className="text-sm font-medium text-white">
                        {typedText}
                        {typedText.length < fullText.length && (
                            <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse" />
                        )}
                    </p>
                    {isAnalyzing && (
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-1">
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                                        animate={{ opacity: [0.3, 1, 0.3] }}
                                        transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                                    />
                                ))}
                            </div>
                            <span className="text-[11px] text-white/30">Thinking...</span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Error state */}
            {error && (
                <motion.div
                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    {error}
                </motion.div>
            )}

            {/* Follow-up Questions */}
            <AnimatePresence>
                {!isAnalyzing && followUps.length > 0 && !synthesizedSpec && (
                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        {followUps.map((followUp, i) => (
                            <motion.div
                                key={i}
                                className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 + i * 0.15 }}
                            >
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                    {followUp.question}
                                </label>
                                <input
                                    type="text"
                                    value={followUp.answer}
                                    onChange={(e) => onAnswer(i, e.target.value)}
                                    placeholder="Type your answer..."
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                                />
                            </motion.div>
                        ))}

                        <motion.button
                            onClick={onSubmit}
                            disabled={!allAnswered}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-400 to-cyan-500 text-white hover:shadow-lg hover:shadow-cyan-400/20 cursor-pointer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            Continue →
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Spec ready — launch button */}
            <AnimatePresence>
                {synthesizedSpec && (
                    <motion.div
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200 }}
                    >
                        <motion.div
                            className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-4xl"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        >
                            ✨
                        </motion.div>

                        <h3 className="text-2xl font-bold text-white mb-2">Your blueprint is ready!</h3>
                        <p className="text-white/50 text-sm mb-8">
                            The AI squad has understood your vision. Ready to build?
                        </p>

                        <motion.button
                            onClick={onStartBuilding}
                            className="px-10 py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-cyan-400 via-cyan-500 to-pink-500 text-white shadow-2xl shadow-cyan-400/30 hover:shadow-cyan-400/50 transition-all cursor-pointer"
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            🚀 Build My App
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
