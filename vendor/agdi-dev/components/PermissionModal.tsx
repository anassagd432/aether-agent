/**
 * Permission Modal
 * 
 * UI for approving/denying command execution.
 */

import React from 'react';
import {
    AlertTriangle,
    Shield,
    Terminal,
    Globe,
    FileEdit,
    X,
    Check,
    Ban,
    Clock,
    Plus,
} from 'lucide-react';
import type { PermissionResult, RiskTier } from '../lib/security/types';
import { RISK_TIER_LABELS, RISK_TIER_COLORS } from '../lib/security/types';

// ==================== PROPS ====================

interface PermissionModalProps {
    isOpen: boolean;
    command: string;
    result: PermissionResult;
    onChoice: (choice: string) => void;
    onDismiss: () => void;
}

// ==================== RISK BADGE ====================

const RiskBadge: React.FC<{ tier: RiskTier }> = ({ tier }) => {
    const bgColors: Record<RiskTier, string> = {
        0: 'bg-green-500/20 border-green-500/50',
        1: 'bg-yellow-500/20 border-yellow-500/50',
        2: 'bg-orange-500/20 border-orange-500/50',
        3: 'bg-red-500/20 border-red-500/50',
    };

    return (
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${bgColors[tier]}`}>
            <Shield className={`w-3 h-3 ${RISK_TIER_COLORS[tier]}`} />
            <span className={`text-xs font-medium ${RISK_TIER_COLORS[tier]}`}>
                Tier {tier}: {RISK_TIER_LABELS[tier]}
            </span>
        </div>
    );
};

// ==================== MAIN COMPONENT ====================

export const PermissionModal: React.FC<PermissionModalProps> = ({
    isOpen,
    command,
    result,
    onChoice,
    onDismiss,
}) => {
    if (!isOpen) return null;

    const { riskTier, argv, paths, domains, promptPayload } = result;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className={`px-6 py-4 border-b border-white/10 ${riskTier >= 3 ? 'bg-red-500/10' :
                        riskTier >= 2 ? 'bg-orange-500/10' :
                            'bg-yellow-500/10'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${riskTier >= 3 ? 'bg-red-500/20' :
                                    riskTier >= 2 ? 'bg-orange-500/20' :
                                        'bg-yellow-500/20'
                                }`}>
                                <AlertTriangle className={`w-5 h-5 ${riskTier >= 3 ? 'text-red-400' :
                                        riskTier >= 2 ? 'text-orange-400' :
                                            'text-yellow-400'
                                    }`} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Permission Required</h3>
                                <p className="text-xs text-slate-400">
                                    Agent wants to execute a command
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onDismiss}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">

                    {/* Risk Badge */}
                    <div className="flex items-center justify-between">
                        <RiskBadge tier={riskTier} />
                    </div>

                    {/* Command Display */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Proposed Command
                        </label>
                        <div className="flex items-start gap-2 p-3 bg-slate-950 rounded-lg border border-white/5">
                            <Terminal className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                            <code className="text-sm text-cyan-300 font-mono break-all">
                                {command}
                            </code>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            Why Permission is Needed
                        </label>
                        <p className="text-sm text-slate-300">
                            {promptPayload?.uiText || result.reason}
                        </p>
                    </div>

                    {/* Side Effects */}
                    {promptPayload?.expectedSideEffects && promptPayload.expectedSideEffects.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <FileEdit className="w-3 h-3" />
                                Expected Side Effects
                            </label>
                            <ul className="space-y-1">
                                {promptPayload.expectedSideEffects.map((effect, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                                        <span className="w-1 h-1 bg-slate-500 rounded-full" />
                                        {effect}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Network Access */}
                    {domains.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Globe className="w-3 h-3" />
                                Network Access
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {domains.map((domain, i) => (
                                    <span key={i} className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-blue-300">
                                        {domain}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Paths */}
                    {paths.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Files/Paths Affected
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {paths.map((path, i) => (
                                    <span key={i} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded text-xs text-cyan-300 font-mono">
                                        {path}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/10 bg-slate-950/50 space-y-3">
                    {/* Primary actions */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onChoice('approve_once')}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <Check className="w-4 h-4" />
                            Approve Once
                        </button>
                        <button
                            onClick={() => onChoice('deny')}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <Ban className="w-4 h-4" />
                            Deny
                        </button>
                    </div>

                    {/* Secondary actions */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => onChoice('approve_session')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-sm rounded-lg transition-colors"
                        >
                            <Clock className="w-3 h-3" />
                            Approve for Session
                        </button>
                        <button
                            onClick={() => onChoice('always_allow')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-sm rounded-lg transition-colors"
                        >
                            <Plus className="w-3 h-3" />
                            Always Allow
                        </button>
                        <button
                            onClick={() => onChoice('always_forbid')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-sm rounded-lg transition-colors"
                        >
                            <Ban className="w-3 h-3" />
                            Always Block
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PermissionModal;
