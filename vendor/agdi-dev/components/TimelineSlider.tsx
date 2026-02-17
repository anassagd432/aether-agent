/**
 * TimelineSlider Component
 * 
 * Visual timeline for state time-travel with drag-to-rollback.
 */

import React, { useCallback } from 'react';
import { Snapshot } from '../lib/snapshot-manager';
import { Undo2, Redo2, History, Clock } from 'lucide-react';

// ==================== TIMELINE SLIDER ====================

interface TimelineSliderProps {
    snapshots: Snapshot[];
    currentIndex: number;
    onGoTo: (index: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
    snapshots,
    currentIndex,
    onGoTo,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
}) => {
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    if (snapshots.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                <History className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500">No snapshots yet</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-slate-300">
                        Time Travel
                    </span>
                    <span className="text-xs text-slate-500">
                        ({currentIndex + 1} / {snapshots.length})
                    </span>
                </div>

                {/* Undo/Redo Buttons */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={`p-1.5 rounded transition-colors ${canUndo
                                ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                : 'text-slate-600 cursor-not-allowed'
                            }`}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className={`p-1.5 rounded transition-colors ${canRedo
                                ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                : 'text-slate-600 cursor-not-allowed'
                            }`}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Slider */}
            <div className="relative">
                <input
                    type="range"
                    min={0}
                    max={snapshots.length - 1}
                    value={currentIndex}
                    onChange={(e) => onGoTo(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-4
                        [&::-webkit-slider-thumb]:h-4
                        [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-cyan-400
                        [&::-webkit-slider-thumb]:hover:bg-cyan-300
                        [&::-webkit-slider-thumb]:transition-colors
                        [&::-webkit-slider-thumb]:shadow-lg"
                />

                {/* Markers */}
                <div className="absolute top-4 left-0 right-0 flex justify-between px-1">
                    {snapshots.length <= 10 && snapshots.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => onGoTo(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === currentIndex
                                    ? 'bg-cyan-400 scale-125'
                                    : i < currentIndex
                                        ? 'bg-slate-500'
                                        : 'bg-slate-600'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Current Snapshot Info */}
            {snapshots[currentIndex] && (
                <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                        {snapshots[currentIndex].label}
                    </span>
                    <span className="text-slate-500">
                        {formatTime(snapshots[currentIndex].timestamp)}
                    </span>
                </div>
            )}
        </div>
    );
};

// ==================== COMPACT VERSION ====================

interface TimelineCompactProps {
    snapshotCount: number;
    currentIndex: number;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
}

export const TimelineCompact: React.FC<TimelineCompactProps> = ({
    snapshotCount,
    currentIndex,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
}) => {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`p-2 rounded-lg transition-colors ${canUndo
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                    }`}
                title="Undo"
            >
                <Undo2 className="w-4 h-4" />
            </button>

            {snapshotCount > 0 && (
                <span className="text-xs text-slate-500 min-w-[40px] text-center">
                    {currentIndex + 1}/{snapshotCount}
                </span>
            )}

            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-2 rounded-lg transition-colors ${canRedo
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                    }`}
                title="Redo"
            >
                <Redo2 className="w-4 h-4" />
            </button>
        </div>
    );
};

export default TimelineSlider;
