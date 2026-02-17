/**
 * Folder Panel Component (Hardened)
 * 
 * UI for selecting, trusting, and managing workspace folders.
 * Includes re-authorization flow for permission loss.
 */

import React from 'react';
import {
    Folder,
    FolderOpen,
    FolderPlus,
    Check,
    Shield,
    ShieldAlert,
    X,
    AlertTriangle,
    ChevronRight,
    RefreshCw,
} from 'lucide-react';
import type { WorkspaceFolder } from '../hooks/useWorkspacePicker';

// ==================== PROPS ====================

interface FolderPanelProps {
    folders: WorkspaceFolder[];
    activeFolder: WorkspaceFolder | null;
    cwd: string;
    isSupported: boolean;
    isLoading: boolean;
    error: string | null;
    onSelectFolder: () => void;
    onTrustFolder: (id: string) => void;
    onRemoveFolder: (id: string) => void;
    onSetActive: (id: string) => void;
    onReauthorize?: (id: string) => void;
}

// ==================== COMPONENT ====================

export const FolderPanel: React.FC<FolderPanelProps> = ({
    folders,
    activeFolder,
    cwd,
    isSupported,
    isLoading,
    error,
    onSelectFolder,
    onTrustFolder,
    onRemoveFolder,
    onSetActive,
    onReauthorize,
}) => {
    if (!isSupported) {
        return (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Folder access not supported in this browser</span>
                </div>
                <p className="text-xs text-yellow-400/70 mt-1">
                    Use Chrome or Edge for full folder access.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Workspace
                </h3>
                <button
                    onClick={onSelectFolder}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                >
                    <FolderPlus className="w-3 h-3" />
                    Add Folder
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                    {error}
                </div>
            )}

            {/* No folders */}
            {folders.length === 0 && (
                <div className="p-4 border border-dashed border-white/20 rounded-lg text-center">
                    <Folder className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No folders added</p>
                    <p className="text-xs text-slate-600 mt-1">
                        Click "Add Folder" to select a project
                    </p>
                </div>
            )}

            {/* Folder list */}
            {folders.map(folder => (
                <div
                    key={folder.id}
                    className={`p-3 rounded-lg border transition-colors ${folder.needsReauth
                            ? 'bg-orange-500/5 border-orange-500/30'
                            : activeFolder?.id === folder.id
                                ? 'bg-blue-500/10 border-blue-500/30'
                                : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => !folder.needsReauth && onSetActive(folder.id)}
                            disabled={folder.needsReauth}
                            className="flex items-center gap-2 flex-1 text-left disabled:opacity-50"
                        >
                            {folder.needsReauth ? (
                                <ShieldAlert className="w-4 h-4 text-orange-400" />
                            ) : activeFolder?.id === folder.id ? (
                                <FolderOpen className="w-4 h-4 text-blue-400" />
                            ) : (
                                <Folder className="w-4 h-4 text-slate-400" />
                            )}
                            <span className="text-sm text-white font-medium">
                                {folder.name}
                            </span>
                        </button>

                        <div className="flex items-center gap-1">
                            {/* Re-auth button */}
                            {folder.needsReauth && onReauthorize && (
                                <button
                                    onClick={() => onReauthorize(folder.id)}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded hover:bg-orange-500/30"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Re-authorize
                                </button>
                            )}

                            {/* Trust/Trusted status */}
                            {!folder.needsReauth && (
                                folder.trusted ? (
                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                                        <Shield className="w-3 h-3" />
                                        Trusted
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => onTrustFolder(folder.id)}
                                        className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded hover:bg-yellow-500/30"
                                    >
                                        <Check className="w-3 h-3" />
                                        Trust
                                    </button>
                                )
                            )}

                            <button
                                onClick={() => onRemoveFolder(folder.id)}
                                className="p-1 hover:bg-white/10 rounded"
                            >
                                <X className="w-3 h-3 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* CWD indicator */}
                    {activeFolder?.id === folder.id && !folder.needsReauth && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                            <ChevronRight className="w-3 h-3" />
                            <span className="font-mono">{cwd}</span>
                        </div>
                    )}

                    {/* Re-auth notice */}
                    {folder.needsReauth && (
                        <p className="mt-2 text-xs text-orange-400/70">
                            Permission expired. Click "Re-authorize" to restore access.
                        </p>
                    )}
                </div>
            ))}

            {/* Trust notice */}
            {folders.some(f => !f.trusted && !f.needsReauth) && (
                <p className="text-xs text-slate-500 italic">
                    Trust a folder to enable file writes
                </p>
            )}
        </div>
    );
};

export default FolderPanel;
