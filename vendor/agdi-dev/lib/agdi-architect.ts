import { GoogleGenAI, Type } from "@google/genai";
import { getAPIKey } from '../components/APIKeySettings';
import { createLogger } from './logger';
import { isSupabaseConfigured } from './supabase';

const log = createLogger('Agdi');

// ==================== MODEL CONFIGURATION ====================

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'gemini' | 'openrouter';
  description: string;
  isFree: boolean;
  category: 'google' | 'openai' | 'anthropic' | 'deepseek' | 'xai' | 'mistral' | 'meta' | 'other';
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  // ==================== GOOGLE GEMINI ====================
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Fast & capable',
    isFree: true,
    category: 'google'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Powerful reasoning',
    isFree: false,
    category: 'google'
  },
  // ==================== ANTHROPIC ====================
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    description: 'Best for coding',
    isFree: false,
    category: 'anthropic'
  },
  // ==================== OPENAI ====================
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'openrouter',
    description: 'Flagship model',
    isFree: false,
    category: 'openai'
  }
];

// ==================== TYPES ====================

export interface GeneratedFile {
  name: string;
  path: string;
  content: string;
}

export interface AppPlan {
  explanation: string;
  files: GeneratedFile[];
  dependencies: string[];
  isOffline?: boolean;
}

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

// Blueprint: The output of Phase 1
interface Blueprint {
  explanation: string;
  architecture: string; // High level description
  stack: string[]; // Tech stack details
  dependencies: string[];
  fileStructure: {
    path: string;
    description: string; // Instructions for the Engineer
    type: 'component' | 'hook' | 'utility' | 'config' | 'style';
  }[];
}

// ==================== AUTH CONTEXT ====================

function getAuthContext(): string {
  if (isSupabaseConfigured()) {
    return `Authentication backend: Supabase. Use @supabase/supabase-js for auth.
Environment variables available: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
Use createClient() from @supabase/supabase-js with these env vars.`;
  }
  return `IMPORTANT: Supabase is NOT available in this environment.
For authentication, you MUST generate a client-side mock auth provider using React Context + localStorage.
Do NOT use @supabase/supabase-js or any external auth service.
The mock auth provider should:
- Store a fake user object { id, email, name } in localStorage
- Provide login(email, password) that accepts any credentials and creates a mock session
- Provide signup(email, password, name) that creates and stores a new mock user
- Provide logout() that clears the session
- Provide a useAuth() hook returning { user, isAuthenticated, login, signup, logout }
- Wrap the app in an <AuthProvider> context
This allows the app to be fully previewed without real backend credentials.`;
}

// ==================== SYSTEM PROMPTS ====================

const ARCHITECT_PROMPT = (authContext: string) => `You are Agdi, an Expert Software Architect.
Your goal is to design a robust, scalable React application based on the user's request.
DO NOT WRITE CODE yet. You are only designing the BLUEPRINT.

Stack: React 19, Tailwind CSS, Lucide React, TypeScript.

${authContext}

Output strictly valid JSON:
{
  "explanation": "Executive summary of the solution.",
  "architecture": "Technical approach (e.g., 'Client-side SPA with Context API state management...')",
  "stack": ["React", "Vite", "Tailwind", "Zustand"],
  "dependencies": ["lucide-react", "clsx", "tailwind-merge", "framer-motion"],
  "fileStructure": [
    { "path": "src/App.tsx", "description": "Main entry point, routing setup.", "type": "component" },
    { "path": "src/components/Header.tsx", "description": "Responsive nav bar with dark mode toggle.", "type": "component" }
  ]
}

Rules:
1. Break the app into small, single-responsibility components.
2. ALWAYS include src/App.tsx, src/index.css, vite.config.ts, and README.md.
3. Ensure the file list is complete for a working MVP.
4. If the user requests authentication, follow the auth context above strictly.`;

