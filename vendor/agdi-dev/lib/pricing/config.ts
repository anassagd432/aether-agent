/**
 * Pricing tier configuration
 *
 * Defines the three tiers (Free / Pro / Business) with
 * limits, features, cloud API quotas, and Stripe product IDs.
 */

export type PricingTierId = 'free' | 'pro' | 'business';

export interface CloudLimits {
    requestsPerDay: number;       // -1 = unlimited
    requestsPerMonth: number;     // -1 = unlimited
    allowedModels: string[];      // model IDs the tier can use
    maxPromptLength: number;      // chars
    priority: 'low' | 'normal' | 'high';  // queue priority
}

export interface PricingTier {
    id: PricingTierId;
    name: string;
    tagline: string;
    monthlyPrice: number;
    annualPrice: number;
    stripePriceIdMonthly?: string;
    stripePriceIdAnnual?: string;
    limits: {
        appsPerMonth: number;
        maxFiles: number;
        aiFollowUps: number;
        deployTargets: string[];
    };
    cloudLimits: CloudLimits;
    features: string[];
    highlighted: boolean;
}

export const PRICING_TIERS: PricingTier[] = [
    {
        id: 'free',
        name: 'Free',
        tagline: 'Try it out',
        monthlyPrice: 0,
        annualPrice: 0,
        limits: {
            appsPerMonth: 3,
            maxFiles: 5,
            aiFollowUps: 1,
            deployTargets: ['zip'],
        },
        cloudLimits: {
            requestsPerDay: 5,
            requestsPerMonth: 30,
            allowedModels: ['gemini-2.5-flash'],
            maxPromptLength: 2000,
            priority: 'low',
        },
        features: [
            '3 apps per month',
            'Simple apps (5 files max)',
            'Download as ZIP',
            '1 AI follow-up round',
            '5 cloud AI calls/day',
            'Community support',
        ],
        highlighted: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        tagline: 'For creators',
        monthlyPrice: 19,
        annualPrice: 182,
        stripePriceIdMonthly: 'price_pro_monthly_placeholder',
        stripePriceIdAnnual: 'price_pro_annual_placeholder',
        limits: {
            appsPerMonth: 20,
            maxFiles: 20,
            aiFollowUps: 3,
            deployTargets: ['vercel', 'netlify', 'zip'],
        },
        cloudLimits: {
            requestsPerDay: 50,
            requestsPerMonth: 500,
            allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
            maxPromptLength: 5000,
            priority: 'normal',
        },
        features: [
            '20 apps per month',
            'Medium complexity (20 files)',
            'Deploy to Vercel & Netlify',
            '3 AI follow-up rounds',
            '50 cloud AI calls/day',
            'Access to Gemini Pro',
            'Premium templates',
            'Email support',
        ],
        highlighted: true,
    },
    {
        id: 'business',
        name: 'Business',
        tagline: 'Full power',
        monthlyPrice: 49,
        annualPrice: 470,
        stripePriceIdMonthly: 'price_biz_monthly_placeholder',
        stripePriceIdAnnual: 'price_biz_annual_placeholder',
        limits: {
            appsPerMonth: -1,
            maxFiles: 100,
            aiFollowUps: -1,
            deployTargets: ['vercel', 'netlify', 'railway', 'zip'],
        },
        cloudLimits: {
            requestsPerDay: -1,
            requestsPerMonth: -1,
            allowedModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'openai/gpt-4o'],
            maxPromptLength: 10000,
            priority: 'high',
        },
        features: [
            'Unlimited apps',
            'Full SaaS complexity (100 files)',
            'All deploy targets',
            'Unlimited AI follow-ups',
            'Unlimited cloud AI calls',
            'All models (GPT-4o, Gemini Pro)',
            'Custom templates',
            'White-label option',
            'Priority Slack support',
        ],
        highlighted: false,
    },
];

/** Get tier config by ID */
export function getTierById(id: PricingTierId): PricingTier {
    return PRICING_TIERS.find(t => t.id === id) ?? PRICING_TIERS[0];
}

/** Get cloud limits for a plan (defaults to free) */
export function getCloudLimits(tierId?: PricingTierId): CloudLimits {
    return getTierById(tierId ?? 'free').cloudLimits;
}
