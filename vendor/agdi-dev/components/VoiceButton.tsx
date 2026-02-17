/**
 * VoiceButton Component
 * 
 * Push-to-talk button for Voice-to-Architecture feature.
 */

import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceButtonProps {
    isListening: boolean;
    isSupported: boolean;
    isPushToTalkActive?: boolean;
    onToggle: () => void;
    transcript?: string;
    className?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
    isListening,
    isSupported,
    isPushToTalkActive = false,
    onToggle,
    transcript,
    className = '',
}) => {
    if (!isSupported) {
        return (
            <button
                disabled
                className={`p-2 rounded-lg bg-slate-800/50 text-slate-600 cursor-not-allowed ${className}`}
                title="Voice input not supported in this browser"
            >
                <MicOff className="w-5 h-5" />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onToggle}
                className={`
                    relative p-2 rounded-lg transition-all
                    ${isListening
                        ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                    }
                    ${className}
                `}
                title={isListening ? 'Stop listening' : 'Start voice input (or hold Space)'}
            >
                <Mic className="w-5 h-5" />

                {/* Recording indicator */}
                {isListening && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                )}
            </button>

            {/* Push-to-talk hint */}
            {!isListening && (
                <span className="text-xs text-slate-500 hidden sm:inline">
                    Hold <kbd className="px-1 py-0.5 bg-slate-700 rounded text-slate-400">Space</kbd> to talk
                </span>
            )}

            {/* Live transcript preview */}
            {isListening && transcript && (
                <span className="text-sm text-slate-300 max-w-[200px] truncate">
                    {transcript}
                </span>
            )}
        </div>
    );
};

// ==================== VOICE INDICATOR ====================

interface VoiceIndicatorProps {
    isListening: boolean;
    transcript: string;
    interimTranscript: string;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
    isListening,
    transcript,
    interimTranscript,
}) => {
    if (!isListening && !transcript) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/80 rounded-lg border border-slate-700">
            {isListening && (
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-red-400">Recording...</span>
                </div>
            )}

            <div className="flex-1 text-sm">
                <span className="text-white">{transcript}</span>
                <span className="text-slate-400">{interimTranscript}</span>
            </div>
        </div>
    );
};

export default VoiceButton;
