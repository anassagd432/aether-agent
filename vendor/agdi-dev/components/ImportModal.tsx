/**
 * Import Modal
 * 
 * Modal for importing GitHub repositories into the Agdi workspace.
 */

import React, { useState, useCallback } from 'react';
import { X, Github, Loader2, AlertCircle, FolderOpen, CheckCircle } from 'lucide-react';
import { importFromGitHub, GitHubImportResult } from '../lib/github-loader';

// ==================== TYPES ====================

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (result: GitHubImportResult) => void;
}

type ImportStatus = 'idle' | 'loading' | 'success' | 'error';

// ==================== COMPONENT ====================

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleImport = useCallback(async () => {
        if (!url.trim()) {
            setError('Please enter a GitHub URL');
            return;
        }

        setStatus('loading');
        setError(null);
        setProgress('Starting import...');

        try {
            const result = await importFromGitHub(url, setProgress);
            setStatus('success');
            setProgress(`Successfully imported ${result.files.length} files from ${result.repoName}`);

            // Delay to show success message
            setTimeout(() => {
                onImport(result);
                handleClose();
            }, 1000);
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Failed to import repository');
        }
    }, [url, onImport]);

    const handleClose = useCallback(() => {
        setUrl('');
        setStatus('idle');
        setProgress('');
        setError(null);
        onClose();
    }, [onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && status !== 'loading') {
            handleImport();
        }
        if (e.key === 'Escape') {
            handleClose();
        }
    }, [handleImport, handleClose, status]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-lg mx-4 bg-[#0f0f18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center">
                            <Github className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Import from GitHub</h2>
                            <p className="text-sm text-gray-500">Load a public repository</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* URL Input */}
                    <div>
                        <label htmlFor="github-url" className="block text-sm font-medium text-gray-300 mb-2">
                            Repository URL
                        </label>
                        <input
                            id="github-url"
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://github.com/owner/repo"
                            disabled={status === 'loading'}
                            className="w-full px-4 py-3 bg-[#141420] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all disabled:opacity-50"
                            autoFocus
                        />
                    </div>

                    {/* Examples */}
                    <div className="text-xs text-gray-500 space-y-1">
                        <p>Examples:</p>
                        <div className="flex flex-wrap gap-2">
                            {['github.com/vitejs/vite', 'github.com/shadcn-ui/ui'].map((example) => (
                                <button
                                    key={example}
                                    onClick={() => setUrl(`https://${example}`)}
                                    className="px-2 py-1 bg-white/5 rounded-md hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Progress/Status */}
                    {status !== 'idle' && (
                        <div className={`flex items-center gap-3 p-3 rounded-lg ${status === 'loading' ? 'bg-cyan-500/10 text-cyan-400' :
                                status === 'success' ? 'bg-green-500/10 text-green-400' :
                                    'bg-red-500/10 text-red-400'
                            }`}>
                            {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {status === 'success' && <CheckCircle className="w-4 h-4" />}
                            {status === 'error' && <AlertCircle className="w-4 h-4" />}
                            <span className="text-sm">{error || progress}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={status === 'loading' || !url.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-cyan-500 text-white font-medium text-sm rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                    >
                        {status === 'loading' ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <FolderOpen className="w-4 h-4" />
                                Import Project
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
