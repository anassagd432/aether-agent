/**
 * Onboarding Flow - First-run setup wizard
 * Guides user through provider → API key → model selection
 */

import { select, input, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig, type Config } from '../utils/config.js';

// Provider-specific model lists
export const PROVIDER_MODELS = {
    gemini: [
        { name: 'Gemini 3 Pro (Most Intelligent)', value: 'gemini-3-pro-preview' },
        { name: 'Gemini 3 Flash (Fast)', value: 'gemini-3-flash-preview' },
        { name: 'Gemini 3 Deep Think (Reasoning)', value: 'gemini-3-deep-think' },
        { name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        { name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
        { name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
    ],
    openrouter: [
        // FREE MODELS (no API credits needed)
        { name: 'GPT-OSS 120B (Free)', value: 'openai/gpt-oss-120b:free' },
        { name: 'GPT-OSS 20B (Free)', value: 'openai/gpt-oss-20b:free' },
        { name: 'Qwen3 Coder (Free)', value: 'qwen/qwen3-coder:free' },
        { name: 'Qwen3 Next 80B (Free)', value: 'qwen/qwen3-next-80b-a3b-instruct:free' },
        { name: 'Kimi K2 (Free)', value: 'moonshotai/kimi-k2:free' },
        { name: 'Gemma 3N E2B (Free)', value: 'google/gemma-3n-e2b-it:free' },
        { name: 'Qwen 2.5 VL 7B (Free)', value: 'qwen/qwen-2.5-vl-7b-instruct:free' },
        { name: 'LFM Thinking 1.2B (Free, Agentic)', value: 'liquid/lfm-2.5-1.2b-thinking:free' },
        { name: 'Devstral (Free, ends Jan 27)', value: 'mistralai/devstral-2512:free' },
        // PAID MODELS
        { name: 'Claude 3.5 Sonnet', value: 'anthropic/claude-3.5-sonnet' },
        { name: 'GPT-4o', value: 'openai/gpt-4o' },
        { name: 'GPT-4o Mini', value: 'openai/gpt-4o-mini' },
        { name: 'Gemini 2.5 Flash', value: 'google/gemini-2.5-flash-preview' },
        { name: 'Llama 3.3 70B', value: 'meta-llama/llama-3.3-70b-instruct' },
        { name: 'DeepSeek R1', value: 'deepseek/deepseek-r1' },
        { name: 'Mistral Large', value: 'mistral/mistral-large-latest' },
    ],
    openai: [
        { name: 'GPT-5.2 (Flagship)', value: 'gpt-5.2' },
        { name: 'GPT-5.2 Instant', value: 'gpt-5.2-instant' },
        { name: 'GPT-5.2 Thinking (Reasoning)', value: 'gpt-5.2-thinking' },
        { name: 'GPT-5.2 Codex (Coding)', value: 'gpt-5.2-codex' },
        { name: 'GPT-5.1', value: 'gpt-5.1' },
        { name: 'GPT-5.1 Instant', value: 'gpt-5.1-instant' },
        { name: 'GPT-5.1 Codex Max', value: 'gpt-5.1-codex-max' },
        { name: 'GPT-4o', value: 'gpt-4o' },
        { name: 'GPT-4o Mini', value: 'gpt-4o-mini' },
        { name: 'o1', value: 'o1' },
        { name: 'o1-mini', value: 'o1-mini' },
    ],
    anthropic: [
        { name: 'Claude Opus 4.5 (Most Intelligent)', value: 'claude-opus-4.5-20251124' },
        { name: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5-20250929' },
        { name: 'Claude Haiku 4.5 (Fast)', value: 'claude-haiku-4.5-20251015' },
        { name: 'Claude Sonnet 3.5', value: 'claude-3-5-sonnet-20241022' },
        { name: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
    ],
    deepseek: [
        { name: 'DeepSeek V3', value: 'deepseek-chat' },
        { name: 'DeepSeek R1 (Reasoning)', value: 'deepseek-reasoner' },
        { name: 'DeepSeek Coder V3', value: 'deepseek-coder' },
        { name: 'DeepSeek Coder V2.5', value: 'deepseek-coder-v2.5' },
    ],
    xai: [
        { name: 'Grok 3 (Latest)', value: 'grok-3' },
        { name: 'Grok 2', value: 'grok-2' },
        { name: 'Grok 2 Mini', value: 'grok-2-mini' },
    ],
};

export type ProviderType = keyof typeof PROVIDER_MODELS;

/**
 * Check if user needs onboarding
 */
export function needsOnboarding(): boolean {
    const config = loadConfig();
    // Check if at least one provider is configured
    return !(
        config.geminiApiKey ||
        config.openrouterApiKey ||
        config.openaiApiKey ||
        config.anthropicApiKey ||
        config.deepseekApiKey ||
        config.xaiApiKey
    );
}

/**
 * Get the configured provider and its API key
 */
export function getActiveProvider(): { provider: ProviderType; apiKey: string; model: string } | null {
    const config = loadConfig();
    const provider = config.defaultProvider as ProviderType;

    const keyMap: Record<string, string | undefined> = {
        gemini: config.geminiApiKey,
        openrouter: config.openrouterApiKey,
        openai: config.openaiApiKey,
        anthropic: config.anthropicApiKey,
        deepseek: config.deepseekApiKey,
        xai: config.xaiApiKey,
    };

    const apiKey = keyMap[provider];
    if (apiKey) {
        return {
            provider,
            apiKey,
            model: config.defaultModel || PROVIDER_MODELS[provider]?.[0]?.value || 'gemini-3-flash-preview',
        };
    }

    // Fallback: find any configured provider
    for (const [p, key] of Object.entries(keyMap)) {
        if (key) {
            return {
                provider: p as ProviderType,
                apiKey: key,
                model: config.defaultModel || PROVIDER_MODELS[p as ProviderType]?.[0]?.value || 'gemini-3-flash-preview',
            };
        }
    }

    return null;
}

/**
 * Run the onboarding wizard
 */
export async function runOnboarding(): Promise<{ provider: ProviderType; apiKey: string; model: string }> {
    console.log(chalk.cyan.bold('\n🚀 Welcome to Agdi!\n'));
    console.log(chalk.gray('Let\'s set up your AI provider in 3 quick steps.\n'));

    const config = loadConfig();

    // Step 1: Select Provider
    console.log(chalk.white.bold('Step 1/3: Select your AI provider\n'));
    const provider = await select({
        message: 'Which AI provider would you like to use?',
        choices: [
            { name: 'Google Gemini (Recommended - Free tier)', value: 'gemini' },
            { name: 'OpenRouter (100+ models, pay-per-use)', value: 'openrouter' },
            { name: 'OpenAI (GPT-4o)', value: 'openai' },
            { name: 'Anthropic (Claude)', value: 'anthropic' },
            { name: 'DeepSeek', value: 'deepseek' },
            { name: 'xAI (Grok)', value: 'xai' },
        ],
    }) as ProviderType;

    // Step 2: Enter API Key
    console.log(chalk.white.bold('\nStep 2/3: Enter your API key\n'));

    const keyUrls: Record<string, string> = {
        gemini: 'https://aistudio.google.com/apikey',
        openrouter: 'https://openrouter.ai/keys',
        openai: 'https://platform.openai.com/api-keys',
        anthropic: 'https://console.anthropic.com/',
        deepseek: 'https://platform.deepseek.com/',
        xai: 'https://console.x.ai/',
    };

    console.log(chalk.gray(`Get your key at: ${chalk.cyan(keyUrls[provider])}\n`));

    const apiKey = await password({
        message: `Enter your ${provider} API key:`,
        mask: '*',
    });

    // Save the key
    switch (provider) {
        case 'gemini': config.geminiApiKey = apiKey; break;
        case 'openrouter': config.openrouterApiKey = apiKey; break;
        case 'openai': config.openaiApiKey = apiKey; break;
        case 'anthropic': config.anthropicApiKey = apiKey; break;
        case 'deepseek': config.deepseekApiKey = apiKey; break;
        case 'xai': config.xaiApiKey = apiKey; break;
    }
    config.defaultProvider = provider;

    // Step 3: Select Model
    console.log(chalk.white.bold('\nStep 3/3: Choose your default model\n'));

    const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.gemini;
    const model = await select({
        message: 'Select your default model:',
        choices: models,
    });

    config.defaultModel = model;
    saveConfig(config);

    // Step 4: Telemetry consent (opt-in) - "Check Engine" prompt
    console.log(chalk.white.bold('\n🔧 Help Agdi stop crashing?\n'));
    console.log(chalk.gray('We collect anonymous error logs (like a ') + chalk.yellow("'Check Engine'") + chalk.gray(' light)'));
    console.log(chalk.gray('to fix bugs faster. We ') + chalk.green.bold('never') + chalk.gray(' see your code or keys.\n'));
    console.log(chalk.dim('Verify anytime: agdi config telemetry --dry-run\n'));

    const { confirm } = await import('@inquirer/prompts');
    const enableTelemetry = await confirm({
        message: 'Enable crash reporting? (helps us fix bugs)',
        default: false,
    });

    // Import and set telemetry consent
    const { setTelemetryConsent, markConsentAsked } = await import('../core/telemetry/config.js');
    if (enableTelemetry) {
        setTelemetryConsent(true);
        console.log(chalk.green('\n✅ Thanks! You\'re helping make Agdi better. ❤️'));
        console.log(chalk.gray('   Verify what we send: agdi config telemetry --dry-run'));
    } else {
        markConsentAsked();
        console.log(chalk.gray('\n📊 No problem! You can enable it later: agdi config telemetry --enable'));
    }

    console.log(chalk.green('\n✅ Setup complete!'));
    console.log(chalk.gray(`Provider: ${chalk.cyan(provider)}`));
    console.log(chalk.gray(`Model: ${chalk.cyan(model)}\n`));

    return { provider, apiKey, model };
}

/**
 * Interactive model selector that changes the default
 */
export async function selectModel(): Promise<void> {
    const config = loadConfig();
    const provider = (config.defaultProvider || 'gemini') as ProviderType;

    console.log(chalk.cyan.bold('\n🔄 Change Model\n'));
    console.log(chalk.gray(`Current provider: ${chalk.cyan(provider)}`));
    console.log(chalk.gray(`Current model: ${chalk.cyan(config.defaultModel || 'not set')}\n`));

    // Option to change provider too
    const changeProvider = await select({
        message: 'What would you like to do?',
        choices: [
            { name: '📝 Change model (same provider)', value: 'model' },
            { name: '🔄 Change provider & model', value: 'provider' },
            { name: '❌ Cancel', value: 'cancel' },
        ],
    });

    if (changeProvider === 'cancel') {
        console.log(chalk.gray('\nCancelled.\n'));
        return;
    }

    let selectedProvider = provider;

    if (changeProvider === 'provider') {
        selectedProvider = await select({
            message: 'Select provider:',
            choices: [
                { name: 'Gemini', value: 'gemini' },
                { name: 'OpenRouter', value: 'openrouter' },
                { name: 'OpenAI', value: 'openai' },
                { name: 'Anthropic', value: 'anthropic' },
                { name: 'DeepSeek', value: 'deepseek' },
                { name: 'xAI', value: 'xai' },
            ],
        }) as ProviderType;

        // Check if API key exists for this provider
        const keyMap: Record<string, string | undefined> = {
            gemini: config.geminiApiKey,
            openrouter: config.openrouterApiKey,
            openai: config.openaiApiKey,
            anthropic: config.anthropicApiKey,
            deepseek: config.deepseekApiKey,
            xai: config.xaiApiKey,
        };

        if (!keyMap[selectedProvider]) {
            console.log(chalk.yellow(`\n⚠️  No API key configured for ${selectedProvider}\n`));
            const apiKey = await password({
                message: `Enter your ${selectedProvider} API key:`,
                mask: '*',
            });

            switch (selectedProvider) {
                case 'gemini': config.geminiApiKey = apiKey; break;
                case 'openrouter': config.openrouterApiKey = apiKey; break;
                case 'openai': config.openaiApiKey = apiKey; break;
                case 'anthropic': config.anthropicApiKey = apiKey; break;
                case 'deepseek': config.deepseekApiKey = apiKey; break;
                case 'xai': config.xaiApiKey = apiKey; break;
            }
        }

        config.defaultProvider = selectedProvider;
    }

    // Select model for the chosen provider
    const models = PROVIDER_MODELS[selectedProvider] || PROVIDER_MODELS.gemini;
    const model = await select({
        message: 'Select model:',
        choices: models,
    });

    config.defaultModel = model;
    saveConfig(config);

    console.log(chalk.green('\n✅ Model changed!'));
    console.log(chalk.gray(`Provider: ${chalk.cyan(selectedProvider)}`));
    console.log(chalk.gray(`Model: ${chalk.cyan(model)}\n`));
}
