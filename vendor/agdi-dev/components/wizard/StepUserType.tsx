/**
 * StepUserType — Developer vs Business Owner selection
 *
 * The very first wizard step. Determines whether the user
 * sees the full IDE (developer) or simplified builder (business owner).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { UserType } from '../../lib/wizard/types';

interface StepUserTypeProps {
    value: UserType | null;
    onChange: (type: UserType) => void;
}

const USER_TYPES = [
    {
        type: UserType.DEVELOPER,
        label: 'I\'m a Developer',
        icon: '👨‍💻',
        description: 'I want full control — show me the code, terminal, and IDE.',
        features: ['Code editor', 'Terminal access', 'File tree', 'Custom edits'],
        gradient: 'from-cyan-500 to-blue-600',
        glowColor: 'shadow-cyan-500/20',
        borderColor: 'border-cyan-500/30',
        bgColor: 'bg-cyan-500/5',
    },
    {
        type: UserType.BUSINESS_OWNER,
        label: 'I\'m a Business Owner',
        icon: '💼',
        description: 'Just build it for me — I\'ll review the final result.',
        features: ['Simple progress view', 'No code needed', 'Live preview', 'One-click deploy'],
        gradient: 'from-cyan-500 to-pink-500',
        glowColor: 'shadow-cyan-500/20',
        borderColor: 'border-cyan-500/30',
        bgColor: 'bg-amber-500/5',
    },
];

const StepUserType: React.FC<StepUserTypeProps> = ({ value, onChange }) => {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">
                    How do you want to build?
                </h2>
                <p className="text-slate-400 text-sm">
                    This helps us tailor the experience to you.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                {USER_TYPES.map((ut, i) => {
                    const isSelected = value === ut.type;
                    return (
                        <motion.button
                            key={ut.type}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.15, type: 'spring', stiffness: 300, damping: 25 }}
                            onClick={() => onChange(ut.type)}
                            className={`group relative text-left p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer
                                ${isSelected
                                    ? `${ut.borderColor} ${ut.bgColor} shadow-xl ${ut.glowColor}`
                                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                                }
                            `}
                        >
                            {/* Selection indicator */}
                            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                                ${isSelected ? `${ut.borderColor} bg-gradient-to-r ${ut.gradient}` : 'border-white/20'}
                            `}>
                                {isSelected && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-2 h-2 bg-white rounded-full"
                                    />
                                )}
                            </div>

                            {/* Icon */}
                            <div className="text-5xl mb-4">{ut.icon}</div>

                            {/* Label & Description */}
                            <h3 className="text-xl font-bold text-white mb-2">{ut.label}</h3>
                            <p className="text-slate-400 text-sm mb-4">{ut.description}</p>

                            {/* Feature pills */}
                            <div className="flex flex-wrap gap-2">
                                {ut.features.map((feat) => (
                                    <span
                                        key={feat}
                                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                                            ${isSelected
                                                ? `bg-gradient-to-r ${ut.gradient} text-white`
                                                : 'bg-white/5 text-slate-500'
                                            }
                                        `}
                                    >
                                        {feat}
                                    </span>
                                ))}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};

export default StepUserType;