const ENGINEER_PROMPT = (blueprint: Blueprint, file: { path: string, description: string }, authContext: string) => `
You are Agdi's Senior Engineer.
You are implementing the file: "${file.path}"
Context: ${blueprint.architecture}
Task: ${file.description}

${authContext}

Rules:
1. Write ONLY the code for this file.
2. Use TypeScript.
3. Use Tailwind CSS for styling.
4. If this is a component, export it as default.
5. NO markdown code fences. Just raw code.
6. If this file involves authentication, follow the auth context above strictly.
`;

// ==================== API CLIENTS ====================

const getGeminiClient = () => {
  const apiKey = getAPIKey('gemini');
  if (!apiKey) throw new Error('Gemini API key not configured.');
  return new GoogleGenAI({ apiKey });
};

// ==================== AGENT PIPELINE ====================

// Phase 1: The Architect
async function runArchitect(prompt: string, modelId: string, authContext: string): Promise<Blueprint> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: modelId || 'gemini-2.5-flash', // Use selected model, fallback to flash
    contents: prompt,
    config: {
      systemInstruction: ARCHITECT_PROMPT(authContext),
      responseMimeType: "application/json",
      temperature: 0.7,
    }
  });

  const text = response.text || '{}';
  // Cleanup markdown if present
  const jsonStr = text.replace(/```json|```/g, '').trim();
  return JSON.parse(jsonStr) as Blueprint;
}

