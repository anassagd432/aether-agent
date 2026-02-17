import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock, Check } from 'lucide-react';
import { AVAILABLE_MODELS, ModelConfig } from '../lib/agdi-architect';
import { getAPIKey } from './APIKeySettings';
import {
    GoogleLogo,
    OpenAILogo,
    AnthropicLogo,
    DeepSeekLogo,
    MetaLogo,
    MistralLogo,
    XAILogo,
    AgdiLogo
} from './icons/ModelLogos';

// ==================== TYPES ====================

type ModelCategory = 'google' | 'openai' | 'anthropic' | 'deepseek' | 'xai' | 'mistral' | 'meta' | 'other';

interface ModelSelectorProps {
    selectedModel: string;
    onModelSelect: (modelId: string) => void;
    variant?: 'default' | 'compact';
    dropdownPosition?: 'above' | 'below';
    className?: string;
}

// ==================== CONSTANTS ====================

const CATEGORY_ORDER: ModelCategory[] = ['google', 'openai', 'anthropic', 'deepseek', 'xai', 'mistral', 'meta', 'other'];

const CATEGORY_LABELS: Record<ModelCategory, string> = {
    google: 'Google',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    deepseek: 'DeepSeek',
    xai: 'xAI',
    mistral: 'Mistral',
    meta: 'Meta',
    other: 'Other'
};

const CATEGORY_ICONS: Record<ModelCategory, React.ElementType> = {
    google: GoogleLogo,
    openai: OpenAILogo,
    anthropic: AnthropicLogo,
    deepseek: DeepSeekLogo,
    xai: XAILogo,
    mistral: MistralLogo,
    meta: MetaLogo,
    other: AgdiLogo
};

const CATEGORY_COLORS: Record<ModelCategory, string> = {
    google: 'text-blue-400',
    openai: 'text-green-400',
    anthropic: 'text-orange-400',
    deepseek: 'text-cyan-400',
    xai: 'text-white',
    mistral: 'text-cyan-400',
    meta: 'text-blue-500',
    other: 'text-gray-400'
};

// ==================== COMPONENT ====================

/**
 * Premium Model Selector Dropdown
 * 
 * Features official logos, clean hierarchy, and status indicators.
 * Designed to look like a high-end system control.
 */
const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedModel,
    onModelSelect,
    variant = 'default',
    dropdownPosition = 'below',
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    const selectedModelConfig = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    const SelectedIcon = selectedModelConfig ? CATEGORY_ICONS[selectedModelConfig.category] : AgdiLogo;
    const selectedColor = selectedModelConfig ? CATEGORY_COLORS[selectedModelConfig.category] : 'text-gray-400';

    const hasProviderKey = (model: ModelConfig): boolean => {
        if (model.provider === 'gemini') return Boolean(getAPIKey('gemini'));
        return Boolean(getAPIKey('openrouter'));
    };

    const handleSelect = (model: ModelConfig) => {
        if (!hasProviderKey(model)) return;
        onModelSelect(model.id);
        setIsOpen(false);
    };

    const getModelsByCategory = (category: ModelCategory): ModelConfig[] => {
        return AVAILABLE_MODELS.filter(m => m.category === category);
    };

    const buttonClasses = variant === 'compact'
        ? 'flex items-center gap-2 px-2.5 py-1.5 bg-[#141420] border border-white/10 rounded-lg text-xs text-slate-300 hover:bg-white/5 hover:border-white/20 transition-all shadow-sm'
        : 'flex items-center gap-2.5 px-3.5 py-2 bg-[#141420] border border-white/10 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:border-white/20 transition-all shadow-sm group';

    const dropdownPositionClass = dropdownPosition === 'above'
        ? 'bottom-full mb-2 origin-bottom'
        : 'top-full mt-2 origin-top';

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={buttonClasses}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
            >
                <div className={`w-4 h-4 ${selectedColor} transition-transform group-hover:scale-110`}>
                    <SelectedIcon className="w-full h-full" />
                </div>
                <span className="font-medium tracking-tight text-white/90">
                    {selectedModelConfig?.name ?? 'Select Model'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className={`absolute left-0 ${dropdownPositionClass} w-[280px] bg-[#0f0f18]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-100 ease-out`}
                    role="listbox"
                >
                    <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-1.5 space-y-3">
                        {CATEGORY_ORDER.map((category) => {
                            const models = getModelsByCategory(category);
                            if (models.length === 0) return null;

                            const CategoryIcon = CATEGORY_ICONS[category];

                            return (
                                <div key={category}>
                                    {/* Category Header */}
                                    <div className="flex items-center gap-2 px-2.5 py-1.5 mb-0.5">
                                        <div className={`w-3.5 h-3.5 opacity-70 ${CATEGORY_COLORS[category]}`}>
                                            <CategoryIcon className="w-full h-full" />
                                        </div>
                                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                                            {CATEGORY_LABELS[category]}
                                        </span>
                                    </div>

                                    {/* Models List */}
                                    <div className="space-y-0.5">
                                        {models.map((model) => {
                                            const isSelected = selectedModel === model.id;
                                            const isLocked = !hasProviderKey(model);
                                            const lockReason = model.provider === 'gemini'
                                                ? 'Requires Gemini API key'
                                                : 'Requires OpenRouter API key';

                                            return (
                                                <button
                                                    key={model.id}
                                                    onClick={() => handleSelect(model)}
                                                    disabled={isLocked}
                                                    title={isLocked ? lockReason : undefined}
                                                    className={`w-full group/item flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${isSelected
                                                        ? 'bg-cyan-500/10'
                                                        : 'hover:bg-white/5'
                                                        } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    role="option"
                                                    aria-selected={isSelected}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={`w-4 h-4 shrink-0 transition-transform group-hover/item:scale-110 ${CATEGORY_COLORS[category]}`}>
                                                            <CategoryIcon className="w-full h-full" />
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className={`text-sm font-medium truncate ${isSelected ? 'text-cyan-100' : 'text-gray-300 group-hover/item:text-white'}`}>
                                                                {model.name}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Status Badge */}
                                                    {isSelected && (
                                                        <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold bg-cyan-500 text-white rounded shadow-sm shadow-cyan-500/20">
                                                            ACTIVE
                                                        </span>
                                                    )}

                                                    {/* Lock Icon (if we were using it) */}
                                                    {!isSelected && isLocked && (
                                                        <Lock className="w-3.5 h-3.5 text-gray-600" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelSelector;
