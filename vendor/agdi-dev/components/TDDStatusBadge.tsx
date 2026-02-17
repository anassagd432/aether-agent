/**
 * TDDStatusBadge Component
 * 
 * Cinematic status indicator showing TDD phase with animations.
 */

import React from 'react';
import { TDDPhase, PHASE_STYLES, TDDLog } from '../lib/tdd/types';

interface TDDStatusBadgeProps {
    phase: TDDPhase;
    className?: string;
}

export const TDDStatusBadge: React.FC<TDDStatusBadgeProps> = ({ phase, className = '' }) => {
    const style = PHASE_STYLES[phase];

    const isAnimating = !['idle', 'success', 'failed'].includes(phase);

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 ${className}`}>
            <span className={`text-lg ${isAnimating ? 'animate-pulse' : ''}`}>
                {style.icon}
            </span>
            <span className={`text-sm font-medium ${style.color}`}>
                {style.label}
            </span>
            {isAnimating && (
                <span className="w-2 h-2 rounded-full bg-current animate-ping opacity-75" />
            )}
        </div>
    );
};

interface TDDLogViewerProps {
    logs: TDDLog[];
    maxHeight?: string;
}

export const TDDLogViewer: React.FC<TDDLogViewerProps> = ({ logs, maxHeight = '300px' }) => {
    const logColors: Record<TDDLog['type'], string> = {
        info: 'text-slate-400',
        test: 'text-yellow-400',
        code: 'text-blue-400',
        error: 'text-red-400',
        success: 'text-green-400',
    };

    const logIcons: Record<TDDLog['type'], string> = {
        info: '💡',
        test: '🧪',
        code: '⚙️',
        error: '❌',
        success: '✅',
    };

    return (
        <div
            className="font-mono text-xs bg-slate-900/80 rounded-lg border border-slate-700 overflow-hidden"
            style={{ maxHeight }}
        >
            <div className="px-3 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center gap-2">
                <span className="text-cyan-400">⚡</span>
                <span className="text-slate-300 font-medium">TDD Agent Log</span>
            </div>
            <div className="p-3 overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 40px)` }}>
                {logs.length === 0 ? (
                    <div className="text-slate-500 italic">Waiting for TDD agent to start...</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex gap-2 mb-1">
                            <span className="text-slate-600 w-16 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString('en-US', {
                                    hour12: false,
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                })}
                            </span>
                            <span>{logIcons[log.type]}</span>
                            <span className={logColors[log.type]}>{log.message}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

interface TDDPanelProps {
    phase: TDDPhase;
    logs: TDDLog[];
    isRunning: boolean;
    onAbort?: () => void;
}

export const TDDPanel: React.FC<TDDPanelProps> = ({ phase, logs, isRunning, onAbort }) => {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <TDDStatusBadge phase={phase} />
                {isRunning && onAbort && (
                    <button
                        onClick={onAbort}
                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-colors"
                    >
                        ⏹️ Abort
                    </button>
                )}
            </div>
            <TDDLogViewer logs={logs} maxHeight="250px" />
        </div>
    );
};

export default TDDStatusBadge;
