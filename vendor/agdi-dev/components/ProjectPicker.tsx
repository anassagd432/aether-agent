/**
 * ProjectPicker Component
 * 
 * Dropdown for switching between saved projects.
 * Shows project name, file count, and last saved time.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronDown,
    Folder,
    FolderOpen,
    Plus,
    Trash2,
    Clock,
    FileCode,
    Loader2
} from 'lucide-react';
import type { ProjectMeta } from '../lib/persistence/types';

interface ProjectPickerProps {
    currentProjectId: string | null;
    savedProjects: ProjectMeta[];
    lastSavedAt: number | null;
    isLoading: boolean;
    onNewProject: () => void;
    onLoadProject: (id: string) => void;
    onDeleteProject: (id: string) => void;
}

/**
 * Format relative time (e.g., "2 mins ago")
 */
function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export const ProjectPicker: React.FC<ProjectPickerProps> = ({
    currentProjectId,
    savedProjects,
    lastSavedAt,
    isLoading,
    onNewProject,
    onLoadProject,
    onDeleteProject,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentProject = savedProjects.find(p => p.id === currentProjectId);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 hover:bg-slate-800/50 border border-white/10 hover:border-cyan-500/30 rounded-lg transition-all text-sm"
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                ) : (
                    <FolderOpen className="w-4 h-4 text-cyan-400" />
                )}
                <span className="text-slate-300 max-w-[150px] truncate">
                    {currentProject?.name || 'No Project'}
                </span>
                {lastSavedAt && (
                    <span className="text-[10px] text-slate-500 hidden md:inline">
                        • Saved {formatRelativeTime(lastSavedAt)}
                    </span>
                )}
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Your Projects
                        </span>
                        <span className="text-[10px] text-slate-500">
                            {savedProjects.length} saved
                        </span>
                    </div>

                    {/* Project List */}
                    <div className="max-h-64 overflow-y-auto">
                        {savedProjects.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                                <Folder className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                <p className="text-sm text-slate-500">No saved projects</p>
                                <p className="text-xs text-slate-600 mt-1">
                                    Projects are saved automatically
                                </p>
                            </div>
                        ) : (
                            savedProjects.map((project) => (
                                <div
                                    key={project.id}
                                    className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer group transition-colors ${project.id === currentProjectId ? 'bg-cyan-500/10 border-l-2 border-cyan-400' : ''
                                        }`}
                                    onClick={() => {
                                        onLoadProject(project.id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <Folder className={`w-4 h-4 ${project.id === currentProjectId ? 'text-cyan-400' : 'text-slate-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm truncate ${project.id === currentProjectId ? 'text-cyan-300' : 'text-slate-300'}`}>
                                            {project.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <FileCode className="w-3 h-3" />
                                                {project.fileCount}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {formatRelativeTime(project.savedAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete "${project.name}"?`)) {
                                                onDeleteProject(project.id);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                                        title="Delete project"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer: New Project Button */}
                    <div className="px-4 py-3 border-t border-white/5">
                        <button
                            onClick={() => {
                                onNewProject();
                                setIsOpen(false);
                            }}
                            className="flex items-center gap-2 w-full px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg transition-all text-sm text-cyan-300"
                        >
                            <Plus className="w-4 h-4" />
                            New Project
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectPicker;
