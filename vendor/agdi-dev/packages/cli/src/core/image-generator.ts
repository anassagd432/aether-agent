/**
 * Image Generator
 * Supports OpenRouter (Seedream 4.5) and Nano Banana Pro.
 */

//

export interface ImageGenerationOptions {
    width?: number;
    height?: number;
    style?: 'realistic' | 'artistic' | 'minimal' | 'tech';
}

export interface ImageGenerationConfig {
    provider: 'openrouter' | 'nanobanana';
    apiKey: string;
    baseUrl?: string;
    model?: string;
}

export interface GeneratedImage {
    url?: string;
    base64?: string;
    revisedPrompt?: string;
}

/**
 * Generate an image using the configured provider
 */
export async function generateImage(
    prompt: string,
    config: ImageGenerationConfig,
    options: ImageGenerationOptions = {}
): Promise<GeneratedImage> {
    const { width = 1024, height = 1024, style } = options;

    // Enhance prompt based on style
    let enhancedPrompt = prompt;
    if (style === 'tech') {
        enhancedPrompt = `Modern tech startup style, clean minimal design, professional: ${prompt}`;
    } else if (style === 'realistic') {
        enhancedPrompt = `Photorealistic, high quality, professional photography: ${prompt}`;
    } else if (style === 'artistic') {
        enhancedPrompt = `Artistic, creative, vibrant colors: ${prompt}`;
    } else if (style === 'minimal') {
        enhancedPrompt = `Minimalist, clean, simple, modern: ${prompt}`;
    }

    const isOpenRouter = config.provider === 'openrouter';
    const endpoint = isOpenRouter
        ? 'https://openrouter.ai/api/v1/images/generations'
        : (config.baseUrl || 'https://api.nanobanana.pro/v1/images/generations');

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
            ...(isOpenRouter ? {
                'HTTP-Referer': 'https://agdi-dev.vercel.app',
                'X-Title': 'Agdi CLI',
            } : {}),
        },
        body: JSON.stringify({
            model: config.model || (isOpenRouter ? 'bytedance-seed/seedream-4.5' : 'nano-banana-pro'),
            prompt: enhancedPrompt,
            n: 1,
            size: `${width}x${height}`,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Image generation failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
        data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
    };

    const imageData = data.data?.[0];
    if (!imageData) {
        throw new Error('No image data returned from API');
    }

    return {
        url: imageData.url,
        base64: imageData.b64_json,
        revisedPrompt: imageData.revised_prompt,
    };
}

/**
 * Download an image from URL and return as base64
 */
export async function downloadImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
}

/**
 * Generate a prompt for industry-specific hero images
 */
export function generateImagePromptForIndustry(industry: string, projectName: string): string {
    const prompts: Record<string, string> = {
        'ecommerce': `Professional product showcase for ${projectName}, modern e-commerce store hero image, clean white background, premium products`,
        'saas': `Abstract tech visualization for ${projectName}, cloud computing concept, modern SaaS dashboard, blue and purple gradient`,
        'blog': `Creative writing and content creation concept for ${projectName}, minimalist blog aesthetic, open book with ideas`,
        'portfolio': `Professional creative portfolio for ${projectName}, designer workspace, artistic tools and projects`,
        'restaurant': `Delicious food photography for ${projectName}, restaurant ambiance, warm lighting, appetizing presentation`,
        'fitness': `Active fitness lifestyle for ${projectName}, energetic workout scene, health and wellness`,
        'education': `Learning and education concept for ${projectName}, books and knowledge, bright academic environment`,
        'startup': `Innovative tech startup for ${projectName}, modern office space, team collaboration, cutting-edge technology`,
        'default': `Professional hero image for ${projectName}, modern clean design, abstract technology concept`,
    };

    return prompts[industry.toLowerCase()] || prompts['default'];
}

/**
 * Detect industry from project description
 */
export function detectIndustry(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('shop') || lower.includes('store') || lower.includes('ecommerce') || lower.includes('product')) {
        return 'ecommerce';
    }
    if (lower.includes('saas') || lower.includes('dashboard') || lower.includes('analytics')) {
        return 'saas';
    }
    if (lower.includes('blog') || lower.includes('article') || lower.includes('content')) {
        return 'blog';
    }
    if (lower.includes('portfolio') || lower.includes('showcase')) {
        return 'portfolio';
    }
    if (lower.includes('restaurant') || lower.includes('food') || lower.includes('cafe') || lower.includes('coffee')) {
        return 'restaurant';
    }
    if (lower.includes('fitness') || lower.includes('gym') || lower.includes('workout') || lower.includes('health')) {
        return 'fitness';
    }
    if (lower.includes('learn') || lower.includes('course') || lower.includes('education') || lower.includes('school')) {
        return 'education';
    }
    if (lower.includes('startup') || lower.includes('landing')) {
        return 'startup';
    }

    return 'default';
}
