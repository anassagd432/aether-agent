import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import BigText from 'ink-big-text';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { agentEventBus, AgentEvent, cleanupEventBus } from '../core/event-bus.js';
import { runSquadCommand } from '../commands/squad.js';
import { createLLMProvider } from '../core/index.js';
import { loadConfig } from '../utils/config.js';
import { getActiveProvider } from '../commands/onboarding.js';
import type { ILLMProvider } from '../core/types/index.js';

// --- TYPES ---
type Screen = 'boot' | 'dashboard';
type WizardStep = 'safety' | 'auth' | 'prompt' | 'active';

interface ChatMessage {
    role: 'user' | 'ai' | 'system';
    text: string;
}

// --- THEME ---
const THEME = {
    bg: 'black',
    border: 'gray',
    accent: 'blue',
    text: 'white',
    dim: 'gray',
    success: 'green',
};

// --- COMPONENTS ---

const BootScreen = ({ onComplete }: { onComplete: () => void }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev: number) => {
                const next = prev + 10;
                if (next >= 100) {
                    clearInterval(timer);
                    setTimeout(onComplete, 100);
                    return 100;
                }
                return next;
            });
        }, 20);
        return () => clearInterval(timer);
    }, []);

    return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" height={15}>
            <Text color={THEME.accent} bold>Initializing Agdi Workspace...</Text>
            <Text color={THEME.dim}>█{'█'.repeat(progress / 5)}</Text>
        </Box>
    );
};

// --- SIDEBAR (Left) ---
const Sidebar = ({ history }: { history: string[] }) => {
    return (
        <Box flexDirection="column" width={25} borderStyle="single" borderColor={THEME.border} paddingX={1}>
            <Box marginBottom={1} borderStyle="single" borderColor={THEME.accent} justifyContent="center">
                <Text bold>+ New task</Text>
            </Box>
            <Text color={THEME.dim} bold>RECENTS</Text>
            <Box flexDirection="column" marginTop={0}>
                {history.length === 0 ? (
                    <Text color={THEME.dim}>No recent sessions</Text>
                ) : (
                    history.map((h, i) => <Box key={i}><Text color={THEME.text}>{h}</Text></Box>)
                )}
            </Box>
        </Box>
    );
};

// --- CONTEXT PANEL (Right) ---
const ContextPanel = ({ files, agentStatus }: { files: string[], agentStatus: string }) => {
    return (
        <Box flexDirection="column" width={30} borderStyle="single" borderColor={THEME.border} paddingX={1}>
            <Box flexDirection="column" marginBottom={1}>
                <Text bold>Context</Text>
                <Text color={THEME.dim}>WORKING FILES</Text>
                {files.length === 0 ? (
                    <Text color={THEME.dim}>None yet.</Text>
                ) : (
                    files.slice(0, 5).map((f, i) => <Box key={i}><Text color={THEME.accent}>📄 {f}</Text></Box>)
                )}
            </Box>

            <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor={THEME.dim} padding={0}>
                <Text bold> Plugins</Text>
                <Text color={THEME.success}>• Scheduler</Text>
                <Text color={THEME.dim}>  Run scheduled jobs</Text>
            </Box>

            <Box flexDirection="column">
                <Text bold>Status</Text>
                <Text color={agentStatus === 'IDLE' ? THEME.dim : THEME.success}>
                    • {agentStatus}
                </Text>
            </Box>
        </Box>
    );
};

// --- CHAT AREA (Center) ---
const ChatArea = ({ history, onSend, placeholder }: { history: ChatMessage[], onSend: (t: string) => void, placeholder: string }) => {
    const [query, setQuery] = useState('');

    return (
        <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={THEME.border} marginLeft={0} marginRight={0}>
            {/* Header */}
            <Box justifyContent="center" borderStyle="single" borderBottomColor={THEME.border} borderTop={false} borderLeft={false} borderRight={false} paddingBottom={0}>
                <Text bold>Start a conversation</Text>
            </Box>

            {/* Messages */}
            <Box flexDirection="column" flexGrow={1} padding={1} justifyContent="flex-end">
                {history.length === 0 ? (
                    <Box flexDirection="column" alignItems="center" justifyContent="center" height={10}>
                        <Text color={THEME.dim}>Describe what you want to do,</Text>
                        <Text color={THEME.dim}>and Agdi will take it from there.</Text>
                    </Box>
                ) : (
                    history.slice(-8).map((msg, i) => (
                        <Box key={i} flexDirection="column" marginBottom={1}>
                            <Text bold color={msg.role === 'user' ? THEME.text : THEME.accent}>
                                {msg.role === 'user' ? 'You' : 'Agdi'}
                            </Text>
                            <Text color={THEME.text}>{msg.text}</Text>
                        </Box>
                    ))
                )}
            </Box>

            {/* Input Bar */}
            <Box borderStyle="round" borderColor={THEME.dim} paddingX={1} marginX={1} marginBottom={1}>
                <TextInput
                    value={query}
                    onChange={setQuery}
                    onSubmit={(val) => {
                        onSend(val);
                        setQuery('');
                    }}
                    placeholder={placeholder}
                />
            </Box>
        </Box>
    );
};

