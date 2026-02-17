/**
 * Auth Command - Login and configure API keys
 */

import { input, select, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../utils/config.js';

export async function login(): Promise<void> {
    console.log(chalk.cyan.bold('\n🔐 Agdi Authentication\n'));
    console.log(chalk.gray('Configure your API key to use Agdi CLI.\n'));

    try {
        const config = loadConfig();

        // Provider selection - Puter removed (requires browser auth)
        const provider = await select({
            message: 'Select your AI provider:',
            choices: [
                { name: 'Google Gemini (Recommended)', value: 'gemini' },
                { name: 'OpenRouter (100+ models)', value: 'openrouter' },
                { name: 'OpenAI (GPT-4, GPT-5)', value: 'openai' },
                { name: 'Anthropic (Claude)', value: 'anthropic' },
                { name: 'DeepSeek', value: 'deepseek' },
                { name: 'Local LLM (Ollama)', value: 'ollama' },
                { name: 'Search API (Brave/Perplexity - for DeepSearch)', value: 'search' },
                { name: '🚀 Deployment (Vercel/Netlify/Railway - for auto-deploy)', value: 'deployment' },
                { name: '🎨 Image Generation (Nano Banana Pro)', value: 'image' },
            ],
        });

        if (provider === 'ollama') {
            const ollamaUrl = await input({
                message: 'Ollama server URL:',
                default: 'http://localhost:11434',
            });
            config.ollamaUrl = ollamaUrl;
            config.defaultProvider = 'ollama';
            saveConfig(config);
            console.log(chalk.green('\n✅ Ollama configured'));
            console.log(chalk.gray(`Server: ${ollamaUrl}\n`));
            return;
        }

        // Get API key for the selected provider
        const apiKey = await password({
            message: `Enter your ${provider} API key:`,
            mask: '*',
        });

        // Save the key
        switch (provider) {
            case 'gemini':
                config.geminiApiKey = apiKey;
                break;
            case 'openai':
                config.openaiApiKey = apiKey;
                break;
            case 'anthropic':
                config.anthropicApiKey = apiKey;
                break;
            case 'deepseek':
                config.deepseekApiKey = apiKey;
                break;
            case 'openrouter':
                config.openrouterApiKey = apiKey;
                break;
            case 'search': {
                // Select search provider
                const searchProvider = await select({
                    message: 'Select search provider:',
                    choices: [
                        { name: 'Brave Search (Recommended - Free 2k/month)', value: 'brave' },
                        { name: 'Perplexity API', value: 'perplexity' },
                        { name: 'Tavily', value: 'tavily' },
                    ],
                });
                config.searchProvider = searchProvider as 'brave' | 'perplexity' | 'tavily';
                config.searchApiKey = apiKey;
                config.searchEnabled = true;
                config.searchAutoTrigger = true;
                console.log(chalk.green(`\n✅ ${searchProvider} API key saved for DeepSearch`));
                console.log(chalk.gray('DeepSearch enabled - will automatically search for latest docs\n'));
                saveConfig(config);
                return;
            }
            case 'deployment': {
                // Select deployment platform
                const deployPlatform = await select({
                    message: 'Select deployment platform:',
                    choices: [
                        { name: 'Vercel (Recommended)', value: 'vercel' },
                        { name: 'Railway', value: 'railway' },
                        { name: 'Netlify', value: 'netlify' },
                    ],
                });

                console.log(chalk.gray('\nGet your token from:'));
                if (deployPlatform === 'vercel') {
                    console.log(chalk.cyan('  https://vercel.com/account/tokens\n'));
                } else if (deployPlatform === 'railway') {
                    console.log(chalk.cyan('  https://railway.app/account/tokens\n'));
                } else {
                    console.log(chalk.cyan('  https://app.netlify.com/user/applications#personal-access-tokens\n'));
                }

                const deployToken = await password({
                    message: `Enter your ${deployPlatform} token:`,
                    mask: '*',
                });

                if (deployPlatform === 'vercel') {
                    config.vercelToken = deployToken;
                } else if (deployPlatform === 'railway') {
                    config.railwayToken = deployToken;
                } else {
                    config.netlifyToken = deployToken;
                }
                config.deploymentProvider = deployPlatform as 'vercel' | 'netlify' | 'railway';

                saveConfig(config);
                console.log(chalk.green(`\n✅ ${deployPlatform} token saved securely`));
                console.log(chalk.gray('Auto-deployment enabled for "agdi squad --deploy"\n'));
                return;
            }
            case 'image': {
                console.log(chalk.gray('\nConfigure image generation provider.'));
                const imageProvider = await select({
                    message: 'Select image provider:',
                    choices: [
                        { name: 'Nano Banana Pro (API key)', value: 'nanobanana' },
                        { name: 'OpenRouter Seedream (uses OpenRouter key)', value: 'openrouter' },
                    ],
                });

                if (imageProvider === 'nanobanana') {
                    const nanoBananaKey = await password({
                        message: 'Enter your Nano Banana Pro API key:',
                        mask: '*',
                    });

                    const nanoBananaBaseUrl = await input({
                        message: 'Nano Banana API URL (OpenAI-compatible image endpoint):',
                        default: config.nanoBananaBaseUrl || 'https://api.nanobanana.pro/v1/images/generations',
                    });

                    config.nanoBananaApiKey = nanoBananaKey;
                    config.nanoBananaBaseUrl = nanoBananaBaseUrl;
                    config.imageProvider = 'nanobanana';

                    saveConfig(config);
                    console.log(chalk.green('\n✅ Nano Banana Pro configured for image generation'));
                    return;
                }

                config.imageProvider = 'openrouter';
                saveConfig(config);
                console.log(chalk.green('\n✅ OpenRouter selected for image generation'));
                console.log(chalk.gray('Make sure your OpenRouter API key is set via "agdi auth".\n'));
                return;
            }
        }

        config.defaultProvider = provider;
        saveConfig(config);

        console.log(chalk.green(`\n✅ ${provider} API key saved securely`));
        console.log(chalk.gray('Keys stored in ~/.agdi/config.json\n'));

    } catch (error) {
        // Handle user pressing Ctrl+C gracefully
        if ((error as Error).name === 'ExitPromptError') {
            console.log(chalk.gray('\n\n👋 Cancelled.\n'));
            process.exit(0);
        }
        throw error;
    }
}

export async function showStatus(): Promise<void> {
    const config = loadConfig();

    console.log(chalk.cyan.bold('\n📊 Authentication Status\n'));

    const providers = [
        { name: 'Gemini', key: config.geminiApiKey },
        { name: 'OpenRouter', key: config.openrouterApiKey },
        { name: 'OpenAI', key: config.openaiApiKey },
        { name: 'Anthropic', key: config.anthropicApiKey },
        { name: 'DeepSeek', key: config.deepseekApiKey },
    ];

    for (const p of providers) {
        const status = p.key ? chalk.green('✓ Configured') : chalk.gray('✗ Not set');
        console.log(`  ${p.name.padEnd(12)} ${status}`);
    }

    // Show deployment status
    console.log(chalk.cyan.bold('\n🚀 Deployment Tokens\n'));
    const deployProviders = [
        { name: 'Vercel', key: config.vercelToken },
        { name: 'Railway', key: config.railwayToken },
        { name: 'Netlify', key: config.netlifyToken },
    ];
    for (const p of deployProviders) {
        const status = p.key ? chalk.green('✓ Ready for auto-deploy') : chalk.gray('✗ Not set');
        console.log(`  ${p.name.padEnd(12)} ${status}`);
    }

    // Show Search status
    console.log(chalk.cyan.bold('\n🔍 Search Capabilities\n'));
    const searchStatus = config.searchApiKey ? chalk.green(`✓ Enabled (${config.searchProvider || 'brave'})`) : chalk.gray('✗ Not configured');
    console.log(`  DeepSearch   ${searchStatus}`);

    console.log(chalk.cyan.bold('\n🎨 Image Generation\n'));    
    const imageProvider = config.imageProvider || 'openrouter';
    const imageStatus = imageProvider === 'nanobanana'
        ? (config.nanoBananaApiKey ? chalk.green('✓ Configured') : chalk.gray('✗ Not set'))
        : (config.openrouterApiKey ? chalk.green('✓ Ready (OpenRouter)') : chalk.gray('✗ OpenRouter key missing'));
    console.log(`  Provider: ${imageProvider}  ${imageStatus}`);

    console.log(chalk.cyan(`\n  Default: ${config.defaultProvider || 'gemini'}\n`));
    console.log(chalk.gray('💡 Tip: Use "agdi auth" to reconfigure\n'));
}
