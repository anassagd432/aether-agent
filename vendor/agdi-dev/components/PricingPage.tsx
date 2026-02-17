/**
 * PricingPage — Premium animated pricing cards
 *
 * Responsive pricing page with monthly/annual toggle,
 * tier comparison, and CTA buttons for each plan.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowLeft, Zap, Building2, Crown } from 'lucide-react';
import { PRICING_TIERS, type PricingTierId } from '../lib/pricing/config';

interface PricingPageProps {
    onBack?: () => void;
    onSelectPlan?: (tierId: PricingTierId) => void;
}

const TIER_ICONS: Record<PricingTierId, React.ReactNode> = {
    free: <Zap className="w-6 h-6" />,
    pro: <Crown className="w-6 h-6" />,
    business: <Building2 className="w-6 h-6" />,
};

const TIER_COLORS: Record<PricingTierId, { accent: string; glow: string; bg: string; border: string }> = {
    free: {
        accent: 'text-slate-300',
        glow: 'shadow-slate-500/10',
        bg: 'from-slate-800/50 to-slate-900/50',
        border: 'border-white/10',
    },
    pro: {
        accent: 'text-cyan-400',
        glow: 'shadow-cyan-500/20',
        bg: 'from-cyan-950/30 to-amber-950/30',
        border: 'border-cyan-500/30',
    },
    business: {
        accent: 'text-cyan-400',
        glow: 'shadow-cyan-500/20',
        bg: 'from-amber-950/30 to-fuchsia-950/30',
        border: 'border-cyan-500/30',
    },
};

const PricingPage: React.FC<PricingPageProps> = ({ onBack, onSelectPlan }) => {
    const [isAnnual, setIsAnnual] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>
                    <span className="text-xs text-slate-500 font-mono tracking-widest">AGDI PRICING</span>
                </div>
            </div>

            {/* Hero */}
            <div className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium mb-6">
                        <Sparkles className="w-3 h-3" />
                        Simple, transparent pricing
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        Build faster. Ship{' '}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-cyan-400">
                            smarter.
                        </span>
                    </h1>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        Choose the plan that fits your ambition. Upgrade anytime.
                    </p>
                </motion.div>

                {/* Billing Toggle */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 inline-flex items-center gap-3 p-1 rounded-full bg-slate-800/50 border border-white/10"
                >
                    <button
                        onClick={() => setIsAnnual(false)}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${!isAnnual ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setIsAnnual(true)}
                        className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isAnnual ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        Annual
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                            -20%
                        </span>
                    </button>
                </motion.div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-5xl mx-auto px-6 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {PRICING_TIERS.map((tier, i) => {
                        const colors = TIER_COLORS[tier.id];
                        const displayPrice = isAnnual
                            ? Math.round(tier.annualPrice / 12)
                            : tier.monthlyPrice;

                        return (
                            <motion.div
                                key={tier.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * i, duration: 0.5 }}
                                className={`relative rounded-2xl border p-6 flex flex-col backdrop-blur-sm bg-gradient-to-b ${colors.bg} ${colors.border} ${tier.highlighted
                                        ? `shadow-2xl ${colors.glow} scale-[1.02]`
                                        : 'shadow-lg'
                                    } hover:shadow-2xl transition-all duration-300`}
                            >
                                {/* Popular Badge */}
                                {tier.highlighted && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <div className="px-4 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-500 text-white text-xs font-bold shadow-lg">
                                            Most Popular
                                        </div>
                                    </div>
                                )}

                                {/* Tier Header */}
                                <div className="mb-6">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${tier.id === 'free' ? 'from-slate-600 to-slate-500' :
                                            tier.id === 'pro' ? 'from-cyan-500 to-cyan-500' :
                                                'from-cyan-500 to-fuchsia-500'
                                        } flex items-center justify-center text-white mb-4`}>
                                        {TIER_ICONS[tier.id]}
                                    </div>
                                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                                    <p className="text-slate-400 text-sm mt-1">{tier.tagline}</p>
                                </div>

                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold text-white">
                                            ${displayPrice}
                                        </span>
                                        <span className="text-slate-400 text-sm">/mo</span>
                                    </div>
                                    {isAnnual && tier.annualPrice > 0 && (
                                        <div className="text-xs text-emerald-400 mt-1">
                                            Billed ${tier.annualPrice}/year · Save ${tier.monthlyPrice * 12 - tier.annualPrice}
                                        </div>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-3 flex-1 mb-6">
                                    {tier.features.map((feat, fi) => (
                                        <li key={fi} className="flex items-start gap-2.5 text-sm">
                                            <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors.accent}`} />
                                            <span className="text-slate-300">{feat}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => onSelectPlan?.(tier.id)}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${tier.highlighted
                                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-500 hover:from-cyan-400 hover:to-cyan-400 text-white shadow-lg shadow-cyan-500/20'
                                            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                                        }`}
                                >
                                    {tier.monthlyPrice === 0 ? 'Get Started Free' : 'Start Free Trial'}
                                </button>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Footer Trust Bar */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-12 text-center"
                >
                    <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            No credit card required
                        </span>
                        <span className="flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            Cancel anytime
                        </span>
                        <span className="flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            14-day money-back guarantee
                        </span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default PricingPage;