// --- MAIN DASHBOARD ---

const Dashboard = () => {
    const { exit } = useApp();
    const [cwd, setCwd] = useState(process.cwd());
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [step, setStep] = useState<WizardStep>('safety');
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [activeFiles, setActiveFiles] = useState<string[]>([]);
    const [agentStatus, setAgentStatus] = useState('IDLE');

    // --- LIVE NEURAL LINK ---
    useEffect(() => {
        const handleEvent = (event: AgentEvent) => { // Use explicit AgentEvent type
            if (event.type === 'handoff') {
                setAgentStatus(event.role.toUpperCase());
            }
            if (event.type === 'thought') {
                if (!event.message.startsWith('Analyzing')) {
                    setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'system', text: `[${event.agentName}] ${event.message}` }]);
                }
            }
            if (event.message.includes('Created:')) {
                const filename = event.message.split('Created:')[1].trim();
                setActiveFiles((prev: string[]) => [filename, ...prev].slice(0, 5));
            }
        };

        agentEventBus.on('agent_event', handleEvent as any); // Cast to any due to strict event emitter types
        return () => { agentEventBus.off('agent_event', handleEvent as any); };
    }, []);

    // Initial Safety Check
    useEffect(() => {
        if (step === 'safety') {
            const home = os.homedir();
            const root = path.parse(cwd).root;
            const isUnsafe = cwd === home || cwd === root;

            if (isUnsafe) {
                setChatHistory([
                    { role: 'system', text: `⚠️  Safety Check: Running in ${cwd}` },
                    { role: 'ai', text: 'This directory is too broad. Should I create a new project folder? (yes/no)' }
                ]);
                setPendingAction('safety_confirm');
            } else {
                setStep('prompt');
            }
        }
    }, []);

    const handleCommand = async (cmd: string) => {
        if (cmd === '/exit') exit();

        setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'user', text: cmd }]);

        // Safety Logic
        if (step === 'safety' && pendingAction === 'safety_confirm') {
            const lowerCmd = cmd.toLowerCase().trim();
            if (lowerCmd === 'yes' || lowerCmd === 'y') {
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'ai', text: 'Name your project:' }]);
                setPendingAction('create_folder');
            } else if (lowerCmd === 'no' || lowerCmd === 'n') {
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'ai', text: '⚠️ Proceeding in current directory. What are we building?' }]);
                setStep('prompt');
                setPendingAction(null);
            } else {
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'ai', text: 'Please answer "yes" to create a folder, or "no" to run here.' }]);
            }
            return;
        }

        if (step === 'safety' && pendingAction === 'create_folder') {
            const newPath = path.join(cwd, cmd.replace(/[^a-z0-9-_]/gi, '-'));
            try {
                if (!fs.existsSync(newPath)) fs.mkdirSync(newPath);
                process.chdir(newPath);
                setCwd(newPath);
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'system', text: `📂 Switched to ${newPath}` }]);
                setStep('prompt');
                setPendingAction(null);
            } catch (e) {
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'system', text: `Error: ${e}` }]);
            }
            return;
        }

        // --- REAL EXECUTION ---
        if (step === 'prompt') {
            setStep('active');
            setAgentStatus('MANAGER');

            const activeConfig = getActiveProvider();
            if (!activeConfig) {
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'system', text: '❌ No API key found. Run "agdi auth" first.' }]);
                return;
            }

            const llm = createLLMProvider(activeConfig.provider as any, {
                apiKey: activeConfig.apiKey,
                model: activeConfig.model,
            });

            runSquadCommand(cmd, llm, {
                output: cwd,
                verbose: false,
                deploy: false
            }).then(() => {
                setAgentStatus('IDLE');
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'ai', text: 'Task completed.' }]);
            }).catch(err => {
                setAgentStatus('ERROR');
                setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'system', text: `Error: ${err.message}` }]);
            });
        }
    };

    return (
        <Box flexDirection="row" height={30} padding={1}>
            <Sidebar history={['New session - ' + new Date().toLocaleDateString()]} />
            <ChatArea
                history={chatHistory}
                onSend={handleCommand}
                placeholder={step === 'prompt' ? 'Ask Agdi...' : 'Reply...'}
            />
            <ContextPanel files={activeFiles} agentStatus={agentStatus} />
        </Box>
    );
};

export const App = () => {
    const [screen, setScreen] = useState<Screen>('boot');
    return screen === 'boot' ? <BootScreen onComplete={() => setScreen('dashboard')} /> : <Dashboard />;
};
