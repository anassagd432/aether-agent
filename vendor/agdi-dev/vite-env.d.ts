/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    readonly VITE_OPENAI_API_KEY: string
    readonly VITE_ANTHROPIC_API_KEY: string
    readonly VITE_DEEPSEEK_API_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

/** Version string injected by Vite from package.json */
declare const APP_VERSION: string;