// Phase 2: The Engineer
async function runEngineer(blueprint: Blueprint, fileSpec: { path: string, description: string }, modelId: string, authContext: string): Promise<GeneratedFile> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: modelId, // Use the user-selected model (e.g., Flash for speed)
    contents: `Write the code for ${fileSpec.path}. \n\n Blueprint: ${JSON.stringify(blueprint)}`,
    config: {
      systemInstruction: ENGINEER_PROMPT(blueprint, fileSpec, authContext),
      temperature: 0.2, // Low temp for code precision
    }
  });

  const content = (response.text || '').replace(/```tsx|```typescript|```css|```json|```/g, '').trim();
  return {
    name: fileSpec.path.split('/').pop() || 'unknown',
    path: fileSpec.path,
    content: content
  };
}

// Main Orchestrator
export const generateAppPlan = async (
  userPrompt: string,
  modelId: string = 'gemini-2.5-flash'
): Promise<AppPlan> => {
  const authContext = getAuthContext();
  log.info(`Phase 1: Architecting "${userPrompt}"...`);
  log.info(`Auth context: ${isSupabaseConfigured() ? 'Supabase configured' : 'Mock auth (no Supabase)'}`);

  // Check if any AI service is available
  if (!hasAnyAIService()) {
    log.info('No AI service available — using offline template generator');
    return generateOfflinePlan(userPrompt);
  }

  // 1. Architect the solution
  let blueprint: Blueprint;
  try {
    blueprint = await runArchitect(userPrompt, modelId, authContext);
  } catch (e) {
    console.error("Architect failed:", e);
    // Fallback to offline plan instead of crashing
    log.info('Architect failed — falling back to offline template');
    return generateOfflinePlan(userPrompt);
  }

  log.info(`Phase 1 Complete. Designed ${blueprint.fileStructure.length} files.`);
  log.info('Phase 2: Engineering...');

  // 2. Engineer the files (in parallel batches)
  const CONCURRENCY_LIMIT = 3; // Avoid hitting rate limits
  const generatedFiles: GeneratedFile[] = [];

  // Create chunks
  const queue = [...blueprint.fileStructure];

  // Simple queue processor
  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY_LIMIT);
    const promises = batch.map(fileSpec => runEngineer(blueprint, fileSpec, modelId, authContext));

    // Wait for batch
    const results = await Promise.all(promises);
    generatedFiles.push(...results);
  }

  return {
    explanation: blueprint.explanation,
    dependencies: blueprint.dependencies,
    files: generatedFiles
  };
};

// ==================== OFFLINE FALLBACK ====================

/**
 * Check if any AI generation service is available (Gemini key or OpenRouter key)
 */
export function hasAnyAIService(): boolean {
  try {
    const geminiKey = getAPIKey('gemini');
    if (geminiKey) return true;
  } catch { /* no gemini key */ }
  return false;
}

/**
 * Generate a working app plan WITHOUT any AI API calls.
 * Produces a static React template based on keyword analysis of the prompt.
 */
export function generateOfflinePlan(userPrompt: string): AppPlan {
  const prompt = userPrompt.toLowerCase();
  const hasAuth = prompt.includes('auth') || prompt.includes('login') || prompt.includes('sign');
  const hasDashboard = prompt.includes('dashboard') || prompt.includes('chart') || prompt.includes('analytics');
  const hasPayments = prompt.includes('payment') || prompt.includes('billing') || prompt.includes('stripe');

  const files: GeneratedFile[] = [];

  // App.tsx — main entry with routing
  files.push({
    name: 'App.tsx',
    path: 'src/App.tsx',
    content: `import React, { useState } from 'react';
${hasAuth ? "import { AuthProvider, useAuth } from './context/AuthContext';" : ''}
${hasDashboard ? "import Dashboard from './components/Dashboard';" : ''}
import Home from './components/Home';
import './index.css';

type Page = 'home'${hasAuth ? " | 'login'" : ''}${hasDashboard ? " | 'dashboard'" : ''};

${hasAuth ? `function AppContent() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<Page>('home');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer" onClick={() => setPage('home')}>
          My App
        </h1>
        <div className="flex items-center gap-4">
          ${hasDashboard ? `<button onClick={() => setPage('dashboard')} className="text-sm text-white/60 hover:text-white transition-colors">Dashboard</button>` : ''}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60">{user.email}</span>
              <button onClick={logout} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors">
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={() => setPage('login')} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-500 text-sm font-medium transition-all hover:shadow-lg hover:shadow-cyan-400/20">
              Sign In
            </button>
          )}
        </div>
      </nav>
      <main className="p-6">
        {page === 'login' && !user && <LoginPage onSuccess={() => setPage('home')} />}
        ${hasDashboard ? "{page === 'dashboard' && <Dashboard />}" : ''}
        {(page === 'home' || (page === 'login' && user)) && <Home />}
      </main>
    </div>
  );
}

function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email || 'user@demo.com', password || 'demo');
    onSuccess();
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <h2 className="text-2xl font-bold mb-6 text-center">Welcome Back</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50" />
          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-500 font-semibold text-sm hover:shadow-lg hover:shadow-cyan-400/20 transition-all">
            Sign In
          </button>
        </form>
        <p className="text-center text-white/30 text-xs mt-4">Demo mode — any credentials accepted</p>
      </div>
    </div>
  );
}` : `function AppContent() {
  const [page, setPage] = useState<Page>('home');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer" onClick={() => setPage('home')}>
          My App
        </h1>
        ${hasDashboard ? `<button onClick={() => setPage('dashboard')} className="text-sm text-white/60 hover:text-white transition-colors">Dashboard</button>` : ''}
      </nav>
      <main className="p-6">
        ${hasDashboard ? "{page === 'dashboard' && <Dashboard />}" : ''}
        {page === 'home' && <Home />}
      </main>
    </div>
  );
}`}

export default function App() {
  return (
    ${hasAuth ? '<AuthProvider><AppContent /></AuthProvider>' : '<AppContent />'}
  );
}
`
  });

  // Home.tsx
  files.push({
    name: 'Home.tsx',
    path: 'src/components/Home.tsx',
    content: `import React from 'react';

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto mt-16 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-mono mb-6">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        Live Preview
      </div>
      <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-white to-white/50 bg-clip-text text-transparent leading-tight">
        Your App Is<br />
        <span className="bg-gradient-to-r from-cyan-400 to-cyan-400 bg-clip-text text-transparent">Running</span>
      </h1>
      <p className="text-lg text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
        This is a template generated by Agdi. Connect an AI API key to generate a fully custom application tailored to your requirements.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
        {[
          { icon: '⚡', title: 'Fast', description: 'Built with Vite + React for instant HMR' },
          { icon: '🎨', title: 'Styled', description: 'Tailwind CSS for modern, responsive design' },
          { icon: '🔧', title: 'Extensible', description: 'Clean architecture ready for features' },
        ].map((card, i) => (
          <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors">
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-semibold text-white mb-1">{card.title}</h3>
            <p className="text-sm text-white/40">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
`
  });

  // Auth context (mock)
  if (hasAuth) {
    files.push({
      name: 'AuthContext.tsx',
      path: 'src/context/AuthContext.tsx',
      content: `import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => void;
  signup: (email: string, password: string, name?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('mock_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
  }, []);

  const login = (email: string, _password: string) => {
    const mockUser: User = { id: crypto.randomUUID(), email, name: email.split('@')[0] };
    localStorage.setItem('mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
  };

  const signup = (email: string, _password: string, name?: string) => {
    const mockUser: User = { id: crypto.randomUUID(), email, name: name || email.split('@')[0] };
    localStorage.setItem('mock_user', JSON.stringify(mockUser));
    setUser(mockUser);
  };

  const logout = () => {
    localStorage.removeItem('mock_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
`
    });
  }

  // Dashboard (if requested)
  if (hasDashboard) {
    files.push({
      name: 'Dashboard.tsx',
      path: 'src/components/Dashboard.tsx',
      content: `import React from 'react';

const stats = [
  { label: 'Total Users', value: '2,847', change: '+12%', color: 'from-cyan-400 to-blue-500' },
  { label: 'Revenue', value: '$48.2k', change: '+23%', color: 'from-cyan-400 to-pink-500' },
  { label: 'Active Sessions', value: '1,024', change: '+8%', color: 'from-emerald-400 to-cyan-500' },
  { label: 'Conversion Rate', value: '3.2%', change: '+2%', color: 'from-cyan-400 to-orange-500' },
];

export default function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <p className="text-sm text-white/40 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
            <span className={"text-xs font-medium bg-gradient-to-r " + stat.color + " bg-clip-text text-transparent"}>
              {stat.change}
            </span>
          </div>
        ))}
      </div>
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
        <h3 className="font-semibold mb-4">Activity</h3>
        <div className="space-y-3">
          {['New user registered', 'Payment received — $49', 'Support ticket resolved', 'Feature deployed'].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-white/60">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              {item}
              <span className="ml-auto text-white/20 text-xs">{i + 1}h ago</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`
    });
  }

  // index.css
  files.push({
    name: 'index.css',
    path: 'src/index.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
`
  });

  const dependencies = ['lucide-react', 'clsx'];

  return {
    explanation: `Offline template generated for: "${userPrompt.substring(0, 100)}". This is a static template — connect an AI API key to generate a fully custom app.${hasAuth ? ' Includes mock authentication (React Context + localStorage).' : ''}${hasDashboard ? ' Includes sample dashboard with stats.' : ''}`,
    dependencies,
    files,
  };
}

// ==================== UTILS ====================

export const buildFileTree = (files: GeneratedFile[]): FileNode[] => {
  const root: FileNode[] = [];
  files.forEach(file => {
    const parts = file.path.split('/');
    let currentLevel = root;
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      const existingNode = currentLevel.find(node => node.name === part);
      if (existingNode) {
        if (!isFile && existingNode.children) currentLevel = existingNode.children;
      } else {
        const newNode: FileNode = {
          name: part,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
          content: isFile ? file.content : undefined,
          language: isFile ? getLanguage(part) : undefined
        };
        currentLevel.push(newNode);
        if (!isFile && newNode.children) currentLevel = newNode.children;
      }
    });
  });
  const sortNodes = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
    nodes.forEach(node => { if (node.children) sortNodes(node.children); });
  };
  sortNodes(root);
  return root;
};

const getLanguage = (filename: string): string => {
  if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return 'typescript';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.html')) return 'html';
  return 'plaintext';
};
