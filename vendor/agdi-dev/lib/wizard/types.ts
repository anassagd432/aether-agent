/**
 * Wizard Flow — Types & Configuration
 */

// ==================== ENUMS ====================

export enum UserType {
    DEVELOPER = 'developer',
    BUSINESS_OWNER = 'business_owner',
}

export enum AppCategory {
    SAAS = 'saas',
    ECOMMERCE = 'ecommerce',
    PORTFOLIO = 'portfolio',
    DASHBOARD = 'dashboard',
    LANDING = 'landing',
    MARKETPLACE = 'marketplace',
    BLOG = 'blog',
    CUSTOM = 'custom',
}

export const APP_CATEGORY_META: Record<AppCategory, { label: string; icon: string; description: string }> = {
    [AppCategory.SAAS]: { label: 'SaaS App', icon: '🚀', description: 'Subscription software with auth, billing & dashboard' },
    [AppCategory.ECOMMERCE]: { label: 'E-Commerce', icon: '🛒', description: 'Online store with products, cart & payments' },
    [AppCategory.PORTFOLIO]: { label: 'Portfolio', icon: '🎨', description: 'Professional showcase site with projects & contact' },
    [AppCategory.DASHBOARD]: { label: 'Dashboard', icon: '📊', description: 'Data visualization with charts & analytics' },
    [AppCategory.LANDING]: { label: 'Landing Page', icon: '📄', description: 'High-converting marketing page with CTA' },
    [AppCategory.MARKETPLACE]: { label: 'Marketplace', icon: '🏪', description: 'Multi-vendor platform with listings & search' },
    [AppCategory.BLOG]: { label: 'Blog / CMS', icon: '📝', description: 'Content platform with posts, categories & SEO' },
    [AppCategory.CUSTOM]: { label: 'Custom App', icon: '⚡', description: 'Something else entirely — describe your idea' },
};

export enum AudienceType {
    B2B = 'b2b',
    B2C = 'b2c',
    INTERNAL = 'internal',
    MARKETPLACE = 'marketplace',
    DEVELOPERS = 'developers',
}

export const AUDIENCE_META: Record<AudienceType, { label: string; icon: string }> = {
    [AudienceType.B2B]: { label: 'Businesses (B2B)', icon: '🏢' },
    [AudienceType.B2C]: { label: 'Consumers (B2C)', icon: '👤' },
    [AudienceType.INTERNAL]: { label: 'Internal Team', icon: '👥' },
    [AudienceType.MARKETPLACE]: { label: 'Marketplace Users', icon: '🌐' },
    [AudienceType.DEVELOPERS]: { label: 'Developers', icon: '💻' },
};

export enum AppFeature {
    AUTH = 'auth',
    PAYMENTS = 'payments',
    DASHBOARD = 'dashboard',
    BLOG = 'blog',
    API = 'api',
    CHAT = 'chat',
    NOTIFICATIONS = 'notifications',
    FILE_UPLOAD = 'file_upload',
    SEARCH = 'search',
    ANALYTICS = 'analytics',
    DARK_MODE = 'dark_mode',
    I18N = 'i18n',
}

export const FEATURE_META: Record<AppFeature, { label: string; icon: string; description: string; requires?: AppFeature[] }> = {
    [AppFeature.AUTH]: { label: 'Authentication', icon: '🔐', description: 'User signup, login & profiles' },
    [AppFeature.PAYMENTS]: { label: 'Payments', icon: '💳', description: 'Stripe billing & subscriptions', requires: [AppFeature.AUTH] },
    [AppFeature.DASHBOARD]: { label: 'Dashboard', icon: '📊', description: 'Charts, stats & admin panel' },
    [AppFeature.BLOG]: { label: 'Blog / CMS', icon: '📝', description: 'Content management & posts' },
    [AppFeature.API]: { label: 'REST API', icon: '🔌', description: 'Public API endpoints' },
    [AppFeature.CHAT]: { label: 'Live Chat', icon: '💬', description: 'Real-time messaging', requires: [AppFeature.AUTH] },
    [AppFeature.NOTIFICATIONS]: { label: 'Notifications', icon: '🔔', description: 'Email & push notifications', requires: [AppFeature.AUTH] },
    [AppFeature.FILE_UPLOAD]: { label: 'File Upload', icon: '📎', description: 'Image & document uploads' },
    [AppFeature.SEARCH]: { label: 'Search', icon: '🔍', description: 'Full-text search & filters' },
    [AppFeature.ANALYTICS]: { label: 'Analytics', icon: '📈', description: 'Usage tracking & insights' },
    [AppFeature.DARK_MODE]: { label: 'Dark Mode', icon: '🌙', description: 'Light/dark theme toggle' },
    [AppFeature.I18N]: { label: 'Multi-Language', icon: '🌍', description: 'Internationalization support' },
};

export enum AppStyle {
    MODERN_DARK = 'modern_dark',
    CLEAN_LIGHT = 'clean_light',
    CORPORATE = 'corporate',
    PLAYFUL = 'playful',
    MINIMAL = 'minimal',
    NEON = 'neon',
}

export const STYLE_META: Record<AppStyle, { label: string; colors: [string, string]; description: string }> = {
    [AppStyle.MODERN_DARK]: { label: 'Modern Dark', colors: ['#0f172a', '#38bdf8'], description: 'Sleek dark UI with cyan accents' },
    [AppStyle.CLEAN_LIGHT]: { label: 'Clean Light', colors: ['#ffffff', '#3b82f6'], description: 'Bright & professional' },
    [AppStyle.CORPORATE]: { label: 'Corporate', colors: ['#1e293b', '#6366f1'], description: 'Enterprise-grade look' },
    [AppStyle.PLAYFUL]: { label: 'Playful', colors: ['#fef3c7', '#f59e0b'], description: 'Fun, vibrant colors' },
    [AppStyle.MINIMAL]: { label: 'Minimal', colors: ['#fafafa', '#18181b'], description: 'Clean, no-nonsense' },
    [AppStyle.NEON]: { label: 'Neon Glow', colors: ['#09090b', '#a855f7'], description: 'Cyberpunk-inspired' },
};

export enum DeployTarget {
    VERCEL = 'vercel',
    NETLIFY = 'netlify',
    DOWNLOAD = 'download',
}

// ==================== WIZARD STATE ====================

export interface WizardAnswers {
    userType: UserType | null;
    category: AppCategory | null;
    vision: string;
    audience: AudienceType[];
    features: AppFeature[];
    style: AppStyle | null;
    deployTarget: DeployTarget | null;
}

export interface AIFollowUp {
    question: string;
    answer: string;
}

export type WizardPhase =
    | 'userType'
    | 'category'
    | 'vision'
    | 'audience'
    | 'features'
    | 'style'
    | 'deploy'
    | 'analysis'
    | 'building';

export const WIZARD_PHASES: WizardPhase[] = [
    'userType',
    'category',
    'vision',
    'audience',
    'features',
    'style',
    'deploy',
];

export interface WizardState {
    phase: WizardPhase;
    answers: WizardAnswers;
    followUps: AIFollowUp[];
    synthesizedSpec: string | null;
    isAnalyzing: boolean;
    error: string | null;
}

export const INITIAL_WIZARD_STATE: WizardState = {
    phase: 'userType',
    answers: {
        userType: null,
        category: null,
        vision: '',
        audience: [],
        features: [],
        style: null,
        deployTarget: null,
    },
    followUps: [],
    synthesizedSpec: null,
    isAnalyzing: false,
    error: null,
};
