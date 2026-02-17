/**
 * LLM Provider — API Key Retrieval
 */

/**
 * Get API key from localStorage with fallback to environment variable
 */
export function getStoredAPIKey(provider: 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'deepseek'): string {
    const STORAGE_MAP: Record<string, { storage: string; env: string }> = {
        gemini: { storage: 'agdi_gemini_api_key', env: 'VITE_GEMINI_API_KEY' },
        openrouter: { storage: 'agdi_openrouter_api_key', env: 'VITE_OPENROUTER_API_KEY' },
        openai: { storage: 'agdi_openai_api_key', env: 'VITE_OPENAI_API_KEY' },
        anthropic: { storage: 'agdi_anthropic_api_key', env: 'VITE_ANTHROPIC_API_KEY' },
        deepseek: { storage: 'agdi_deepseek_api_key', env: 'VITE_DEEPSEEK_API_KEY' },
    };

    const mapping = STORAGE_MAP[provider];
    if (!mapping) return '';

    // Try localStorage first (user-configured)
    if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(mapping.storage);
        if (stored) return stored;
    }

    // Fallback to environment variable
    try {
        const env = (import.meta as any).env?.[mapping.env];
        if (env) return env;
    } catch {
        // Not in Vite environment
    }

    return '';
}
