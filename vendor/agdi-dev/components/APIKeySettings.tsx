import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Check, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react';

// ==================== TYPES ====================

interface APIKeyConfig {
    gemini: string;
    openrouter: string;
    openai: string;
    anthropic: string;
    deepseek: string;
    bravesearch: string;
}

interface ProviderInfo {
    id: keyof APIKeyConfig;
    name: string;
    description: string;
    getKeyUrl: string;
    placeholder: string;
    color: string;
}

interface APIKeySettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

// ==================== CONSTANTS ====================

const PROVIDERS: ProviderInfo[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'Gemini 2.5 Flash/Pro - Fast and capable',
        getKeyUrl: 'https://aistudio.google.com/apikey',
        placeholder: 'AIza...',
        color: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Access 100+ models (Llama, Qwen, DeepSeek, etc.)',
        getKeyUrl: 'https://openrouter.ai/keys',
        placeholder: 'sk-or-...',
        color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    },
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-4o, o1, o3 models',
        getKeyUrl: 'https://platform.openai.com/api-keys',
        placeholder: 'sk-...',
        color: 'bg-green-500/20 text-green-400 border-green-500/30'
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude 3.5 Sonnet, Claude 4',
        getKeyUrl: 'https://console.anthropic.com/',
        placeholder: 'sk-ant-...',
        color: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek R1, V3 - Advanced reasoning',
        getKeyUrl: 'https://platform.deepseek.com/',
        placeholder: 'sk-...',
        color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    },
    {
        id: 'bravesearch',
        name: 'Brave Search',
        description: 'Enables live web access for the agent',
        getKeyUrl: 'https://brave.com/search/api/',
        placeholder: 'BSA...',
        color: 'bg-orange-600/20 text-orange-500 border-orange-500/30'
    }
];

const STORAGE_KEY = 'agdi_api_keys';

// ==================== HELPER FUNCTIONS ====================

export function getStoredAPIKeys(): APIKeyConfig {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to parse stored API keys:', e);
    }
    return { gemini: '', openrouter: '', openai: '', anthropic: '', deepseek: '', bravesearch: '' };
}

export function getAPIKey(provider: keyof APIKeyConfig): string {
    const stored = getStoredAPIKeys();
    const storedKey = stored[provider];

    if (storedKey) return storedKey;

    // Fallback to environment variables
    const envMap: Record<keyof APIKeyConfig, string | undefined> = {
        gemini: import.meta.env.VITE_GEMINI_API_KEY,
        openrouter: import.meta.env.VITE_OPENROUTER_API_KEY,
        openai: import.meta.env.VITE_OPENAI_API_KEY,
        anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY,
        deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
        bravesearch: import.meta.env.VITE_BRAVE_API_KEY
    };

    return envMap[provider] || '';
}

export function hasAnyAPIKey(): boolean {
    const keys = getStoredAPIKeys();
    return Object.values(keys).some(k => k.length > 0) ||
        !!import.meta.env.VITE_GEMINI_API_KEY ||
        !!import.meta.env.VITE_OPENROUTER_API_KEY;
}

// ==================== COMPONENT ====================

