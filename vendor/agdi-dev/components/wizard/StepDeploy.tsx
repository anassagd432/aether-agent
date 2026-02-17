/**
 * StepDeploy — Deployment target selection
 */

import React from 'react';
import { motion } from 'framer-motion';
import { DeployTarget } from '../../lib/wizard/types';

interface StepDeployProps {
    selected: DeployTarget | null;
    onSelect: (target: DeployTarget) => void;
}

const DEPLOY_OPTIONS: { value: DeployTarget; label: string; icon: string; description: string; badge?: string }[] = [
    {
        value: DeployTarget.VERCEL,
        label: 'Deploy to Vercel',
        icon: '▲',
        description: 'Auto-deploy with a live URL — ready to share in seconds',
        badge: 'Recommended',
    },
    {
        value: DeployTarget.NETLIFY,
        label: 'Deploy to Netlify',
        icon: '◆',
        description: 'Fast static hosting with instant rollbacks',
    },
    {
        value: DeployTarget.DOWNLOAD,
        label: 'Download ZIP',
        icon: '📥',
        description: 'Get the source code and host it yourself',
    },
];

export const StepDeploy: React.FC<StepDeployProps> = ({ selected, onSelect }) => {
    return (
        <div className="w-full max-w-2xl mx-auto">
            <motion.h2
                className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                How do you want to launch?
            </motion.h2>
            <motion.p
                className="text-white/50 text-center mb-10 text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                Your app will be live in minutes
            </motion.p>

            <div className="space-y-3">
                {DEPLOY_OPTIONS.map((option, i) => {
                    const isSelected = selected === option.value;
                    return (
                        <motion.button
                            key={option.value}
                            onClick={() => onSelect(option.value)}
                            className={`w-full flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-300 cursor-pointer ${isSelected
                                    ? 'border-cyan-400/60 bg-cyan-400/10 shadow-lg shadow-cyan-400/10'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${isSelected ? 'bg-cyan-400/20' : 'bg-white/5'
                                }`}>
                                {option.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`font-semibold text-sm ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                                        {option.label}
                                    </span>
                                    {option.badge && (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-cyan-400/20 text-cyan-300">
                                            {option.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[12px] text-white/40 mt-0.5">{option.description}</p>
                            </div>

                            {/* Radio */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-cyan-400' : 'border-white/20'
                                }`}>
                                {isSelected && (
                                    <motion.div
                                        className="w-2.5 h-2.5 rounded-full bg-cyan-400"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500 }}
                                    />
                                )}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
