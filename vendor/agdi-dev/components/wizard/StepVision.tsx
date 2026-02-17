/**
 * StepVision — Business idea description input
 */

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface StepVisionProps {
    value: string;
    onChange: (value: string) => void;
}

const EXAMPLES = [
    'A project management tool like Trello',
    'An online store for handmade jewelry',
    'A booking platform for hair salons',
    'A real-time analytics dashboard',
    'A community forum for dog owners',
];

export const StepVision: React.FC<StepVisionProps> = ({ value, onChange }) => {
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Auto-focus with a slight delay for animation
        const timer = setTimeout(() => inputRef.current?.focus(), 400);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.h2
                className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                Describe your idea
            </motion.h2>
            <motion.p
                className="text-white/50 text-center mb-10 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                What does your business do? Just describe it naturally — no tech jargon needed
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
            >
                <textarea
                    ref={inputRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="e.g. I run a bakery and need a website where customers can view our menu, place custom cake orders, and book pickup times..."
                    className="w-full h-36 px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/10 text-white text-base placeholder:text-white/20 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 resize-none transition-all duration-300"
                    maxLength={500}
                />
                <div className="flex justify-between items-center mt-2 px-1">
                    <span className="text-[11px] text-white/20">Be as descriptive as you like</span>
                    <span className={`text-[11px] transition-colors ${value.length > 400 ? 'text-cyan-400' : 'text-white/20'}`}>
                        {value.length}/500
                    </span>
                </div>
            </motion.div>

            {/* Example chips */}
            <motion.div
                className="mt-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                <p className="text-[11px] text-white/30 uppercase tracking-wider mb-3 text-center">Need inspiration?</p>
                <div className="flex flex-wrap gap-2 justify-center">
                    {EXAMPLES.map((example, i) => (
                        <motion.button
                            key={i}
                            onClick={() => onChange(example)}
                            className="px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-white/50 hover:text-white/80 hover:border-white/20 hover:bg-white/[0.08] transition-all cursor-pointer"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 + i * 0.05 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {example}
                        </motion.button>
                    ))}
                </div>
            </motion.div>
        </div>
    );
};