const APIKeySettings: React.FC<APIKeySettingsProps> = ({ isOpen, onClose }) => {
    const [keys, setKeys] = useState<APIKeyConfig>(getStoredAPIKeys());
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setKeys(getStoredAPIKeys());
            setSaved(false);
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleKeyChange = (provider: keyof APIKeyConfig, value: string) => {
        setKeys(prev => ({ ...prev, [provider]: value.trim() }));
        setSaved(false);
    };

    const toggleShowKey = (provider: string) => {
        setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
    };

    const configuredCount = Object.values(keys).filter((k): k is string => typeof k === 'string' && k.length > 0).length;

    // Nuclear option - clear ALL session data
    const handleNukeSession = async () => {
        const confirmed = window.confirm(
            '🚨 DANGER ZONE 🚨\n\n' +
            'This will permanently delete:\n' +
            '• All saved API keys\n' +
            '• All cached project files\n' +
            '• All session data\n\n' +
            'This action CANNOT be undone. Continue?'
        );

        if (!confirmed) return;

        try {
            // Clear localStorage
            localStorage.clear();

            // Clear all IndexedDB databases
            const databases = await indexedDB.databases();
            for (const db of databases) {
                if (db.name) {
                    indexedDB.deleteDatabase(db.name);
                }
            }

            // Clear sessionStorage too
            sessionStorage.clear();

            // Show success and reload
            alert('✅ All data cleared successfully. Page will reload.');
            window.location.reload();
        } catch (error) {
            console.error('Failed to clear data:', error);
            alert('⚠️ Some data could not be cleared. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                            <Key className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">API Key Settings</h2>
                            <p className="text-sm text-slate-400">Configure your AI provider API keys</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Info Banner */}
                <div className="mx-6 mt-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="text-blue-200 font-medium">Your keys are stored locally</p>
                            <p className="text-blue-300/70 mt-1">
                                API keys are saved in your browser's localStorage and never sent to any server.
                                You need at least one key configured to generate apps.
                            </p>
                        </div>
                    </div>
                </div>

                {/* API Key Inputs */}
                <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                    {PROVIDERS.map((provider) => (
                        <div
                            key={provider.id}
                            className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`px-2 py-1 rounded-lg text-xs font-bold ${provider.color}`}>
                                        {provider.name}
                                    </div>
                                    {keys[provider.id] && (
                                        <Check className="w-4 h-4 text-green-400" />
                                    )}
                                </div>
                                <a
                                    href={provider.getKeyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                                >
                                    Get API Key <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            <p className="text-xs text-slate-500 mb-3">{provider.description}</p>

                            <div className="relative">
                                <input
                                    type={showKeys[provider.id] ? 'text' : 'password'}
                                    value={keys[provider.id]}
                                    onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                                    placeholder={provider.placeholder}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => toggleShowKey(provider.id)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                >
                                    {showKeys[provider.id] ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* Webhook Notifications Section */}
                    <div className="pt-4 mt-4 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm font-bold text-slate-300">🔔 Notifications</span>
                            <span className="text-xs text-slate-500">(Optional)</span>
                        </div>

                        {/* Discord Webhook */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="px-2 py-1 rounded-lg text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                    Discord
                                </div>
                                <span className="text-xs text-slate-500">Build/Deploy alerts</span>
                            </div>
                            <input
                                type="url"
                                value={localStorage.getItem('agdi_webhook_discord') || ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        localStorage.setItem('agdi_webhook_discord', e.target.value);
                                    } else {
                                        localStorage.removeItem('agdi_webhook_discord');
                                    }
                                }}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                            />
                        </div>

                        {/* Slack Webhook */}
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <div className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    Slack
                                </div>
                                <span className="text-xs text-slate-500">Build/Deploy alerts</span>
                            </div>
                            <input
                                type="url"
                                value={localStorage.getItem('agdi_webhook_slack') || ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        localStorage.setItem('agdi_webhook_slack', e.target.value);
                                    } else {
                                        localStorage.removeItem('agdi_webhook_slack');
                                    }
                                }}
                                placeholder="https://hooks.slack.com/services/..."
                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-4 p-6 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            {configuredCount} of {PROVIDERS.length} providers configured
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${saved
                                    ? 'bg-green-500 text-white'
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                                    }`}
                            >
                                {saved ? (
                                    <span className="flex items-center gap-2">
                                        <Check className="w-4 h-4" /> Saved!
                                    </span>
                                ) : (
                                    'Save Keys'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone - Session Nuke */}
                    <div className="pt-4 border-t border-red-500/20">
                        <button
                            onClick={handleNukeSession}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear All Data (Reset Session)
                        </button>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            Deletes all API keys, cached files, and browser storage
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default APIKeySettings;
